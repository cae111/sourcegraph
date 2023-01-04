// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces
/// <reference types="@sveltejs/kit" />

import type { ErrorLike } from '@sourcegraph/common'
import type { ResolvedRevision, Repo } from '@sourcegraph/web/src/repo/backend'

// and what to do when importing types
declare namespace App {
    interface PageData {
        resolvedRevision?: (ResolvedRevision & Repo) | ErrorLike
    }
}

declare namespace svelte.JSX {
    interface HTMLAttribute<T> {
        onintersecting: (event: { detail: boolean }) => void
    }
}
