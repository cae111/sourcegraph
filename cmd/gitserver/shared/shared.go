// gitserver is the gitserver server.
package shared

import (
	"container/list"
	"context"
	"database/sql"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	jsoniter "github.com/json-iterator/go"
	"github.com/sourcegraph/log"
	"github.com/tidwall/gjson"
	"golang.org/x/sync/semaphore"
	"golang.org/x/time/rate"

	"github.com/sourcegraph/sourcegraph/cmd/gitserver/server"
	"github.com/sourcegraph/sourcegraph/internal/actor"
	"github.com/sourcegraph/sourcegraph/internal/api"
	"github.com/sourcegraph/sourcegraph/internal/authz"
	"github.com/sourcegraph/sourcegraph/internal/codeintel/dependencies"
	"github.com/sourcegraph/sourcegraph/internal/conf"
	"github.com/sourcegraph/sourcegraph/internal/conf/conftypes"
	"github.com/sourcegraph/sourcegraph/internal/database"
	connections "github.com/sourcegraph/sourcegraph/internal/database/connections/live"
	"github.com/sourcegraph/sourcegraph/internal/debugserver"
	"github.com/sourcegraph/sourcegraph/internal/encryption/keyring"
	"github.com/sourcegraph/sourcegraph/internal/env"
	"github.com/sourcegraph/sourcegraph/internal/extsvc"
	"github.com/sourcegraph/sourcegraph/internal/extsvc/crates"
	"github.com/sourcegraph/sourcegraph/internal/extsvc/github"
	"github.com/sourcegraph/sourcegraph/internal/extsvc/gomodproxy"
	"github.com/sourcegraph/sourcegraph/internal/extsvc/npm"
	"github.com/sourcegraph/sourcegraph/internal/extsvc/pypi"
	"github.com/sourcegraph/sourcegraph/internal/extsvc/rubygems"
	"github.com/sourcegraph/sourcegraph/internal/goroutine"
	"github.com/sourcegraph/sourcegraph/internal/hostname"
	"github.com/sourcegraph/sourcegraph/internal/httpcli"
	"github.com/sourcegraph/sourcegraph/internal/instrumentation"
	"github.com/sourcegraph/sourcegraph/internal/jsonc"
	"github.com/sourcegraph/sourcegraph/internal/observation"
	"github.com/sourcegraph/sourcegraph/internal/ratelimit"
	"github.com/sourcegraph/sourcegraph/internal/repos"
	"github.com/sourcegraph/sourcegraph/internal/requestclient"
	"github.com/sourcegraph/sourcegraph/internal/trace"
	"github.com/sourcegraph/sourcegraph/internal/types"
	"github.com/sourcegraph/sourcegraph/lib/errors"
	"github.com/sourcegraph/sourcegraph/schema"
)

var (

	// Align these variables with the 'disk_space_remaining' alerts in monitoring
	wantPctFree     = env.MustGetInt("SRC_REPOS_DESIRED_PERCENT_FREE", 10, "Target percentage of free space on disk.")
	janitorInterval = env.MustGetDuration("SRC_REPOS_JANITOR_INTERVAL", 1*time.Minute, "Interval between cleanup runs")

	syncRepoStateInterval          = env.MustGetDuration("SRC_REPOS_SYNC_STATE_INTERVAL", 10*time.Minute, "Interval between state syncs")
	syncRepoStateBatchSize         = env.MustGetInt("SRC_REPOS_SYNC_STATE_BATCH_SIZE", 500, "Number of updates to perform per batch")
	syncRepoStateUpdatePerSecond   = env.MustGetInt("SRC_REPOS_SYNC_STATE_UPSERT_PER_SEC", 500, "The number of updated rows allowed per second across all gitserver instances")
	batchLogGlobalConcurrencyLimit = env.MustGetInt("SRC_BATCH_LOG_GLOBAL_CONCURRENCY_LIMIT", 256, "The maximum number of in-flight Git commands from all /batch-log requests combined")

	// 80 per second (4800 per minute) is well below our alert threshold of 30k per minute.
	rateLimitSyncerLimitPerSecond = env.MustGetInt("SRC_REPOS_SYNC_RATE_LIMIT_RATE_PER_SECOND", 80, "Rate limit applied to rate limit syncing")
)

type Config struct {
	env.BaseConfig

	ReposDir string
}

func (c *Config) Load() {
	c.ReposDir = c.Get("SRC_REPOS_DIR", "/data/repos", "Root dir containing repos.")
}

func LoadConfig() *Config {
	var config Config
	config.Load()
	return &config
}

