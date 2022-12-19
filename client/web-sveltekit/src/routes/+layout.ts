import { browser } from '$app/environment'
import { refreshAuthenticatedUser } from '@sourcegraph/web/src/auth'
import type { LayoutLoad } from './$types'

// Disable server side rendering for the whole app
export const ssr = false

export const load: LayoutLoad = () => {
    if (browser) {
        globalThis.context = {
            xhrHeaders: {
                'X-Requested-With': 'Sourcegraph',
            },
        }
    }

    return {
        fetchUser: refreshAuthenticatedUser().toPromise(),
    }
}
