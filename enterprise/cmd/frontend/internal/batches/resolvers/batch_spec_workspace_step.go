package resolvers

import (
	"context"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/sourcegraph/sourcegraph/cmd/frontend/graphqlbackend"
	"github.com/sourcegraph/sourcegraph/cmd/frontend/graphqlbackend/graphqlutil"
	"github.com/sourcegraph/sourcegraph/enterprise/internal/batches/store"
	btypes "github.com/sourcegraph/sourcegraph/enterprise/internal/batches/types"
	"github.com/sourcegraph/sourcegraph/internal/gitserver"
	"github.com/sourcegraph/sourcegraph/internal/gqlutil"
	"github.com/sourcegraph/sourcegraph/internal/workerutil"
	batcheslib "github.com/sourcegraph/sourcegraph/lib/batches"
	"github.com/sourcegraph/sourcegraph/lib/batches/execution"
)

type batchSpecWorkspaceStepV1Resolver struct {
	store    *store.Store
	repo     *graphqlbackend.RepositoryResolver
	baseRev  string
	index    int
	step     batcheslib.Step
	stepInfo *btypes.StepInfo

	cachedResult *execution.AfterStepResult
}

var _ graphqlbackend.BatchSpecWorkspaceStepResolver = &batchSpecWorkspaceStepV1Resolver{}

func (r *batchSpecWorkspaceStepV1Resolver) Number() int32 {
	return int32(r.index + 1)
}

func (r *batchSpecWorkspaceStepV1Resolver) Run() string {
	return r.step.Run
}

func (r *batchSpecWorkspaceStepV1Resolver) Container() string {
	return r.step.Container
}

func (r *batchSpecWorkspaceStepV1Resolver) IfCondition() *string {
	cond := r.step.IfCondition()
	if cond == "" {
		return nil
	}
	return &cond
}

func (r *batchSpecWorkspaceStepV1Resolver) CachedResultFound() bool {
	return r.stepInfo.StartedAt.IsZero() && r.cachedResult != nil
}

func (r *batchSpecWorkspaceStepV1Resolver) Skipped() bool {
	return r.CachedResultFound() || r.stepInfo.Skipped
}

func (r *batchSpecWorkspaceStepV1Resolver) OutputLines(ctx context.Context, args *graphqlbackend.BatchSpecWorkspaceStepOutputLinesArgs) graphqlbackend.BatchSpecWorkspaceStepOutputLineConnectionResolver {
	lines := r.stepInfo.OutputLines

	return &batchSpecWorkspaceOutputLinesResolver{
		lines: lines,
		first: args.First,
		after: args.After,
	}
}

func (r *batchSpecWorkspaceStepV1Resolver) StartedAt() *gqlutil.DateTime {
	if r.stepInfo.StartedAt.IsZero() {
		return nil
	}
	return &gqlutil.DateTime{Time: r.stepInfo.StartedAt}
}

func (r *batchSpecWorkspaceStepV1Resolver) FinishedAt() *gqlutil.DateTime {
	if r.stepInfo.FinishedAt.IsZero() {
		return nil
	}
	return &gqlutil.DateTime{Time: r.stepInfo.FinishedAt}
}

func (r *batchSpecWorkspaceStepV1Resolver) ExitCode() *int32 {
	if r.stepInfo.ExitCode == nil {
		return nil
	}
	code := int32(*r.stepInfo.ExitCode)
	return &code
}

func (r *batchSpecWorkspaceStepV1Resolver) Environment() ([]graphqlbackend.BatchSpecWorkspaceEnvironmentVariableResolver, error) {
	// The environment is dependent on environment of the executor and template variables, that aren't
	// known at the time when we resolve the workspace. If the step already started, src cli has logged
	// the final env. Otherwise, we fall back to the preliminary set of env vars as determined by the
	// resolve workspaces step.

	var env = r.stepInfo.Environment

	// Not yet resolved, do a server-side pass.
	if env == nil {
		var err error
		env, err = r.step.Env.Resolve([]string{})
		if err != nil {
			return nil, err
		}
	}

	outer := r.step.Env.OuterVars()
	outerMap := make(map[string]struct{})
	for _, o := range outer {
		outerMap[o] = struct{}{}
	}

	resolvers := make([]graphqlbackend.BatchSpecWorkspaceEnvironmentVariableResolver, 0, len(env))
	for k, v := range env {
		var val *string
		if _, ok := outerMap[k]; !ok {
			val = &v
		}
		resolvers = append(resolvers, &batchSpecWorkspaceEnvironmentVariableResolver{key: k, value: val})
	}
	return resolvers, nil
}

func (r *batchSpecWorkspaceStepV1Resolver) OutputVariables() *[]graphqlbackend.BatchSpecWorkspaceOutputVariableResolver {
	if r.CachedResultFound() {
		resolvers := make([]graphqlbackend.BatchSpecWorkspaceOutputVariableResolver, 0, len(r.cachedResult.Outputs))
		for k, v := range r.cachedResult.Outputs {
			resolvers = append(resolvers, &batchSpecWorkspaceOutputVariableResolver{key: k, value: v})
		}
		return &resolvers
	}

	if r.stepInfo.OutputVariables == nil {
		return nil
	}

	resolvers := make([]graphqlbackend.BatchSpecWorkspaceOutputVariableResolver, 0, len(r.stepInfo.OutputVariables))
	for k, v := range r.stepInfo.OutputVariables {
		resolvers = append(resolvers, &batchSpecWorkspaceOutputVariableResolver{key: k, value: v})
	}
	return &resolvers
}

