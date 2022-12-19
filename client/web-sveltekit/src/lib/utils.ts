import { type Readable, writable } from 'svelte/store'

export function psub<T>(promise: Promise<T>): Readable<T | null> {
    const store = writable<T | null>(null)
    promise.then(result => store.set(result))

    return {
        subscribe: store.subscribe,
    }
}
