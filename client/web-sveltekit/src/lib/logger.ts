import { PUBLIC_ENABLE_EVENT_LOGGER } from '$env/static/public'
import { eventLogger, type EventLogger } from '@sourcegraph/web/src/tracking/eventLogger'
import { onMount } from 'svelte'

/**
 * Can only be called during component initialization. It logs a view event when
 * the component is mounted (and event logging is enabled).
 */
export function logViewEvent(...args: Parameters<EventLogger['logViewEvent']>) {
    if (PUBLIC_ENABLE_EVENT_LOGGER) {
        onMount(() => {
            eventLogger.logViewEvent(...args)
        })
    }
}
