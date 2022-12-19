// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces
// and what to do when importing types
declare namespace App {}

declare namespace svelte.JSX {
    interface HTMLAttribute<T> {
        onintersecting: (event: { detail: boolean }) => void
    }
}
