import type { PageLoad } from './$types'
import { CONTRIBUTORS_QUERY } from '@sourcegraph/web/src/repo/stats/loader'
import { isErrorLike } from '@sourcegraph/common'
import { psub } from '$lib/utils'
import { map } from 'rxjs/operators/index'
import type {
    RepositoryContributorsResult,
    RepositoryContributorsVariables,
} from '@sourcegraph/web/src/graphql-operations'

const emptyPage = {
    totalCount: 0,
    nodes: [] as any[],
    pageInfo: {
        hasNextPage: false,
        hasPreviousPage: false,
        endCursor: undefined,
        startCursor: undefined,
    },
}

export const load: PageLoad = ({ url, parent }) => {
    const after = url.searchParams.get('after') ?? ''

    const contributors = psub(
        parent().then(({ resolvedRevision, platformContext }) =>
            !isErrorLike(resolvedRevision)
                ? platformContext
                      .requestGraphQL<RepositoryContributorsResult, RepositoryContributorsVariables>({
                          request: CONTRIBUTORS_QUERY,
                          variables: {
                              afterDate: after,
                              first: 20,
                              repo: resolvedRevision.repo.id,
                              revisionRange: '',
                              path: '',
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
        search: url.search,
        after,
        contributors,
    }
}
