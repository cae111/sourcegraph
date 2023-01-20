import type { PageLoad } from './$types'
import { psub } from '$lib/utils'
import { fetchCommits } from '$lib/loader/commits'

export const load: PageLoad = ({ parent }) => {
    return {
        commits: psub(
            parent()
                .then(({ resolvedRevision }) => fetchCommits(resolvedRevision, true))
                .then(result => result?.nodes.slice(0, 5) ?? [])
        ),
    }
}
