import { derived, readable, writable, type Readable, type Unsubscriber } from 'svelte/store'
import { createPlatformContext } from '@sourcegraph/web/src/platform/context'
import type { PlatformContext } from '@sourcegraph/shared/src/platform/context'
import { authenticatedUser as authenticatedUserOG, type AuthenticatedUser } from '@sourcegraph/web/src/auth'
import type { RepositoryFields } from '@sourcegraph/web/src/graphql-operations'
import type { Settings } from '@sourcegraph/shared/src/settings/settings'
import { Subscription } from 'rxjs'
import { isErrorLike } from '@sourcegraph/common/src/errors/utils'

export const platformContext = readable<PlatformContext | null>(null, set => set(createPlatformContext()))
export const authenticatedUser = readable<AuthenticatedUser | null>(null, set => {
    const subscription = authenticatedUserOG.subscribe(set)
    return () => subscription.unsubscribe()
})

// FIXME: This returns the previous (cached?) value first, which is not great if
// the user signed out
export const settings: Readable<Settings | null> = (platformContextStore => {
    let unsubscribePlatform: Unsubscriber | null = null
    let settingsSubscription: Subscription = new Subscription()

    return readable<Settings | null>(null, set => {
        if (!unsubscribePlatform) {
            unsubscribePlatform = platformContextStore.subscribe($platformContext => {
                settingsSubscription.add(
                    $platformContext?.settings.subscribe($settings => {
                        console.log($settings)
                        set(isErrorLike($settings.final) ? null : $settings.final)
                    })
                )
            })
        }
        return () => {
            settingsSubscription.unsubscribe()
            unsubscribePlatform?.()
        }
    })
})(platformContext)

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
