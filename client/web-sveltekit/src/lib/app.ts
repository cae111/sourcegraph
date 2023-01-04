import { beforeNavigate } from '$app/navigation'
import { page } from '$app/stores'
import { onDestroy } from 'svelte'

const scrollCache: Map<string, number> = new Map()

export function preserveScrollPosition(
    setter: (position: number | undefined) => void,
    getter: () => number | undefined
): void {
    onDestroy(
        page.subscribe($page => {
            setter(scrollCache.get($page.url.toString()))
        })
    )

    beforeNavigate(({ from }) => {
        if (from) {
            const position = getter()
            if (position) {
                scrollCache.set(from?.url.toString(), position)
            }
        }
    })
}
