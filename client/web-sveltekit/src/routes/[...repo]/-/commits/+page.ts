import { fetchCommits } from '$lib/loader/commits'
import { asStore } from '$lib/utils'
import type { PageLoad } from './$types'

export const load: PageLoad = ({ parent }) => {
    return {
        commits: asStore(
            parent()
                .then(({ resolvedRevision }) => fetchCommits(resolvedRevision))
                .then(result => result?.nodes ?? [])
        ),
    }
}
