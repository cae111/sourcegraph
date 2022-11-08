package resolvers

import (
	"context"
	"math"
	"time"

	"github.com/graph-gophers/graphql-go/relay"

	"github.com/sourcegraph/sourcegraph/cmd/frontend/graphqlbackend"
	"github.com/sourcegraph/sourcegraph/enterprise/internal/insights/background/queryrunner"
	"github.com/sourcegraph/sourcegraph/enterprise/internal/insights/scheduler"
	"github.com/sourcegraph/sourcegraph/enterprise/internal/insights/scheduler/iterator"
	"github.com/sourcegraph/sourcegraph/enterprise/internal/insights/store"
	"github.com/sourcegraph/sourcegraph/enterprise/internal/insights/types"
	"github.com/sourcegraph/sourcegraph/internal/actor"
	"github.com/sourcegraph/sourcegraph/internal/auth"
	"github.com/sourcegraph/sourcegraph/internal/database/basestore"
	"github.com/sourcegraph/sourcegraph/internal/gqlutil"
	"github.com/sourcegraph/sourcegraph/lib/errors"
)

var _ graphqlbackend.InsightSeriesMetadataPayloadResolver = &insightSeriesMetadataPayloadResolver{}
var _ graphqlbackend.InsightSeriesMetadataResolver = &insightSeriesMetadataResolver{}
var _ graphqlbackend.InsightSeriesQueryStatusResolver = &insightSeriesQueryStatusResolver{}

func (r *Resolver) UpdateInsightSeries(ctx context.Context, args *graphqlbackend.UpdateInsightSeriesArgs) (graphqlbackend.InsightSeriesMetadataPayloadResolver, error) {
	actr := actor.FromContext(ctx)
	if err := auth.CheckUserIsSiteAdmin(ctx, r.postgresDB, actr.UID); err != nil {
		return nil, err
	}

	if args.Input.Enabled != nil {
		err := r.dataSeriesStore.SetSeriesEnabled(ctx, args.Input.SeriesId, *args.Input.Enabled)
		if err != nil {
			return nil, err
		}
	}

	series, err := r.dataSeriesStore.GetDataSeries(ctx, store.GetDataSeriesArgs{IncludeDeleted: true, SeriesID: args.Input.SeriesId})
	if err != nil {
		return nil, err
	}
	if len(series) == 0 {
		return nil, errors.Newf("unable to fetch series with series_id: %v", args.Input.SeriesId)
	}
	return &insightSeriesMetadataPayloadResolver{series: &series[0]}, nil
}

func (r *Resolver) InsightSeriesQueryStatus(ctx context.Context) ([]graphqlbackend.InsightSeriesQueryStatusResolver, error) {
	actr := actor.FromContext(ctx)
	if err := auth.CheckUserIsSiteAdmin(ctx, r.postgresDB, actr.UID); err != nil {
		return nil, err
	}

	// this will get the queue information from the primary postgres database
	seriesStatus, err := queryrunner.QueryAllSeriesStatus(ctx, r.workerBaseStore)
	if err != nil {
		return nil, err
	}

	// need to do a manual join with metadata since this lives in a separate database.
	seriesMetadata, err := r.dataSeriesStore.GetDataSeries(ctx, store.GetDataSeriesArgs{IncludeDeleted: true})
	if err != nil {
		return nil, err
	}
	// index the metadata by seriesId to perform lookups
	metadataBySeries := make(map[string]*types.InsightSeries)
	for i, series := range seriesMetadata {
		metadataBySeries[series.SeriesID] = &seriesMetadata[i]
	}

	var resolvers []graphqlbackend.InsightSeriesQueryStatusResolver
	// we will treat the results from the queue as the "primary" and perform a left join on query metadata. That way
	// we never have a situation where we can't inspect the records in the queue, that's the entire point of this operation.
	for _, status := range seriesStatus {
		var id *int
		if series, ok := metadataBySeries[status.SeriesId]; ok {
			status.Query = series.Query
			status.Enabled = series.Enabled
			id = &series.ID
		}

		resolvers = append(resolvers, &insightSeriesQueryStatusResolver{workerBaseStore: r.workerBaseStore, status: status, seriesID: status.SeriesId, id: id})
	}
	return resolvers, nil
}

func (r *Resolver) InsightViewDebug(ctx context.Context, args graphqlbackend.InsightViewDebugArgs) (graphqlbackend.InsightViewDebugResolver, error) {
	actr := actor.FromContext(ctx)
	if err := auth.CheckUserIsSiteAdmin(ctx, r.postgresDB, actr.UID); err != nil {
		return nil, err
	}
	var viewId string
	err := relay.UnmarshalSpec(args.Id, &viewId)
	if err != nil {
		return nil, errors.Wrap(err, "error unmarshalling the insight view id")
	}

	// 🚨 SECURITY: This debug resolver is restricted to admins only so looking up the series does not check for the users authoriztion
	viewSeries, err := r.insightStore.Get(ctx, store.InsightQueryArgs{UniqueID: viewId, WithoutAuthorization: true})
	if err != nil {
		return nil, err
	}

	resolver := &insightViewDebugResolver{
		insightViewID:   viewId,
		viewSeries:      viewSeries,
		workerBaseStore: r.workerBaseStore,
		backfillStore:   scheduler.NewBackfillStore(r.insightsDB),
	}
	return resolver, nil
}

