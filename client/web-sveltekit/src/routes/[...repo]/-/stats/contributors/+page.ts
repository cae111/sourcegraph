import type { PageLoad } from './$types'
import { CONTRIBUTORS_QUERY } from '@sourcegraph/web/src/repo/stats/loader'
import { isErrorLike } from '@sourcegraph/common'
import { asStore } from '$lib/utils'
import { getPaginationParams } from '$lib/Paginator.svelte'
import { map } from 'rxjs/operators/index'
import type {
    PagedRepositoryContributorsResult,
    PagedRepositoryContributorsVariables,
} from '@sourcegraph/web/src/graphql-operations'

const pageSize = 20

const emptyPage: Extract<PagedRepositoryContributorsResult['node'], { __typename: 'Repository' }>['contributors'] = {
    totalCount: 0,
    nodes: [] as any[],
    pageInfo: {
        hasNextPage: false,
        hasPreviousPage: false,
        endCursor: null,
        startCursor: null,
    },
}

export const load: PageLoad = ({ url, parent }) => {
    const afterDate = url.searchParams.get('after') ?? ''
    const { first, last, before, after } = getPaginationParams(url.searchParams, pageSize)

    const contributors = asStore(
        parent().then(({ resolvedRevision, platformContext }) =>
            !isErrorLike(resolvedRevision)
                ? platformContext
                      .requestGraphQL<PagedRepositoryContributorsResult, PagedRepositoryContributorsVariables>({
                          request: CONTRIBUTORS_QUERY,
                          variables: {
                              afterDate,
                              repo: resolvedRevision.repo.id,
                              revisionRange: '',
                              path: '',
                              first,
                              last,
                              after,
                              before,
                          },
                          mightContainPrivateInfo: true,
                      })
                      .pipe(
                          map(result =>
                              result.data?.node?.__typename === 'Repository' ? result.data.node.contributors : emptyPage
                          )
                      )
                      .toPromise()
                : null
        )
    )

    return {
        after: afterDate,
        contributors,
    }
}
