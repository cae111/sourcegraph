import type { PageLoad } from './$types'
import { parseRepoRevision } from '@sourcegraph/shared/src/util/url'
import { fetchBlob } from '$lib/blob'
import { HighlightResponseFormat } from '@sourcegraph/search'
import { requestGraphQL } from '@sourcegraph/web/src/backend/graphql'
import { asError, isErrorLike, type ErrorLike } from '@sourcegraph/common'
import { fetchTreeEntries } from '@sourcegraph/shared/src/backend/repo'
import { catchError, startWith } from 'rxjs/operators/index'
import { dirname } from 'path'
import { psub } from '$lib/utils'

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

    const blob =
        params.type === 'blob'
            ? fetchBlob({
                  filePath: params.path,
                  repoName,
                  revision: revision ?? '',
                  format: HighlightResponseFormat.JSON_SCIP,
              }).toPromise()
            : null

    return {
        type: params.type,
        prefetch: {
            blob,
            treeEntries,
        },
    }
}