func Main(ctx context.Context, observationCtx *observation.Context, config *Config) error {
	logger := observationCtx.Logger

	if config.ReposDir == "" {
		return errors.New("SRC_REPOS_DIR is required")
	}
	if err := os.MkdirAll(config.ReposDir, os.ModePerm); err != nil {
		return errors.Wrap(err, "creating SRC_REPOS_DIR")
	}

	wantPctFree2, err := getPercent(wantPctFree)
	if err != nil {
		return errors.Wrap(err, "SRC_REPOS_DESIRED_PERCENT_FREE is out of range")
	}

	sqlDB, err := getDB(observationCtx)
	if err != nil {
		return errors.Wrap(err, "initializing database stores")
	}
	db := database.NewDB(observationCtx.Logger, sqlDB)

	repoStore := db.Repos()
	dependenciesSvc := dependencies.NewService(observationCtx, db)
	externalServiceStore := db.ExternalServices()

	err = keyring.Init(ctx)
	if err != nil {
		return errors.Wrap(err, "initializing keyring")
	}

	authz.DefaultSubRepoPermsChecker, err = authz.NewSubRepoPermsClient(db.SubRepoPerms())
	if err != nil {
		return errors.Wrap(err, "creating sub-repo client")
	}

	gitserver := server.Server{
		Logger:             logger,
		ObservationCtx:     observationCtx,
		ReposDir:           config.ReposDir,
		DesiredPercentFree: wantPctFree2,
		GetRemoteURLFunc: func(ctx context.Context, repo api.RepoName) (string, error) {
			return getRemoteURLFunc(ctx, externalServiceStore, repoStore, nil, repo)
		},
		GetVCSSyncer: func(ctx context.Context, repo api.RepoName) (server.VCSSyncer, error) {
			return getVCSSyncer(ctx, externalServiceStore, repoStore, dependenciesSvc, repo, config.ReposDir)
		},
		Hostname:                hostname.Get(),
		DB:                      db,
		CloneQueue:              server.NewCloneQueue(list.New()),
		GlobalBatchLogSemaphore: semaphore.NewWeighted(int64(batchLogGlobalConcurrencyLimit)),
	}

	gitserver.RegisterMetrics(observationCtx, db)

	if tmpDir, err := gitserver.SetupAndClearTmp(); err != nil {
		return errors.Wrap(err, "failed to setup temporary directory")
	} else if err := os.Setenv("TMP_DIR", tmpDir); err != nil {
		// Additionally, set TMP_DIR so other temporary files we may accidentally
		// create are on the faster RepoDir mount.
		return errors.Wrap(err, "setting TMP_DIR")
	}

	// Create Handler now since it also initializes state
	// TODO: Why do we set server state as a side effect of creating our handler?
	handler := gitserver.Handler()
	handler = actor.HTTPMiddleware(logger, handler)
	handler = requestclient.HTTPMiddleware(handler)
	handler = trace.HTTPMiddleware(logger, handler, conf.DefaultClient())
	handler = instrumentation.HTTPMiddleware("", handler)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Best effort attempt to sync rate limiters for external services early on. If
	// it fails, we'll try again in the background sync below.
	if err := syncExternalServiceRateLimiters(ctx, externalServiceStore); err != nil {
		logger.Warn("error performing initial rate limit sync", log.Error(err))
	}

	go syncRateLimiters(ctx, logger, externalServiceStore, rateLimitSyncerLimitPerSecond)
	if os.Getenv("DEPLOY_TYPE") != "single-program" {
		// Ready immediately
		ready := make(chan struct{})
		close(ready)
		go debugserver.NewServerRoutine(ready).Start()
	}
	go gitserver.Janitor(actor.WithInternalActor(ctx), janitorInterval)
	go gitserver.SyncRepoState(syncRepoStateInterval, syncRepoStateBatchSize, syncRepoStateUpdatePerSecond)

	gitserver.StartClonePipeline(ctx)

	addr := os.Getenv("GITSERVER_ADDR")
	if addr == "" {
		port := "3178"
		host := ""
		if env.InsecureDev {
			host = "127.0.0.1"
		}
		addr = net.JoinHostPort(host, port)
	}
	srv := &http.Server{
		Addr:    addr,
		Handler: handler,
	}
	logger.Info("git-server: listening", log.String("addr", srv.Addr))

	go func() {
		err := srv.ListenAndServe()
		if err != http.ErrServerClosed {
			logger.Fatal(err.Error())
		}
	}()

	// Listen for shutdown signals. When we receive one attempt to clean up,
	// but do an insta-shutdown if we receive more than one signal.
	c := make(chan os.Signal, 2)
	signal.Notify(c, syscall.SIGINT, syscall.SIGHUP, syscall.SIGTERM)

	// Once we receive one of the signals from above, continues with the shutdown
	// process.
	<-c
	go func() {
		// If a second signal is received, exit immediately.
		<-c
		os.Exit(0)
	}()

	// Wait for at most for the configured shutdown timeout.
	ctx, cancel = context.WithTimeout(ctx, goroutine.GracefulShutdownTimeout)
	defer cancel()
	// Stop accepting requests.
	if err := srv.Shutdown(ctx); err != nil {
		logger.Error("shutting down http server", log.Error(err))
	}

	// The most important thing this does is kill all our clones. If we just
	// shutdown they will be orphaned and continue running.
	gitserver.Stop()

	return nil
}

