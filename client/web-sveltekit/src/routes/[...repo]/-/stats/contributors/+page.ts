import type { PageLoad } from './$types'
import { CONTRIBUTORS_QUERY } from '@sourcegraph/web/src/repo/stats/loader'
import { isErrorLike } from '@sourcegraph/common'
import { psub } from '$lib/utils'
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
    let last: number | null = null
    let first: number | null = null
    let after: string | null = null
    let before: string | null = null

    if (url.searchParams.has('$before')) {
        last = pageSize
        before = url.searchParams.get('$before')
    } else if (url.searchParams.has('$after')) {
        first = pageSize
        after = url.searchParams.get('$after')
    } else if (url.searchParams.has('$last')) {
        last = pageSize
    } else {
        first = pageSize
    }

    const contributors = psub(
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
