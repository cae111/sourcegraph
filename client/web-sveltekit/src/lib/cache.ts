import { browser } from '$app/environment'

const cache: Map<string, unknown> = new Map()
export function cacheInBrowser<T>(value: () => T, key: string): T {
    if (browser) {
        const fromCache = cache.get(key)
        if (fromCache) return fromCache as T
    }

    return value()
}