type insightSeriesMetadataPayloadResolver struct {
	series *types.InsightSeries
}

func (i *insightSeriesMetadataPayloadResolver) Series(ctx context.Context) graphqlbackend.InsightSeriesMetadataResolver {
	return &insightSeriesMetadataResolver{series: i.series}
}

type insightSeriesMetadataResolver struct {
	series *types.InsightSeries
}

func (i *insightSeriesMetadataResolver) SeriesId(ctx context.Context) (string, error) {
	return i.series.SeriesID, nil
}

func (i *insightSeriesMetadataResolver) Query(ctx context.Context) (string, error) {
	return i.series.Query, nil
}

func (i *insightSeriesMetadataResolver) Enabled(ctx context.Context) (bool, error) {
	return i.series.Enabled, nil
}

type insightSeriesQueryStatusResolver struct {
	status          types.InsightSeriesStatus
	seriesID        string
	id              *int
	workerBaseStore *basestore.Store
	backfillStore   *scheduler.BackfillStore
}

func (i *insightSeriesQueryStatusResolver) SeriesId(ctx context.Context) (string, error) {
	return i.status.SeriesId, nil
}

func (i *insightSeriesQueryStatusResolver) Query(ctx context.Context) (string, error) {
	return i.status.Query, nil
}

func (i *insightSeriesQueryStatusResolver) Enabled(ctx context.Context) (bool, error) {
	return i.status.Enabled, nil
}

func (i *insightSeriesQueryStatusResolver) Errored(ctx context.Context) (int32, error) {
	return int32(i.status.Errored), nil
}

func (i *insightSeriesQueryStatusResolver) Completed(ctx context.Context) (int32, error) {
	return int32(i.status.Completed), nil
}

func (i *insightSeriesQueryStatusResolver) Processing(ctx context.Context) (int32, error) {
	return int32(i.status.Processing), nil
}

func (i *insightSeriesQueryStatusResolver) Failed(ctx context.Context) (int32, error) {
	return int32(i.status.Failed), nil
}

func (i *insightSeriesQueryStatusResolver) Queued(ctx context.Context) (int32, error) {
	return int32(i.status.Queued), nil
}

func (i *insightSeriesQueryStatusResolver) QueueSearchFailures(ctx context.Context, args graphqlbackend.QueueSearchFailuresArgs) ([]graphqlbackend.InsightSearchErrorResolver, error) {
	seriesFailures, err := queryrunner.QuerySeriesSearchFailures(ctx, i.workerBaseStore, i.seriesID, int(args.Limit))
	if err != nil {
		return nil, err
	}
	resolvers := make([]graphqlbackend.InsightSearchErrorResolver, 0, len(seriesFailures))
	for i := 0; i < len(seriesFailures); i++ {
		resolvers = append(resolvers, &insightSearchErrorResolver{failure: seriesFailures[i]})
	}

	return resolvers, nil
}

func (i *insightSeriesQueryStatusResolver) Backfills(ctx context.Context) ([]graphqlbackend.InsightSeriesBackfillDebugResolver, error) {
	if i.id == nil {
		return nil, nil
	}

	backfillDebugInfo, err := i.backfillStore.LoadSeriesBackfillsDebugInfo(ctx, *i.id)
	if err != nil {
		return nil, err
	}
	resolvers := make([]graphqlbackend.InsightSeriesBackfillDebugResolver, 0, len(backfillDebugInfo))
	for i := 0; i < len(backfillDebugInfo); i++ {
		resolvers = append(resolvers, &insightBackfillDebugResolver{backfill: backfillDebugInfo[i]})
	}
	return resolvers, nil
}

type insightBackfillDebugResolver struct {
	backfill scheduler.SeriesBackfillDebug
}

func (r *insightBackfillDebugResolver) EstimatedCost(ctx context.Context) (float64, error) {
	return r.backfill.Info.EstimatedCost, nil
}

func (r *insightBackfillDebugResolver) State(ctx context.Context) (string, error) {
	return string(r.backfill.Info.State), nil
}

func (r *insightBackfillDebugResolver) NumberOfRepos(ctx context.Context) (*int32, error) {
	if r.backfill.Info.NumRepos == nil {
		return nil, nil
	}
	num := int32(*r.backfill.Info.NumRepos)
	return &num, nil
}