func configureFusionClient(conn schema.PerforceConnection) server.FusionConfig {
	// Set up default settings first
	fc := server.FusionConfig{
		Enabled:             false,
		Client:              conn.P4Client,
		LookAhead:           2000,
		NetworkThreads:      12,
		NetworkThreadsFetch: 12,
		PrintBatch:          10,
		Refresh:             100,
		Retries:             10,
		MaxChanges:          -1,
		IncludeBinaries:     false,
		FsyncEnable:         false,
	}

	if conn.FusionClient == nil {
		return fc
	}

	// Required
	fc.Enabled = conn.FusionClient.Enabled
	fc.LookAhead = conn.FusionClient.LookAhead

	// Optional
	if conn.FusionClient.NetworkThreads > 0 {
		fc.NetworkThreads = conn.FusionClient.NetworkThreads
	}
	if conn.FusionClient.NetworkThreadsFetch > 0 {
		fc.NetworkThreadsFetch = conn.FusionClient.NetworkThreadsFetch
	}
	if conn.FusionClient.PrintBatch > 0 {
		fc.PrintBatch = conn.FusionClient.PrintBatch
	}
	if conn.FusionClient.Refresh > 0 {
		fc.Refresh = conn.FusionClient.Refresh
	}
	if conn.FusionClient.Retries > 0 {
		fc.Retries = conn.FusionClient.Retries
	}
	if conn.FusionClient.MaxChanges > 0 {
		fc.MaxChanges = conn.FusionClient.MaxChanges
	}
	fc.IncludeBinaries = conn.FusionClient.IncludeBinaries
	fc.FsyncEnable = conn.FusionClient.FsyncEnable

	return fc
}

func getPercent(p int) (int, error) {
	if p < 0 {
		return 0, errors.Errorf("negative value given for percentage: %d", p)
	}
	if p > 100 {
		return 0, errors.Errorf("excessively high value given for percentage: %d", p)
	}
	return p, nil
}

// getDB initializes a connection to the database and returns a dbutil.DB
func getDB(observationCtx *observation.Context) (*sql.DB, error) {
	// Gitserver is an internal actor. We rely on the frontend to do authz checks for
	// user requests.
	//
	// This call to SetProviders is here so that calls to GetProviders don't block.
	authz.SetProviders(true, []authz.Provider{})

	dsn := conf.GetServiceConnectionValueAndRestartOnChange(func(serviceConnections conftypes.ServiceConnections) string {
		return serviceConnections.PostgresDSN
	})
	return connections.EnsureNewFrontendDB(observationCtx, dsn, "gitserver")
}

func getRemoteURLFunc(
	ctx context.Context,
	externalServiceStore database.ExternalServiceStore,
	repoStore database.RepoStore,
	cli httpcli.Doer,
	repo api.RepoName,
) (string, error) {
	r, err := repoStore.GetByName(ctx, repo)
	if err != nil {
		return "", err
	}

	for _, info := range r.Sources {
		// build the clone url using the external service config instead of using
		// the source CloneURL field
		svc, err := externalServiceStore.GetByID(ctx, info.ExternalServiceID())
		if err != nil {
			return "", err
		}

		if svc.CloudDefault && r.Private {
			// We won't be able to use this remote URL, so we should skip it. This can happen
			// if a repo moves from being public to private while belonging to both a cloud
			// default external service and another external service with a token that has
			// access to the private repo.
			continue
		}

		if svc.Kind == extsvc.KindGitHub {
			config, err := conf.GitHubAppConfig()
			if err != nil {
				return "", err
			}
			if config.Configured() {
				rawConfig, err := svc.Config.Decrypt(ctx)
				if err != nil {
					return "", err
				}
				installationID := gjson.Get(rawConfig, "githubAppInstallationID").Int()
				if installationID > 0 {
					rawConfig, err = editGitHubAppExternalServiceConfigToken(ctx, externalServiceStore, svc, rawConfig, config.PrivateKey, config.AppID, installationID, cli)
					if err != nil {
						return "", errors.Wrap(err, "edit GitHub App external service config token")
					}
					svc.Config.Set(rawConfig)
				}
			}
		}
		return repos.EncryptableCloneURL(ctx, log.Scoped("repos.CloneURL", ""), svc.Kind, svc.Config, r)
	}
	return "", errors.Errorf("no sources for %q", repo)
}

