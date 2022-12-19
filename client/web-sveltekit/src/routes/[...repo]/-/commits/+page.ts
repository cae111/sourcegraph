import { fetchCommits, fetchRepoCommits } from '$lib/loader/commits'
import { psub } from '$lib/utils'
import type { PageLoad } from './$types'

export const load: PageLoad = ({ parent }) => {
    return {
        preload: {
            commits: psub(
                parent()
                    .then(({ resolvedRevision }) => fetchCommits(resolvedRevision))
                    .then(result => result?.nodes ?? [])
            ),
        },
    }
}
