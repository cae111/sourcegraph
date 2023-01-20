import { derived, readable, writable, type Readable } from 'svelte/store'
import type { RepositoryFields } from '@sourcegraph/web/src/graphql-operations'
import type { SettingsCascade } from '@sourcegraph/shared/src/settings/settings'
import { getContext } from 'svelte'
import type { AuthenticatedUser } from '@sourcegraph/shared/src/auth'
import type { PlatformContext } from '@sourcegraph/shared/src/platform/context'
import type { TemporarySettingsStorage } from '@sourcegraph/shared/src/settings/temporary/TemporarySettingsStorage'
import { getWebGraphQLClient } from '@sourcegraph/web/src/backend/graphql'
import type { GraphQLClient } from '@sourcegraph/http-client'

export interface SourcegraphContext {
    settings: Readable<SettingsCascade['final'] | null>
    user: Readable<AuthenticatedUser | null>
    platformContext: Readable<PlatformContext | null>
    isLightTheme: Readable<boolean>
    temporarySettingsStorage: Readable<TemporarySettingsStorage>
}

export const KEY = '__sourcegraph__'

export function getStores() {
    const { settings, user, platformContext, isLightTheme, temporarySettingsStorage } =
        getContext<SourcegraphContext>(KEY)
    return { settings, user, platformContext, isLightTheme, temporarySettingsStorage }
}

export const user = {
    subscribe(fn: (user: AuthenticatedUser | null) => void) {
        const { user } = getStores()
        return user.subscribe(fn)
    },
}

export const settings = {
    subscribe(fn: (settings: SettingsCascade['final'] | null) => void) {
        const { settings } = getStores()
        return settings.subscribe(fn)
    },
}

export const platformContext = {
    subscribe(fn: (platformContext: PlatformContext | null) => void) {
        const { platformContext } = getStores()
        return platformContext.subscribe(fn)
    },
}

export const isLightTheme = {
    subscribe(fn: (isLightTheme: boolean) => void) {
        const { isLightTheme } = getStores()
        return isLightTheme.subscribe(fn)
    },
}

/**
 * A store that updates every second to return the current time.
 */
export const currentDate: Readable<Date> = readable(new Date(), set => {
    const interval = setInterval(() => set(new Date()), 1000)
    return () => clearInterval(interval)
})

// TODO: Standardize on getWebGraphQLCient or platformContext.requestGraphQL
export const graphqlClient = readable<GraphQLClient | null>(null, set => {
    getWebGraphQLClient().then(client => set(client))
})

// Proof of concept for updating polling repo for updated information to
// decide when to invalidate
export const resolvedRepo = writable<RepositoryFields>()
export const repoHasNewCommits = derived(
    resolvedRepo,
    (() => {
        let memoRepo: RepositoryFields | null = null
        return $resolvedRepo => {
            let lastRepo = memoRepo
            memoRepo = $resolvedRepo
            if (!lastRepo) {
                return false
            }
            // FIXME: Update GraphQL fields definition
            return lastRepo.commit.author.date <= $resolvedRepo.commit.author.date
        }
    })()
)
