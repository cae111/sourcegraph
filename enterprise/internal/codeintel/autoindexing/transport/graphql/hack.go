package graphql

import (
	"context"
	"fmt"
	"strconv"
	"strings"

	"github.com/graph-gophers/graphql-go"
	"github.com/graph-gophers/graphql-go/relay"

	autoindexingshared "github.com/sourcegraph/sourcegraph/enterprise/internal/codeintel/autoindexing/shared"
	sharedresolvers "github.com/sourcegraph/sourcegraph/enterprise/internal/codeintel/shared/resolvers"
	"github.com/sourcegraph/sourcegraph/enterprise/internal/codeintel/shared/types"
	uploadsshared "github.com/sourcegraph/sourcegraph/enterprise/internal/codeintel/uploads/shared"
	resolverstubs "github.com/sourcegraph/sourcegraph/internal/codeintel/resolvers"
	"github.com/sourcegraph/sourcegraph/internal/gitserver"
	"github.com/sourcegraph/sourcegraph/internal/gqlutil"
	"github.com/sourcegraph/sourcegraph/internal/observation"
	"github.com/sourcegraph/sourcegraph/lib/errors"
)

const DefaultPageSize = 50

func (r *rootResolver) PreciseIndexes(ctx context.Context, args *resolverstubs.PreciseIndexesQueryArgs) (_ resolverstubs.PreciseIndexConnectionResolver, err error) {
	// ctx, traceErrs, endObservation := r.operations.lsifUploadByID.WithErrors(ctx, &err, observation.Args{LogFields: []log.Field{
	// 	log.String("uploadID", string(id)),
	// }})
	// endObservation.OnCancel(ctx, 1, observation.Args{})

	pageSize := DefaultPageSize
	if args.First != nil {
		pageSize = int(*args.First)
	}
	uploadOffset := 0
	indexOffset := 0
	if args.After != nil {
		parts := strings.Split(*args.After, ":")
		if len(parts) != 2 {
			return nil, errors.New("invalid cursor")
		}

		if parts[0] != "" {
			v, err := strconv.Atoi(parts[0])
			if err != nil {
				return nil, errors.New("invalid cursor")
			}

			uploadOffset = v
		}
		if parts[1] != "" {
			v, err := strconv.Atoi(parts[1])
			if err != nil {
				return nil, errors.New("invalid cursor")
			}

			indexOffset = v
		}
	}

	var uploadStates, indexStates []string
	if args.States != nil {
		for _, state := range *args.States {
			switch state {
			case "QUEUED_FOR_INDEXING":
				indexStates = append(indexStates, "queued")
			case "INDEXING":
				indexStates = append(indexStates, "processing")
			case "INDEXING_ERRORED":
				indexStates = append(indexStates, "errored")

			case "UPLOADING_INDEX":
				uploadStates = append(uploadStates, "uploading")
			case "QUEUED_FOR_PROCESSING":
				uploadStates = append(uploadStates, "queued")
			case "PROCESSING":
				uploadStates = append(uploadStates, "processing")
			case "PROCESSING_ERRORED":
				uploadStates = append(uploadStates, "errored")
			case "COMPLETED":
				uploadStates = append(uploadStates, "completed")
			case "DELETING":
				uploadStates = append(uploadStates, "deleting")
			case "DELETED":
				uploadStates = append(uploadStates, "deleted")

			default:
				return nil, errors.Newf("filtering by state %q is unsupported", state)
			}
		}
	}
	skipUploads := len(uploadStates) == 0 && len(indexStates) != 0
	skipIndexes := len(uploadStates) != 0 && len(indexStates) == 0

	var dependencyOf int
	if args.DependencyOf != nil {
		v, err := unmarshalHackGQLID(graphql.ID(*args.DependencyOf))
		if err != nil {
			return nil, err
		}

		dependencyOf = int(v)
		skipIndexes = true
	}
	var dependentOf int
	if args.DependentOf != nil {
		v, err := unmarshalHackGQLID(graphql.ID(*args.DependentOf))
		if err != nil {
			return nil, err
		}

		dependentOf = int(v)
		skipIndexes = true
	}

	var repositoryID int
	if args.Repo != nil {
		v, err := UnmarshalRepositoryID(*args.Repo)
		if err != nil {
			return nil, err
		}

		repositoryID = int(v)
	}

	term := ""
	if args.Query != nil {
		term = *args.Query
	}

	var uploads []types.Upload
	totalUploadCount := 0
	if !skipUploads {
		if uploads, totalUploadCount, err = r.uploadSvc.GetUploads(ctx, uploadsshared.GetUploadsOptions{
			RepositoryID: repositoryID,
			States:       uploadStates,
			Term:         term,
			DependencyOf: dependencyOf,
			DependentOf:  dependentOf,
			Limit:        pageSize,
			Offset:       uploadOffset,
		}); err != nil {
			return nil, err
		}
	}

	var indexes []types.Index
	totalIndexCount := 0
	if !skipIndexes {
		if indexes, totalIndexCount, err = r.autoindexSvc.GetIndexes(ctx, autoindexingshared.GetIndexesOptions{
			RepositoryID:  repositoryID,
			States:        indexStates,
			Term:          term,
			WithoutUpload: true,
			Limit:         pageSize,
			Offset:        indexOffset,
		}); err != nil {
			return nil, err
		}
	}

	type pair struct {
		upload *types.Upload
		index  *types.Index
	}
	pairs := make([]pair, 0, pageSize)
	addUpload := func(upload types.Upload) { pairs = append(pairs, pair{&upload, nil}) }
	addIndex := func(index types.Index) { pairs = append(pairs, pair{nil, &index}) }

	uIdx := 0
	iIdx := 0
	for uIdx < len(uploads) && iIdx < len(indexes) && (uIdx+iIdx) < pageSize {
		if uploads[uIdx].UploadedAt.After(indexes[iIdx].QueuedAt) {
			addUpload(uploads[uIdx])
			uIdx++
		} else {
			addIndex(indexes[iIdx])
			iIdx++
		}
	}
	for uIdx < len(uploads) && (uIdx+iIdx) < pageSize {
		addUpload(uploads[uIdx])
		uIdx++
	}
	for iIdx < len(indexes) && (uIdx+iIdx) < pageSize {
		addIndex(indexes[iIdx])
		iIdx++
	}

	cursor := ""
	if newUploadOffset := uploadOffset + uIdx; newUploadOffset < totalUploadCount {
		cursor += strconv.Itoa(newUploadOffset)
	}
	cursor += ":"
	if newIndexOffset := indexOffset + iIdx; newIndexOffset < totalIndexCount {
		cursor += strconv.Itoa(newIndexOffset)
	}
	if cursor == ":" {
		cursor = ""
	}

	// Create a new prefetcher here as we only want to cache upload and index records in
	// the same graphQL request, not across different request.
	prefetcher := sharedresolvers.NewPrefetcher(r.autoindexSvc, r.uploadSvc)
	db := r.autoindexSvc.GetUnsafeDB()
	locationResolver := sharedresolvers.NewCachedLocationResolver(db, gitserver.NewClient(db))

	for _, pair := range pairs {
		if pair.upload != nil && pair.upload.AssociatedIndexID != nil {
			prefetcher.MarkIndex(*pair.upload.AssociatedIndexID)
		}
	}

	resolvers := make([]resolverstubs.PreciseIndexResolver, 0, len(pairs))
	for _, pair := range pairs {
		resolver, err := NewHackResolver(ctx, r.autoindexSvc, r.uploadSvc, r.policySvc, prefetcher, locationResolver, nil, pair.upload, pair.index)
		if err != nil {
			return nil, err
		}

		resolvers = append(resolvers, resolver)
	}

	return NewHackConnectionResolver(resolvers, totalUploadCount+totalIndexCount, cursor), nil
}

