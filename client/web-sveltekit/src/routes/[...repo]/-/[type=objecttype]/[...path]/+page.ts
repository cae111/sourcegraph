import type { PageLoad } from './$types'
import { parseRepoRevision } from '@sourcegraph/shared/src/util/url'
import { fetchHighlight, fetchBlobPlaintext } from '$lib/blob'
import { requestGraphQL } from '@sourcegraph/web/src/backend/graphql'
import { asError, isErrorLike, type ErrorLike } from '@sourcegraph/common'
import { fetchTreeEntries } from '@sourcegraph/shared/src/backend/repo'
import { catchError } from 'rxjs/operators/index'
import { dirname } from 'path'
import { psub } from '$lib/utils'
import { map } from 'rxjs/operators/index'

export const load: PageLoad = ({ params, parent }) => {
    const { repoName, revision } = parseRepoRevision(params.repo)

    const treeEntries = psub(
        parent().then(({ resolvedRevision, revision, repoName }) =>
            !isErrorLike(resolvedRevision)
                ? fetchTreeEntries({
                      repoName: repoName,
                      commitID: resolvedRevision.commitID,
                      revision: revision ?? '',
                      filePath: params.type === 'blob' ? dirname(params.path) : params.path,
                      first: 2500,
                      requestGraphQL: options => requestGraphQL(options.request, options.variables),
                  })
                      .pipe(catchError((error): [ErrorLike] => [asError(error)]))
                      .toPromise()
                : null
        )
    )

    return {
        type: params.type,
        prefetch: {
            blob:
                params.type === 'blob'
                    ? psub(
                          fetchBlobPlaintext({
                              filePath: params.path,
                              repoName,
                              revision: revision ?? '',
                          }).toPromise()
                      )
                    : null,
            highlights:
                params.type === 'blob'
                    ? psub(
                          fetchHighlight({ filePath: params.path, repoName, revision: revision ?? '' })
                              .pipe(map(blob => blob?.highlight.lsif))
                              .toPromise()
                      )
                    : null,
            treeEntries,
        },
    }
}