// editGitHubAppExternalServiceConfigToken updates the "token" field of the given
// external service config through GitHub App and returns a new copy of the
// config ensuring the token is always valid.
func editGitHubAppExternalServiceConfigToken(
	ctx context.Context,
	externalServiceStore database.ExternalServiceStore,
	svc *types.ExternalService,
	rawConfig string,
	privateKey []byte,
	appID string,
	installationID int64,
	cli httpcli.Doer,
) (string, error) {
	logger := log.Scoped("editGitHubAppExternalServiceConfigToken", "updates the 'token' field of the given external service")

	baseURL, err := url.Parse(gjson.Get(rawConfig, "url").String())
	if err != nil {
		return "", errors.Wrap(err, "parse base URL")
	}

	apiURL, githubDotCom := github.APIRoot(baseURL)
	if !githubDotCom {
		return "", errors.Errorf("only GitHub App on GitHub.com is supported, but got %q", baseURL)
	}

	var c schema.GitHubConnection
	if err := jsonc.Unmarshal(rawConfig, &c); err != nil {
		return "", nil
	}

	appAuther, err := github.NewGitHubAppAuthenticator(appID, privateKey)
	if err != nil {
		return "", errors.Wrap(err, "new authenticator with GitHub App")
	}

	scopedLogger := logger.Scoped("app", "github client for github app").With(log.String("appID", appID))
	appClient := github.NewV3Client(scopedLogger, svc.URN(), apiURL, appAuther, cli)

	token, err := appClient.CreateAppInstallationAccessToken(ctx, installationID)
	if err != nil {
		return "", errors.Wrap(err, "get or renew GitHub App installation access token")
	}

	// NOTE: Use `json.Marshal` breaks the actual external service config that fails
	// validation with missing "repos" property when no repository has been selected,
	// due to generated JSON tag of ",omitempty".
	config, err := jsonc.Edit(rawConfig, token.Token, "token")
	if err != nil {
		return "", errors.Wrap(err, "edit token")
	}
	err = externalServiceStore.Update(ctx, conf.Get().AuthProviders, svc.ID,
		&database.ExternalServiceUpdate{
			Config:         &config,
			TokenExpiresAt: token.ExpiresAt,
		})
	return config, err
}