type hackConnectionResolver struct {
	nodes      []resolverstubs.PreciseIndexResolver
	totalCount int
	cursor     string
}

func NewHackConnectionResolver(
	nodes []resolverstubs.PreciseIndexResolver,
	totalCount int,
	cursor string,
) resolverstubs.PreciseIndexConnectionResolver {
	return &hackConnectionResolver{
		nodes:      nodes,
		totalCount: totalCount,
		cursor:     cursor,
	}
}

func (r *rootResolver) PreciseIndexByID(ctx context.Context, id graphql.ID) (_ resolverstubs.PreciseIndexResolver, err error) {
	var v string
	if err := relay.UnmarshalSpec(id, &v); err != nil {
		return nil, err
	}
	parts := strings.Split(v, ":")
	if len(parts) != 2 {
		return nil, errors.New("invalid identifier")
	}
	rawID, err := strconv.Atoi(parts[1])
	if err != nil {
		return nil, errors.New("invalid identifier")
	}

	// Create a new prefetcher here as we only want to cache upload and index records in
	// the same graphQL request, not across different request.
	prefetcher := sharedresolvers.NewPrefetcher(r.autoindexSvc, r.uploadSvc)
	db := r.autoindexSvc.GetUnsafeDB()
	locationResolver := sharedresolvers.NewCachedLocationResolver(db, gitserver.NewClient(db))

	switch parts[0] {
	case "U":
		upload, ok, err := r.uploadSvc.GetUploadByID(ctx, rawID)
		if err != nil || !ok {
			return nil, err
		}

		return NewHackResolver(ctx, r.autoindexSvc, r.uploadSvc, r.policySvc, prefetcher, locationResolver, nil, &upload, nil)

	case "I":
		index, ok, err := r.autoindexSvc.GetIndexByID(ctx, rawID)
		if err != nil || !ok {
			return nil, err
		}

		return NewHackResolver(ctx, r.autoindexSvc, r.uploadSvc, r.policySvc, prefetcher, locationResolver, nil, nil, &index)
	}

	return nil, errors.New("invalid identifier")
}

