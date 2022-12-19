import type { PageLoad } from './$types'
import { asError, isErrorLike, type ErrorLike } from '@sourcegraph/common'
import { requestGraphQL } from '@sourcegraph/web/src/backend/graphql'
import { fetchTreeEntries } from '@sourcegraph/shared/src/backend/repo'
import { catchError } from 'rxjs/operators/index'
import { psub } from '$lib/utils'
import { fetchCommits } from '$lib/loader/commits'

export const load: PageLoad = ({ parent }) => {
    const treeEntries = psub(
        parent().then(({ resolvedRevision, repoName, revision }) =>
            !isErrorLike(resolvedRevision)
                ? fetchTreeEntries({
                      repoName: repoName,
                      commitID: resolvedRevision.commitID,
                      revision: revision ?? '',
                      filePath: '.',
                      first: 2500,
                      requestGraphQL: options => requestGraphQL(options.request, options.variables),
                  })
                      .pipe(catchError((error): [ErrorLike] => [asError(error)]))
                      .toPromise()
                : null
        )
    )

    return {
        preload: {
            treeEntries,
            commits: psub(
                parent()
                    .then(({ resolvedRevision }) => fetchCommits(resolvedRevision, true))
                    .then(result => result?.nodes.slice(0, 5) ?? [])
            ),
        },
    }
}
