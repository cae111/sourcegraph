package graphqlbackend

import (
	"context"

	"github.com/graph-gophers/graphql-go"

	"github.com/sourcegraph/sourcegraph/cmd/frontend/graphqlbackend/graphqlutil"
	"github.com/sourcegraph/sourcegraph/internal/api"
	autoindexinggraphql "github.com/sourcegraph/sourcegraph/internal/codeintel/autoindexing/transport/graphql"
	codenav "github.com/sourcegraph/sourcegraph/internal/codeintel/codenav/transport/graphql"
	policiesgraphql "github.com/sourcegraph/sourcegraph/internal/codeintel/policies/transport/graphql"
	"github.com/sourcegraph/sourcegraph/internal/codeintel/sharedresolvers"
	resolvers "github.com/sourcegraph/sourcegraph/internal/codeintel/sharedresolvers"
	uploadsgraphql "github.com/sourcegraph/sourcegraph/internal/codeintel/uploads/transport/graphql"
	executor "github.com/sourcegraph/sourcegraph/internal/services/executors/transport/graphql"
	"github.com/sourcegraph/sourcegraph/internal/types"
)

type CodeIntelResolver interface {
	GitBlobLSIFData(ctx context.Context, args *GitBlobLSIFDataArgs) (GitBlobLSIFDataResolver, error)
	GitBlobCodeIntelInfo(ctx context.Context, args *autoindexinggraphql.GitTreeEntryCodeIntelInfoArgs) (_ autoindexinggraphql.GitBlobCodeIntelSupportResolver, err error)
	GitTreeCodeIntelInfo(ctx context.Context, args *autoindexinggraphql.GitTreeEntryCodeIntelInfoArgs) (resolver autoindexinggraphql.GitTreeCodeIntelSupportResolver, err error)
	RequestLanguageSupport(ctx context.Context, args *autoindexinggraphql.RequestLanguageSupportArgs) (*resolvers.EmptyResponse, error)
	RequestedLanguageSupport(ctx context.Context) ([]string, error)

	NodeResolvers() map[string]NodeByIDFunc

	AutoindexingServiceResolver
	ExecutorResolver
	UploadsServiceResolver
	PoliciesServiceResolver
}

type ExecutorResolver interface {
	ExecutorResolver() executor.Resolver
}

type CodeNavResolver interface {
	CodeNavResolver() codenav.Resolver
}

type AutoindexingServiceResolver interface {
	IndexConfiguration(ctx context.Context, id graphql.ID) (IndexConfigurationResolver, error) // TODO - rename ...ForRepo
	DeleteLSIFIndex(ctx context.Context, args *struct{ ID graphql.ID }) (*resolvers.EmptyResponse, error)
	LSIFIndexByID(ctx context.Context, id graphql.ID) (_ resolvers.LSIFIndexResolver, err error)
	LSIFIndexes(ctx context.Context, args *autoindexinggraphql.LSIFIndexesQueryArgs) (resolvers.LSIFIndexConnectionResolver, error)
	LSIFIndexesByRepo(ctx context.Context, args *autoindexinggraphql.LSIFRepositoryIndexesQueryArgs) (resolvers.LSIFIndexConnectionResolver, error)
	QueueAutoIndexJobsForRepo(ctx context.Context, args *autoindexinggraphql.QueueAutoIndexJobsForRepoArgs) ([]resolvers.LSIFIndexResolver, error)
	UpdateRepositoryIndexConfiguration(ctx context.Context, args *autoindexinggraphql.UpdateRepositoryIndexConfigurationArgs) (*resolvers.EmptyResponse, error)
	RepositorySummary(ctx context.Context, id graphql.ID) (resolvers.CodeIntelRepositorySummaryResolver, error)
}

