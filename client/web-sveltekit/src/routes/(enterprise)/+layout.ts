import { PUBLIC_SG_ENTERPRISE } from '$env/static/public'
import { error } from '@sveltejs/kit'
import type { LayoutLoad } from './$types'

export const load: LayoutLoad = () => {
    // Example for how we could prevent access to all enterprese specific routes.
    // It's not quite the same as not having the routes at all and have the
    // interpreted differently, like in the current web app.
    if (!PUBLIC_SG_ENTERPRISE) {
        throw error(404, { message: 'enterprise feature' })
    }
}