func (r *batchSpecWorkspaceStepV1Resolver) DiffStat(ctx context.Context) (*graphqlbackend.DiffStat, error) {
	diffRes, err := r.Diff(ctx)
	if err != nil {
		return nil, err
	}
	if diffRes != nil {
		fd, err := diffRes.FileDiffs(ctx, &graphqlbackend.FileDiffsConnectionArgs{})
		if err != nil {
			return nil, err
		}
		return fd.DiffStat(ctx)
	}
	return nil, nil
}

func (r *batchSpecWorkspaceStepV1Resolver) Diff(ctx context.Context) (graphqlbackend.PreviewRepositoryComparisonResolver, error) {
	if r.CachedResultFound() {
		return graphqlbackend.NewPreviewRepositoryComparisonResolver(ctx, r.store.DatabaseDB(), gitserver.NewClient(r.store.DatabaseDB()), r.repo, r.baseRev, r.cachedResult.Diff)
	}
	if r.stepInfo.DiffFound {
		return graphqlbackend.NewPreviewRepositoryComparisonResolver(ctx, r.store.DatabaseDB(), gitserver.NewClient(r.store.DatabaseDB()), r.repo, r.baseRev, r.stepInfo.Diff)
	}
	return nil, nil
}

type batchSpecWorkspaceStepV2Resolver struct {
	store   *store.Store
	repo    *graphqlbackend.RepositoryResolver
	baseRev string
	index   int
	step    batcheslib.Step
	skipped bool

	logEntry      workerutil.ExecutionLogEntry
	logEntryFound bool

	cachedResult      *execution.AfterStepResult
	cachedResultFound bool
}

var _ graphqlbackend.BatchSpecWorkspaceStepResolver = &batchSpecWorkspaceStepV2Resolver{}

func (r *batchSpecWorkspaceStepV2Resolver) Number() int32 {
	return int32(r.index + 1)
}

func (r *batchSpecWorkspaceStepV2Resolver) Run() string {
	return r.step.Run
}

func (r *batchSpecWorkspaceStepV2Resolver) Container() string {
	return r.step.Container
}

func (r *batchSpecWorkspaceStepV2Resolver) IfCondition() *string {
	cond := r.step.IfCondition()
	if cond == "" {
		return nil
	}
	return &cond
}

func (r *batchSpecWorkspaceStepV2Resolver) CachedResultFound() bool {
	return r.cachedResultFound
}

func (r *batchSpecWorkspaceStepV2Resolver) Skipped() bool {
	return r.CachedResultFound() || r.skipped
}

func (r *batchSpecWorkspaceStepV2Resolver) OutputLines(ctx context.Context, args *graphqlbackend.BatchSpecWorkspaceStepOutputLinesArgs) graphqlbackend.BatchSpecWorkspaceStepOutputLineConnectionResolver {
	if !r.logEntryFound {
		return nil
	}

	lines := strings.Split(r.logEntry.Out, "\n")
	return &batchSpecWorkspaceOutputLinesResolver{
		lines: lines,
		first: args.First,
		after: args.After,
	}
}

func (r *batchSpecWorkspaceStepV2Resolver) StartedAt() *gqlutil.DateTime {
	if !r.logEntryFound {
		return nil
	}

	return &gqlutil.DateTime{Time: r.logEntry.StartTime}
}

func (r *batchSpecWorkspaceStepV2Resolver) FinishedAt() *gqlutil.DateTime {
	if !r.logEntryFound {
		return nil
	}

	if r.logEntry.DurationMs == nil {
		return nil
	}

	finish := r.logEntry.StartTime.Add(time.Duration(*r.logEntry.DurationMs) * time.Millisecond)

	return &gqlutil.DateTime{Time: finish}
}

func (r *batchSpecWorkspaceStepV2Resolver) ExitCode() *int32 {
	if !r.logEntryFound {
		return nil
	}
	code := r.logEntry.ExitCode
	if code == nil {
		return nil
	}
	i32 := int32(*code)
	return &i32
}

func (r *batchSpecWorkspaceStepV2Resolver) Environment() ([]graphqlbackend.BatchSpecWorkspaceEnvironmentVariableResolver, error) {
	// The environment is dependent on environment of the executor and template variables, that aren't
	// known at the time when we resolve the workspace. If the step already started, src cli has logged
	// the final env. Otherwise, we fall back to the preliminary set of env vars as determined by the
	// resolve workspaces step.

	// TODO: This is only a server-side pass of the environment variables. V2 execution does not yet
	// support rendering the actual env var values used at runtime.
	// See the V1 resolver for what happens there.
	env, err := r.step.Env.Resolve([]string{})
	if err != nil {
		return nil, err
	}

	outer := r.step.Env.OuterVars()
	outerMap := make(map[string]struct{})
	for _, o := range outer {
		outerMap[o] = struct{}{}
	}

	resolvers := make([]graphqlbackend.BatchSpecWorkspaceEnvironmentVariableResolver, 0, len(env))
	for k, v := range env {
		var val *string
		if _, ok := outerMap[k]; !ok {
			val = &v
		}
		resolvers = append(resolvers, &batchSpecWorkspaceEnvironmentVariableResolver{key: k, value: val})
	}
	return resolvers, nil
}