type UploadsServiceResolver interface {
	CommitGraph(ctx context.Context, id graphql.ID) (uploadsgraphql.CodeIntelligenceCommitGraphResolver, error)
	LSIFUploadByID(ctx context.Context, id graphql.ID) (resolvers.LSIFUploadResolver, error)
	LSIFUploads(ctx context.Context, args *uploadsgraphql.LSIFUploadsQueryArgs) (resolvers.LSIFUploadConnectionResolver, error)
	LSIFUploadsByRepo(ctx context.Context, args *uploadsgraphql.LSIFRepositoryUploadsQueryArgs) (resolvers.LSIFUploadConnectionResolver, error)
	DeleteLSIFUpload(ctx context.Context, args *struct{ ID graphql.ID }) (*resolvers.EmptyResponse, error)
}
type PoliciesServiceResolver interface {
	CodeIntelligenceConfigurationPolicies(ctx context.Context, args *policiesgraphql.CodeIntelligenceConfigurationPoliciesArgs) (policiesgraphql.CodeIntelligenceConfigurationPolicyConnectionResolver, error)
	ConfigurationPolicyByID(ctx context.Context, id graphql.ID) (policiesgraphql.CodeIntelligenceConfigurationPolicyResolver, error)
	CreateCodeIntelligenceConfigurationPolicy(ctx context.Context, args *policiesgraphql.CreateCodeIntelligenceConfigurationPolicyArgs) (policiesgraphql.CodeIntelligenceConfigurationPolicyResolver, error)
	DeleteCodeIntelligenceConfigurationPolicy(ctx context.Context, args *policiesgraphql.DeleteCodeIntelligenceConfigurationPolicyArgs) (*sharedresolvers.EmptyResponse, error)
	PreviewGitObjectFilter(ctx context.Context, id graphql.ID, args *policiesgraphql.PreviewGitObjectFilterArgs) ([]policiesgraphql.GitObjectFilterPreviewResolver, error)
	PreviewRepositoryFilter(ctx context.Context, args *policiesgraphql.PreviewRepositoryFilterArgs) (policiesgraphql.RepositoryFilterPreviewResolver, error)
	UpdateCodeIntelligenceConfigurationPolicy(ctx context.Context, args *policiesgraphql.UpdateCodeIntelligenceConfigurationPolicyArgs) (*sharedresolvers.EmptyResponse, error)
}

type LSIFUploadsQueryArgs struct {
	graphqlutil.ConnectionArgs
	Query           *string
	State           *string
	IsLatestForRepo *bool
	DependencyOf    *graphql.ID
	DependentOf     *graphql.ID
	After           *string
	IncludeDeleted  *bool
}

type LSIFRepositoryUploadsQueryArgs struct {
	*LSIFUploadsQueryArgs
	RepositoryID graphql.ID
}

type LSIFUploadRetentionPolicyMatchesArgs struct {
	MatchesOnly bool
	First       *int32
	After       *string
	Query       *string
}

// type LSIFUploadResolver interface {
// 	ID() graphql.ID
// 	InputCommit() string
// 	Tags(ctx context.Context) ([]string, error)
// 	InputRoot() string
// 	IsLatestForRepo() bool
// 	UploadedAt() DateTime
// 	State() string
// 	Failure() *string
// 	StartedAt() *DateTime
// 	FinishedAt() *DateTime
// 	InputIndexer() string
// 	Indexer() codeinteltypes.CodeIntelIndexerResolver
// 	PlaceInQueue() *int32
// 	AssociatedIndex(ctx context.Context) (LSIFIndexResolver, error)
// 	ProjectRoot(ctx context.Context) (*GitTreeEntryResolver, error)
// 	RetentionPolicyOverview(ctx context.Context, args *LSIFUploadRetentionPolicyMatchesArgs) (CodeIntelligenceRetentionPolicyMatchesConnectionResolver, error)
// 	DocumentPaths(ctx context.Context, args *LSIFUploadDocumentPathsQueryArgs) (LSIFUploadDocumentPathsConnectionResolver, error)
// 	AuditLogs(ctx context.Context) (*[]LSIFUploadsAuditLogsResolver, error)
// }

