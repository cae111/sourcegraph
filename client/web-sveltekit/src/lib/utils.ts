import { type Readable, writable } from 'svelte/store'

type LoadingData<D, E> =
    | { loading: true }
    | { loading: false; data: D; error: null }
    | { loading: false; data: null; error: E }

export function psub<T, E = Error>(promise: Promise<T>): Readable<LoadingData<T, E>> {
    const store = writable<LoadingData<T, E>>({ loading: true })
    promise.then(
        result => store.set({ loading: false, data: result, error: null }),
        error => store.set({ loading: false, data: null, error })
    )

    return {
        subscribe: store.subscribe,
    }
}