func (r *hackConnectionResolver) Nodes(ctx context.Context) ([]resolverstubs.PreciseIndexResolver, error) {
	return r.nodes, nil
}

func (r *hackConnectionResolver) TotalCount(ctx context.Context) (*int32, error) {
	count := int32(r.totalCount)
	return &count, nil
}

func (r *hackConnectionResolver) PageInfo(ctx context.Context) (resolverstubs.PageInfo, error) {
	if r.cursor != "" {
		return &pageInfo{hasNextPage: true, endCursor: &r.cursor}, nil
	}

	return &pageInfo{hasNextPage: false}, nil
}

type hackResolver struct {
	upload         *types.Upload
	index          *types.Index
	uploadResolver resolverstubs.LSIFUploadResolver
	indexResolver  resolverstubs.LSIFIndexResolver
}

func NewHackResolver(
	ctx context.Context,
	autoindexingSvc AutoIndexingService,
	uploadsSvc UploadsService,
	policySvc PolicyService,
	prefetcher *sharedresolvers.Prefetcher,
	locationResolver *sharedresolvers.CachedLocationResolver,
	traceErrs *observation.ErrCollector,
	upload *types.Upload,
	index *types.Index,
) (resolverstubs.PreciseIndexResolver, error) {
	var uploadResolver resolverstubs.LSIFUploadResolver
	if upload != nil {
		uploadResolver = sharedresolvers.NewUploadResolver(uploadsSvc, autoindexingSvc, policySvc, *upload, prefetcher, locationResolver, traceErrs)

		if upload.AssociatedIndexID != nil {
			v, ok, err := prefetcher.GetIndexByID(ctx, *upload.AssociatedIndexID)
			if err != nil {
				return nil, err
			}
			if ok {
				index = &v
			}
		}
	}

	var indexResolver resolverstubs.LSIFIndexResolver
	if index != nil {
		indexResolver = sharedresolvers.NewIndexResolver(autoindexingSvc, uploadsSvc, policySvc, *index, prefetcher, locationResolver, traceErrs)
	}

	return &hackResolver{
		upload:         upload,
		index:          index,
		uploadResolver: uploadResolver,
		indexResolver:  indexResolver,
	}, nil
}

func (r *hackResolver) ID() graphql.ID {
	if r.upload != nil {
		return relay.MarshalID("Hack", fmt.Sprintf("U:%d", r.upload.ID))
	}

	return relay.MarshalID("Hack", fmt.Sprintf("I:%d", r.index.ID))
}

func (r *hackResolver) ProjectRoot(ctx context.Context) (resolverstubs.GitTreeEntryResolver, error) {
	if r.uploadResolver != nil {
		return r.uploadResolver.ProjectRoot(ctx)
	}

	return r.indexResolver.ProjectRoot(ctx)
}

func (r *hackResolver) InputCommit() string {
	if r.uploadResolver != nil {
		return r.uploadResolver.InputCommit()
	}

	return r.indexResolver.InputCommit()
}

func (r *hackResolver) Tags(ctx context.Context) ([]string, error) {
	if r.uploadResolver != nil {
		return r.uploadResolver.Tags(ctx)
	}

	return r.indexResolver.Tags(ctx)
}

func (r *hackResolver) InputRoot() string {
	if r.uploadResolver != nil {
		return r.uploadResolver.InputRoot()
	}

	return r.indexResolver.InputRoot()
}

func (r *hackResolver) InputIndexer() string {
	if r.uploadResolver != nil {
		return r.uploadResolver.InputIndexer()
	}

	return r.indexResolver.InputIndexer()
}

func (r *hackResolver) Indexer() resolverstubs.CodeIntelIndexerResolver {
	if r.uploadResolver != nil {
		return r.uploadResolver.Indexer()
	}

	return r.indexResolver.Indexer()
}