// type LSIFUploadConnectionResolver interface {
// 	Nodes(ctx context.Context) ([]LSIFUploadResolver, error)
// 	TotalCount(ctx context.Context) (*int32, error)
// 	PageInfo(ctx context.Context) (*graphqlutil.PageInfo, error)
// }

// type LSIFUploadDocumentPathsQueryArgs struct {
// 	Pattern string
// }

// type LSIFUploadDocumentPathsConnectionResolver interface {
// 	Nodes(ctx context.Context) ([]string, error)
// 	TotalCount(ctx context.Context) (*int32, error)
// }

// type LSIFUploadsAuditLogsResolver interface {
// 	LogTimestamp() DateTime
// 	UploadDeletedAt() *DateTime
// 	Reason() *string
// 	ChangedColumns() []AuditLogColumnChange
// 	UploadID() graphql.ID
// 	InputCommit() string
// 	InputRoot() string
// 	InputIndexer() string
// 	UploadedAt() DateTime
// 	Operation() string
// 	// AssociatedIndex(ctx context.Context) (LSIFIndexResolver, error)
// }

// type AuditLogColumnChange interface {
// 	Column() string
// 	Old() *string
// 	New() *string
// }

// type LSIFIndexesQueryArgs struct {
// 	graphqlutil.ConnectionArgs
// 	Query *string
// 	State *string
// 	After *string
// }

// type LSIFRepositoryIndexesQueryArgs struct {
// 	*LSIFIndexesQueryArgs
// 	RepositoryID graphql.ID
// }

// type LSIFIndexResolver interface {
// 	ID() graphql.ID
// 	InputCommit() string
// 	Tags(ctx context.Context) ([]string, error)
// 	InputRoot() string
// 	InputIndexer() string
// 	Indexer() codeinteltypes.CodeIntelIndexerResolver
// 	QueuedAt() DateTime
// 	State() string
// 	Failure() *string
// 	StartedAt() *DateTime
// 	FinishedAt() *DateTime
// 	Steps() IndexStepsResolver
// 	PlaceInQueue() *int32
// 	AssociatedUpload(ctx context.Context) (LSIFUploadResolver, error)
// 	ProjectRoot(ctx context.Context) (*GitTreeEntryResolver, error)
// }

// type IndexStepsResolver interface {
// 	Setup() []ExecutionLogEntryResolver
// 	PreIndex() []PreIndexStepResolver
// 	Index() IndexStepResolver
// 	Upload() ExecutionLogEntryResolver
// 	Teardown() []ExecutionLogEntryResolver
// }

// type PreIndexStepResolver interface {
// 	Root() string
// 	Image() string
// 	Commands() []string
// 	LogEntry() ExecutionLogEntryResolver
// }

// type IndexStepResolver interface {
// 	IndexerArgs() []string
// 	Outfile() *string
// 	LogEntry() ExecutionLogEntryResolver
// }

// type LSIFIndexConnectionResolver interface {
// 	Nodes(ctx context.Context) ([]LSIFIndexResolver, error)
// 	TotalCount(ctx context.Context) (*int32, error)
// 	PageInfo(ctx context.Context) (*graphqlutil.PageInfo, error)
// }

// type QueueAutoIndexJobsForRepoArgs struct {
// 	Repository    graphql.ID
// 	Rev           *string
// 	Configuration *string
// }

type GitTreeLSIFDataResolver interface {
	LSIFUploads(ctx context.Context) ([]sharedresolvers.LSIFUploadResolver, error)
	Diagnostics(ctx context.Context, args *LSIFDiagnosticsArgs) (DiagnosticConnectionResolver, error)
}

// type CodeIntelligenceCommitGraphResolver interface {
// 	Stale(ctx context.Context) (bool, error)
// 	UpdatedAt(ctx context.Context) (*DateTime, error)
// }

