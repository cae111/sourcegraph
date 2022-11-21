import type { PageLoad } from './$types'
import { parseRepoRevision } from '@sourcegraph/shared/src/util/url'
import { fetchBlob } from '$lib/blob'
import { HighlightResponseFormat } from '@sourcegraph/search'

export const load: PageLoad = async ({ url, params }) => {
    const { repoName, revision, rawRevision } = parseRepoRevision(params.repo)
    return fetchBlob({
        filePath: params.file,
        repoName,
        revision: revision ?? '',
        format: HighlightResponseFormat.JSON_SCIP,
    }).toPromise()

    return { blob: { blob } }
}

export const ssr = false