func (r *hackResolver) State() string {
	if r.upload != nil {
		switch strings.ToUpper(r.upload.State) {
		case "UPLOADING":
			return "UPLOADING_INDEX"

		case "QUEUED":
			return "QUEUED_FOR_PROCESSING"

		case "PROCESSING":
			return "PROCESSING"

		case "FAILED":
			fallthrough
		case "ERRORED":
			return "PROCESSING_ERRORED"

		case "COMPLETED":
			return "COMPLETED"

		case "DELETING":
			return "DELETING"

		case "DELETED":
			return "DELETED"

		default:
			panic(fmt.Sprintf("unrecognized upload state %q", r.upload.State))
		}
	}

	switch strings.ToUpper(r.index.State) {
	case "QUEUED":
		return "QUEUED_FOR_INDEXING"

	case "PROCESSING":
		return "INDEXING"

	case "FAILED":
		fallthrough
	case "ERRORED":
		return "INDEXING_ERRORED"

	case "COMPLETED":
		// TODO - why would there be no record?
		return "INDEXING_COMPLETED"

	default:
		panic(fmt.Sprintf("unrecognized index state %q", r.index.State))
	}
}

func (r *hackResolver) QueuedAt() *gqlutil.DateTime {
	if r.indexResolver != nil {
		t := r.indexResolver.QueuedAt()
		return &t
	}

	return nil
}

func (r *hackResolver) UploadedAt() *gqlutil.DateTime {
	if r.uploadResolver != nil {
		t := r.uploadResolver.UploadedAt()
		return &t
	}

	return nil
}

func (r *hackResolver) IndexingStartedAt() *gqlutil.DateTime {
	if r.indexResolver != nil {
		return r.indexResolver.StartedAt()
	}

	return nil
}

func (r *hackResolver) ProcessingStartedAt() *gqlutil.DateTime {
	if r.uploadResolver != nil {
		return r.uploadResolver.StartedAt()
	}

	return nil
}

func (r *hackResolver) IndexingFinishedAt() *gqlutil.DateTime {
	if r.indexResolver != nil {
		return r.indexResolver.FinishedAt()
	}

	return nil
}

func (r *hackResolver) ProcessingFinishedAt() *gqlutil.DateTime {
	if r.uploadResolver != nil {
		return r.uploadResolver.FinishedAt()
	}

	return nil
}

func (r *hackResolver) Steps() resolverstubs.IndexStepsResolver {
	if r.indexResolver == nil {
		return nil
	}

	return r.indexResolver.Steps()
}

func (r *hackResolver) Failure() *string {
	if r.upload != nil && r.upload.FailureMessage != nil {
		return r.upload.FailureMessage
	} else if r.index != nil {
		return r.index.FailureMessage
	}

	return nil
}

func (r *hackResolver) PlaceInQueue() *int32 {
	if r.index != nil && r.index.Rank != nil {
		return toInt32(r.index.Rank)
	}

	if r.upload != nil && r.upload.Rank != nil {
		return toInt32(r.upload.Rank)
	}

	return nil
}

func (r *hackResolver) ShouldReindex(ctx context.Context) bool {
	if r.index == nil {
		return false
	}

	return r.index.ShouldReindex
}

func (r *hackResolver) IsLatestForRepo() bool {
	if r.upload == nil {
		return false
	}

	return r.upload.VisibleAtTip
}

func (r *hackResolver) RetentionPolicyOverview(ctx context.Context, args *resolverstubs.LSIFUploadRetentionPolicyMatchesArgs) (resolverstubs.CodeIntelligenceRetentionPolicyMatchesConnectionResolver, error) {
	if r.uploadResolver == nil {
		return nil, nil
	}

	return r.uploadResolver.RetentionPolicyOverview(ctx, args)
}

func (r *hackResolver) AuditLogs(ctx context.Context) (*[]resolverstubs.LSIFUploadsAuditLogsResolver, error) {
	if r.uploadResolver == nil {
		return nil, nil
	}

	return r.uploadResolver.AuditLogs(ctx)
}

func unmarshalHackGQLID(id graphql.ID) (int64, error) {
	var payload string
	if err := relay.UnmarshalSpec(id, &payload); err != nil {
		return 0, err
	}

	parts := strings.Split(payload, ":")
	if len(parts) == 2 || len(parts) == 4 && parts[0] == "U" {
		id, err := strconv.Atoi(parts[1])
		if err != nil {
			return 0, err
		}

		return int64(id), nil
	}

	return 0, errors.New("unexpected hack ID")
}

type pageInfo struct {
	endCursor   *string
	hasNextPage bool
}

func (r *pageInfo) EndCursor() *string { return r.endCursor }
func (r *pageInfo) HasNextPage() bool  { return r.hasNextPage }
