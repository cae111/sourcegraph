import type { PageLoad } from './$types'
import { asError, isErrorLike, type ErrorLike } from '@sourcegraph/common'
import { requestGraphQL } from '@sourcegraph/web/src/backend/graphql'
import { fetchTreeEntries } from '@sourcegraph/shared/src/backend/repo'
import { catchError } from 'rxjs/operators/index'
import { asStore } from '$lib/utils'
import { dirname } from 'path'

export const load: PageLoad = ({ parent, params }) => {
    return {
        treeEntries: asStore(
            parent().then(({ resolvedRevision, repoName, revision }) =>
                !isErrorLike(resolvedRevision)
                    ? fetchTreeEntries({
                          repoName: repoName,
                          commitID: resolvedRevision.commitID,
                          revision: revision ?? '',
                          filePath: params.path ? dirname(params.path) : '.',
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
