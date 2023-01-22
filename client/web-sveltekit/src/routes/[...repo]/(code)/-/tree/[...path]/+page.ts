import type { PageLoad } from './$types'
import { requestGraphQL } from '@sourcegraph/web/src/backend/graphql'
import { asError, isErrorLike, type ErrorLike } from '@sourcegraph/common'
import { fetchTreeEntries } from '@sourcegraph/shared/src/backend/repo'
import { catchError } from 'rxjs/operators/index'
import { asStore } from '$lib/utils'

export const load: PageLoad = ({ params, parent }) => {
    return {
        treeEntries: asStore(
            parent().then(({ resolvedRevision, revision, repoName }) =>
                !isErrorLike(resolvedRevision)
                    ? fetchTreeEntries({
                          repoName: repoName,
                          commitID: resolvedRevision.commitID,
                          revision: revision ?? '',
                          filePath: params.path,
                          first: 2500,
                          requestGraphQL: options => requestGraphQL(options.request, options.variables),
                      })
                          .pipe(catchError((error): [ErrorLike] => [asError(error)]))
                          .toPromise()
                    : null
            )
        ),
    }
}