func getVCSSyncer(
	ctx context.Context,
	externalServiceStore database.ExternalServiceStore,
	repoStore database.RepoStore,
	depsSvc *dependencies.Service,
	repo api.RepoName,
	reposDir string,
) (server.VCSSyncer, error) {
	// We need an internal actor in case we are trying to access a private repo. We
	// only need access in order to find out the type of code host we're using, so
	// it's safe.
	r, err := repoStore.GetByName(actor.WithInternalActor(ctx), repo)
	if err != nil {
		return nil, errors.Wrap(err, "get repository")
	}

	extractOptions := func(connection any) (string, error) {
		for _, info := range r.Sources {
			extSvc, err := externalServiceStore.GetByID(ctx, info.ExternalServiceID())
			if err != nil {
				return "", errors.Wrap(err, "get external service")
			}
			rawConfig, err := extSvc.Config.Decrypt(ctx)
			if err != nil {
				return "", err
			}
			normalized, err := jsonc.Parse(rawConfig)
			if err != nil {
				return "", errors.Wrap(err, "normalize JSON")
			}
			if err = jsoniter.Unmarshal(normalized, connection); err != nil {
				return "", errors.Wrap(err, "unmarshal JSON")
			}
			return extSvc.URN(), nil
		}
		return "", errors.Errorf("unexpected empty Sources map in %v", r)
	}

	switch r.ExternalRepo.ServiceType {
	case extsvc.TypePerforce:
		var c schema.PerforceConnection
		if _, err := extractOptions(&c); err != nil {
			return nil, err
		}

		p4Home := filepath.Join(reposDir, server.P4HomeName)
		// Ensure the directory exists
		if err := os.MkdirAll(p4Home, os.ModePerm); err != nil {
			return nil, errors.Wrapf(err, "ensuring p4Home exists: %q", p4Home)
		}

		return &server.PerforceDepotSyncer{
			MaxChanges:   int(c.MaxChanges),
			Client:       c.P4Client,
			FusionConfig: configureFusionClient(c),
			P4Home:       p4Home,
		}, nil
	case extsvc.TypeJVMPackages:
		var c schema.JVMPackagesConnection
		if _, err := extractOptions(&c); err != nil {
			return nil, err
		}
		return server.NewJVMPackagesSyncer(&c, depsSvc), nil
	case extsvc.TypeNpmPackages:
		var c schema.NpmPackagesConnection
		urn, err := extractOptions(&c)
		if err != nil {
			return nil, err
		}
		cli := npm.NewHTTPClient(urn, c.Registry, c.Credentials, httpcli.ExternalDoer)
		return server.NewNpmPackagesSyncer(c, depsSvc, cli), nil
	case extsvc.TypeGoModules:
		var c schema.GoModulesConnection
		urn, err := extractOptions(&c)
		if err != nil {
			return nil, err
		}
		cli := gomodproxy.NewClient(urn, c.Urls, httpcli.ExternalDoer)
		return server.NewGoModulesSyncer(&c, depsSvc, cli), nil
	case extsvc.TypePythonPackages:
		var c schema.PythonPackagesConnection
		urn, err := extractOptions(&c)
		if err != nil {
			return nil, err
		}
		cli := pypi.NewClient(urn, c.Urls, httpcli.ExternalDoer)
		return server.NewPythonPackagesSyncer(&c, depsSvc, cli), nil
	case extsvc.TypeRustPackages:
		var c schema.RustPackagesConnection
		urn, err := extractOptions(&c)
		if err != nil {
			return nil, err
		}
		cli := crates.NewClient(urn, httpcli.ExternalDoer)
		return server.NewRustPackagesSyncer(&c, depsSvc, cli), nil
	case extsvc.TypeRubyPackages:
		var c schema.RubyPackagesConnection
		urn, err := extractOptions(&c)
		if err != nil {
			return nil, err
		}
		cli := rubygems.NewClient(urn, c.Repository, httpcli.ExternalDoer)
		return server.NewRubyPackagesSyncer(&c, depsSvc, cli), nil
	}
	return &server.GitRepoSyncer{}, nil
}

func syncExternalServiceRateLimiters(ctx context.Context, store database.ExternalServiceStore) error {
	svcs, err := store.List(ctx, database.ExternalServicesListOptions{})
	if err != nil {
		return errors.Wrap(err, "listing external services")
	}
	syncer := repos.NewRateLimitSyncer(ratelimit.DefaultRegistry, store, repos.RateLimitSyncerOpts{})
	return syncer.SyncServices(ctx, svcs)
}

// Sync rate limiters from config. Since we don't have a trigger that watches for
// changes to rate limits we'll run this periodically in the background.
func syncRateLimiters(ctx context.Context, logger log.Logger, store database.ExternalServiceStore, perSecond int) {
	backoff := 5 * time.Second
	batchSize := 50
	logger = logger.Scoped("syncRateLimiters", "sync rate limiters from config")

	// perSecond should be spread across all gitserver instances and we want to wait
	// until we know about at least one instance.
	var instanceCount int
	for {
		instanceCount = len(conf.Get().ServiceConnectionConfig.GitServers)
		if instanceCount > 0 {
			break
		}

		logger.Warn("found zero gitserver instance, trying again after backoff", log.Duration("backoff", backoff))
	}

	limiter := ratelimit.NewInstrumentedLimiter("RateLimitSyncer", rate.NewLimiter(rate.Limit(float64(perSecond)/float64(instanceCount)), batchSize))
	syncer := repos.NewRateLimitSyncer(ratelimit.DefaultRegistry, store, repos.RateLimitSyncerOpts{
		PageSize: batchSize,
		Limiter:  limiter,
	})

	var lastSuccessfulSync time.Time
	ticker := time.NewTicker(1 * time.Minute)
	for {
		start := time.Now()
		if err := syncer.SyncLimitersSince(ctx, lastSuccessfulSync); err != nil {
			logger.Warn("syncRateLimiters: error syncing rate limits", log.Error(err))
		} else {
			lastSuccessfulSync = start
		}

		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}