type GitBlobLSIFDataResolver interface {
	GitTreeLSIFDataResolver
	ToGitTreeLSIFData() (GitTreeLSIFDataResolver, bool)
	ToGitBlobLSIFData() (GitBlobLSIFDataResolver, bool)

	Stencil(ctx context.Context) ([]RangeResolver, error)
	Ranges(ctx context.Context, args *LSIFRangesArgs) (CodeIntelligenceRangeConnectionResolver, error)
	Definitions(ctx context.Context, args *LSIFQueryPositionArgs) (LocationConnectionResolver, error)
	References(ctx context.Context, args *LSIFPagedQueryPositionArgs) (LocationConnectionResolver, error)
	Implementations(ctx context.Context, args *LSIFPagedQueryPositionArgs) (LocationConnectionResolver, error)
	Hover(ctx context.Context, args *LSIFQueryPositionArgs) (HoverResolver, error)
}

type GitBlobLSIFDataArgs struct {
	Repo      *types.Repo
	Commit    api.CommitID
	Path      string
	ExactPath bool
	ToolName  string
}

type LSIFRangesArgs struct {
	StartLine int32
	EndLine   int32
}

type LSIFQueryPositionArgs struct {
	Line      int32
	Character int32
	Filter    *string
}

type LSIFPagedQueryPositionArgs struct {
	LSIFQueryPositionArgs
	graphqlutil.ConnectionArgs
	After  *string
	Filter *string
}

type LSIFDiagnosticsArgs struct {
	graphqlutil.ConnectionArgs
}

type CodeIntelligenceRangeConnectionResolver interface {
	Nodes(ctx context.Context) ([]CodeIntelligenceRangeResolver, error)
}

type CodeIntelligenceRangeResolver interface {
	Range(ctx context.Context) (RangeResolver, error)
	Definitions(ctx context.Context) (LocationConnectionResolver, error)
	References(ctx context.Context) (LocationConnectionResolver, error)
	Implementations(ctx context.Context) (LocationConnectionResolver, error)
	Hover(ctx context.Context) (HoverResolver, error)
}

type LocationConnectionResolver interface {
	Nodes(ctx context.Context) ([]LocationResolver, error)
	PageInfo(ctx context.Context) (*graphqlutil.PageInfo, error)
}

type HoverResolver interface {
	Markdown() Markdown
	Range() RangeResolver
}

type DiagnosticConnectionResolver interface {
	Nodes(ctx context.Context) ([]DiagnosticResolver, error)
	TotalCount(ctx context.Context) (int32, error)
	PageInfo(ctx context.Context) (*graphqlutil.PageInfo, error)
}

type DiagnosticResolver interface {
	Severity() (*string, error)
	Code() (*string, error)
	Source() (*string, error)
	Message() (*string, error)
	Location(ctx context.Context) (LocationResolver, error)
}

// type CodeIntelConfigurationPolicy struct {
// 	Name                      string
// 	RepositoryID              *int32
// 	RepositoryPatterns        *[]string
// 	Type                      GitObjectType
// 	Pattern                   string
// 	RetentionEnabled          bool
// 	RetentionDurationHours    *int32
// 	RetainIntermediateCommits bool
// 	IndexingEnabled           bool
// 	IndexCommitMaxAgeHours    *int32
// 	IndexIntermediateCommits  bool
// }

// type CodeIntelligenceConfigurationPoliciesArgs struct {
// 	graphqlutil.ConnectionArgs
// 	Repository       *graphql.ID
// 	Query            *string
// 	ForDataRetention *bool
// 	ForIndexing      *bool
// 	After            *string
// }

// type CreateCodeIntelligenceConfigurationPolicyArgs struct {
// 	Repository *graphql.ID
// 	CodeIntelConfigurationPolicy
// }

// type UpdateCodeIntelligenceConfigurationPolicyArgs struct {
// 	ID         graphql.ID
// 	Repository *graphql.ID
// 	CodeIntelConfigurationPolicy
// }

