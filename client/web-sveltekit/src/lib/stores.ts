import { readable } from 'svelte/store'
import { createPlatformContext } from '@sourcegraph/web/src/platform/context'
import type { PlatformContext } from '@sourcegraph/shared/src/platform/context'
import { authenticatedUser as authenticatedUserOG, type AuthenticatedUser } from '@sourcegraph/web/src/auth'

export const platformContext = readable<PlatformContext | null>(null, set => set(createPlatformContext()))
export const authenticatedUser = readable<AuthenticatedUser | null>(null, set => {
    authenticatedUserOG.subscribe(set)
})