func (r *batchSpecWorkspaceStepV2Resolver) OutputVariables() *[]graphqlbackend.BatchSpecWorkspaceOutputVariableResolver {
	// If a cached result was found previously, or one was generated for this step, we can
	// use it to read the rendered output variables.
	// TODO: Should we return the underendered variables before the cached result is
	// available like we do with env vars?
	if r.cachedResult != nil {
		resolvers := make([]graphqlbackend.BatchSpecWorkspaceOutputVariableResolver, 0, len(r.cachedResult.Outputs))
		for k, v := range r.cachedResult.Outputs {
			resolvers = append(resolvers, &batchSpecWorkspaceOutputVariableResolver{key: k, value: v})
		}
		return &resolvers
	}
	return nil
}

func (r *batchSpecWorkspaceStepV2Resolver) DiffStat(ctx context.Context) (*graphqlbackend.DiffStat, error) {
	diffRes, err := r.Diff(ctx)
	if err != nil {
		return nil, err
	}
	if diffRes == nil {
		return nil, nil
	}

	fd, err := diffRes.FileDiffs(ctx, &graphqlbackend.FileDiffsConnectionArgs{})
	if err != nil {
		return nil, err
	}
	return fd.DiffStat(ctx)
}

func (r *batchSpecWorkspaceStepV2Resolver) Diff(ctx context.Context) (graphqlbackend.PreviewRepositoryComparisonResolver, error) {
	// If a cached result was found previously, or one was generated for this step, we can
	// use it to return a comparison resolver.
	if r.cachedResult != nil {
		return graphqlbackend.NewPreviewRepositoryComparisonResolver(ctx, r.store.DatabaseDB(), gitserver.NewClient(r.store.DatabaseDB()), r.repo, r.baseRev, r.cachedResult.Diff)
	}
	return nil, nil
}

type batchSpecWorkspaceEnvironmentVariableResolver struct {
	key   string
	value *string
}

var _ graphqlbackend.BatchSpecWorkspaceEnvironmentVariableResolver = &batchSpecWorkspaceEnvironmentVariableResolver{}

func (r *batchSpecWorkspaceEnvironmentVariableResolver) Name() string {
	return r.key
}
func (r *batchSpecWorkspaceEnvironmentVariableResolver) Value() *string {
	return r.value
}

type batchSpecWorkspaceOutputVariableResolver struct {
	key   string
	value any
}

var _ graphqlbackend.BatchSpecWorkspaceOutputVariableResolver = &batchSpecWorkspaceOutputVariableResolver{}

func (r *batchSpecWorkspaceOutputVariableResolver) Name() string {
	return r.key
}
func (r *batchSpecWorkspaceOutputVariableResolver) Value() graphqlbackend.JSONValue {
	return graphqlbackend.JSONValue{Value: r.value}
}

type batchSpecWorkspaceOutputLinesResolver struct {
	lines []string
	first int32
	after *int32

	once        sync.Once
	total       int32
	linesSubset []string
	hasNextPage bool
	endCursor   int32
}

var _ graphqlbackend.BatchSpecWorkspaceStepOutputLineConnectionResolver = &batchSpecWorkspaceOutputLinesResolver{}

func (r *batchSpecWorkspaceOutputLinesResolver) compute(ctx context.Context) ([]string, int32, bool) {
	r.once.Do(func() {
		totalLines := len(r.lines)
		r.total = int32(totalLines)

		var after int32
		if r.after != nil {
			after = *r.after
		}

		offset := (after + r.first)

		if after < r.total {
			r.linesSubset = r.lines[after:]
		}

		if int(r.first) < len(r.lines) && r.total > offset {
			r.linesSubset = r.linesSubset[:r.first]
		}
		r.hasNextPage = r.total > offset
		if r.hasNextPage {
			r.endCursor = offset
		}
	})
	return r.linesSubset, r.total, r.hasNextPage
}

func (r *batchSpecWorkspaceOutputLinesResolver) TotalCount(ctx context.Context) int32 {
	_, totalCount, _ := r.compute(ctx)
	return totalCount
}

func (r *batchSpecWorkspaceOutputLinesResolver) PageInfo(ctx context.Context) *graphqlutil.PageInfo {
	_, _, hasNextPage := r.compute(ctx)
	if hasNextPage {
		return graphqlutil.NextPageCursor(strconv.Itoa(int(r.endCursor)))
	}
	return graphqlutil.HasNextPage(hasNextPage)
}

func (r *batchSpecWorkspaceOutputLinesResolver) Nodes(ctx context.Context) []string {
	lines, _, _ := r.compute(ctx)
	return lines
}