// type DeleteCodeIntelligenceConfigurationPolicyArgs struct {
// 	Policy graphql.ID
// }

type IndexConfigurationResolver interface {
	Configuration(ctx context.Context) (*string, error)
	InferredConfiguration(ctx context.Context) (*string, error)
}

type UpdateRepositoryIndexConfigurationArgs struct {
	Repository    graphql.ID
	Configuration string
}

type PreviewRepositoryFilterArgs struct {
	graphqlutil.ConnectionArgs
	Patterns []string
	After    *string
}

// type RepositoryFilterPreviewResolver interface {
// 	Nodes() []*RepositoryResolver
// 	TotalCount() int32
// 	Limit() *int32
// 	TotalMatches() int32
// 	PageInfo() *graphqlutil.PageInfo
// }

// type PreviewGitObjectFilterArgs struct {
// 	Type    GitObjectType
// 	Pattern string
// }

// type GitObjectFilterPreviewResolver interface {
// 	Name() string
// 	Rev() string
// }

// type CodeIntelligenceConfigurationPolicyConnectionResolver interface {
// 	Nodes(ctx context.Context) ([]CodeIntelligenceConfigurationPolicyResolver, error)
// 	TotalCount(ctx context.Context) (*int32, error)
// 	PageInfo(ctx context.Context) (*graphqlutil.PageInfo, error)
// }

// type CodeIntelligenceConfigurationPolicyResolver interface {
// 	ID() graphql.ID
// 	Repository(ctx context.Context) (*RepositoryResolver, error)
// 	RepositoryPatterns() *[]string
// 	Name() string
// 	Type() (GitObjectType, error)
// 	Pattern() string
// 	Protected() bool
// 	RetentionEnabled() bool
// 	RetentionDurationHours() *int32
// 	RetainIntermediateCommits() bool
// 	IndexingEnabled() bool
// 	IndexCommitMaxAgeHours() *int32
// 	IndexIntermediateCommits() bool
// }

// type CodeIntelligenceRetentionPolicyMatchesConnectionResolver interface {
// 	Nodes(ctx context.Context) ([]CodeIntelligenceRetentionPolicyMatchResolver, error)
// 	TotalCount(ctx context.Context) (*int32, error)
// 	PageInfo(ctx context.Context) (*graphqlutil.PageInfo, error)
// }

// type CodeIntelligenceRetentionPolicyMatchResolver interface {
// 	ConfigurationPolicy() CodeIntelligenceConfigurationPolicyResolver
// 	Matches() bool
// 	ProtectingCommits() *[]string
// }

// type GitTreeEntryCodeIntelInfoArgs struct {
// 	Repo   *types.Repo
// 	Path   string
// 	Commit string
// }

// type GitTreeCodeIntelSupportResolver interface {
// 	SearchBasedSupport(context.Context) (*[]GitTreeSearchBasedCoverage, error)
// 	PreciseSupport(context.Context) (*[]GitTreePreciseCoverage, error)
// }

// type GitTreeSearchBasedCoverage interface {
// 	CoveredPaths() []string
// 	Support() SearchBasedSupportResolver
// }

// type GitTreePreciseCoverage interface {
// 	Support() PreciseSupportResolver
// 	Confidence() string
// }

// type GitBlobCodeIntelSupportResolver interface {
// 	SearchBasedSupport(context.Context) (SearchBasedSupportResolver, error)
// 	PreciseSupport(context.Context) (PreciseSupportResolver, error)
// }

// type PreciseSupportResolver interface {
// 	SupportLevel() string
// 	Indexers() *[]CodeIntelIndexerResolver
// }

// type CodeIntelIndexerResolver interface {
// 	Name() string
// 	URL() string
// }

// type SearchBasedSupportResolver interface {
// 	SupportLevel() string
// 	Language() string
// }

// type RequestLanguageSupportArgs struct {
// 	Language string
// }
