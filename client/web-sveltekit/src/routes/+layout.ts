import { browser } from '$app/environment'
import { isErrorLike } from '@sourcegraph/common'
import { currentAuthStateQuery } from '@sourcegraph/shared/src/auth'
import type { CurrentAuthStateResult } from '@sourcegraph/shared/src/graphql-operations'
import { requestGraphQL } from '@sourcegraph/web/src/backend/graphql'
import { createPlatformContext } from '@sourcegraph/web/src/platform/context'
import { from } from 'rxjs'
import { map, take } from 'rxjs/operators/index'
import type { LayoutLoad } from './$types'

// Disable server side rendering for the whole app
export const ssr = false

if (browser) {
    // Necessary to make authenticated GrqphQL requests work
    globalThis.context = {
        xhrHeaders: {
            'X-Requested-With': 'Sourcegraph',
        },
    }
}

export const load: LayoutLoad = () => {
    const platformContext = createPlatformContext()

    return {
        platformContext,
        user: requestGraphQL<CurrentAuthStateResult>(currentAuthStateQuery)
            .pipe(map(data => data.data?.currentUser))
            .toPromise(),
        // Initial user settings
        settings: from(platformContext.settings)
            .pipe(
                map(settingsOrError => (isErrorLike(settingsOrError.final) ? null : settingsOrError.final)),
                take(1)
            )
            .toPromise(),
    }
}
