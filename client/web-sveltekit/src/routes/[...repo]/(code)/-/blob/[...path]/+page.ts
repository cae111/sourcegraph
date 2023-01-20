import type { PageLoad } from './$types'
import { parseRepoRevision } from '@sourcegraph/shared/src/util/url'
import { fetchHighlight, fetchBlobPlaintext } from '$lib/blob'
import { psub } from '$lib/utils'
import { map } from 'rxjs/operators/index'

export const load: PageLoad = ({ params }) => {
    const { repoName, revision } = parseRepoRevision(params.repo)

    return {
        blob: psub(
            fetchBlobPlaintext({
                filePath: params.path,
                repoName,
                revision: revision ?? '',
            }).toPromise()
        ),
        highlights: psub(
            fetchHighlight({ filePath: params.path, repoName, revision: revision ?? '' })
                .pipe(map(blob => blob?.highlight.lsif))
                .toPromise()
        ),
    }
}