func (r *insightBackfillDebugResolver) PercentComplete(ctx context.Context) (*int32, error) {
	if r.backfill.Info.PercentComplete == nil {
		return nil, nil
	}

	percentComplete := int32(math.RoundToEven(*r.backfill.Info.PercentComplete * 100.0))
	return &percentComplete, nil
}

func (r *insightBackfillDebugResolver) RuntimeSeconds(ctx context.Context) (*int32, error) {
	if r.backfill.Info.RuntimeDuration != nil {
		duration := time.Duration(*r.backfill.Info.RuntimeDuration)
		seconds := int32(duration / time.Second)
		return &seconds, nil
	}
	return nil, nil
}

func (r *insightBackfillDebugResolver) StartedAt(ctx context.Context) (*gqlutil.DateTime, error) {
	return gqlutil.DateTimeOrNil(r.backfill.Info.StartedAt), nil

}

func (r *insightBackfillDebugResolver) CompletedAt(ctx context.Context) (*gqlutil.DateTime, error) {
	return gqlutil.DateTimeOrNil(r.backfill.Info.CompletedAt), nil
}

func (r *insightBackfillDebugResolver) Errors(ctx context.Context) []graphqlbackend.InsightSeriesBackfillErrorResolver {
	resolvers := make([]graphqlbackend.InsightSeriesBackfillErrorResolver, 0, len(r.backfill.Errors))
	for _, backfillError := range r.backfill.Errors {
		resolvers = append(resolvers, &backfillErrorResolver{backfillError: backfillError})
	}
	return resolvers
}

type backfillErrorResolver struct {
	backfillError iterator.IterationError
}

func (r *backfillErrorResolver) RepoId(ctx context.Context) (int32, error) {
	return r.backfillError.RepoId, nil
}
func (r *backfillErrorResolver) Messages(ctx context.Context) ([]string, error) {
	return r.backfillError.ErrorMessages, nil
}

type insightSearchErrorResolver struct {
	failure types.InsightSearchFailure
}

func (i *insightSearchErrorResolver) Query(ctx context.Context) (string, error) {
	return i.failure.Query, nil
}

func (i *insightSearchErrorResolver) QueuedAt(ctx context.Context) (gqlutil.DateTime, error) {
	return gqlutil.DateTime{Time: i.failure.QueuedAt}, nil
}

func (i *insightSearchErrorResolver) RecordTime(ctx context.Context) (*gqlutil.DateTime, error) {
	return gqlutil.DateTimeOrNil(i.failure.RecordTime), nil
}

func (i *insightSearchErrorResolver) SearchMode(ctx context.Context) (string, error) {
	return i.failure.PersistMode, nil
}

func (i *insightSearchErrorResolver) FailureMessage(ctx context.Context) (string, error) {
	return i.failure.FailureMessage, nil
}

func (i *insightSearchErrorResolver) State(ctx context.Context) (string, error) {
	return i.failure.State, nil
}

type insightViewDebugResolver struct {
	insightViewID   string
	viewSeries      []types.InsightViewSeries
	workerBaseStore *basestore.Store
	backfillStore   *scheduler.BackfillStore
}

func (r *insightViewDebugResolver) Series(ctx context.Context) ([]graphqlbackend.InsightSeriesQueryStatusResolver, error) {

	ids := make([]string, 0, len(r.viewSeries))
	for i := 0; i < len(r.viewSeries); i++ {
		ids = append(ids, r.viewSeries[i].SeriesID)
	}

	// this will get the queue information from the primary postgres database
	seriesStatus, err := queryrunner.QuerySeriesStatus(ctx, r.workerBaseStore, ids)
	if err != nil {
		return nil, err
	}

	// index the metadata by seriesId to perform lookups
	queueStatusBySeries := make(map[string]*types.InsightSeriesStatus)
	for i, status := range seriesStatus {
		queueStatusBySeries[status.SeriesId] = &seriesStatus[i]
	}

	var resolvers []graphqlbackend.InsightSeriesQueryStatusResolver
	// we will treat the results from the queue as the "secondary" and left join it to the series metadata.

	for _, series := range r.viewSeries {
		status := types.InsightSeriesStatus{
			SeriesId: series.SeriesID,
			Query:    series.Query,
			Enabled:  true,
		}
		if tmpStatus, ok := queueStatusBySeries[series.SeriesID]; ok {
			status.Completed = tmpStatus.Completed
			status.Enabled = tmpStatus.Enabled
			status.Errored = tmpStatus.Errored
			status.Failed = tmpStatus.Failed
			status.Queued = tmpStatus.Queued
			status.Processing = tmpStatus.Processing
		}
		id := series.InsightSeriesID

		resolvers = append(resolvers, &insightSeriesQueryStatusResolver{backfillStore: r.backfillStore, workerBaseStore: r.workerBaseStore, status: status, seriesID: status.SeriesId, id: &id})
	}
	return resolvers, nil
}
