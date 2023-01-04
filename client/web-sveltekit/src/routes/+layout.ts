import { browser } from '$app/environment'
import { currentAuthStateQuery } from '@sourcegraph/shared/src/auth'
import type { CurrentAuthStateResult } from '@sourcegraph/shared/src/graphql-operations'
import { requestGraphQL } from '@sourcegraph/web/src/backend/graphql'
import { map } from 'rxjs/internal/operators/map'
import type { LayoutLoad } from './$types'

// Disable server side rendering for the whole app
export const ssr = false

export const load: LayoutLoad = () => {
    if (browser) {
        // Necessary to make authenticated GrqphQL requests work
        globalThis.context = {
            xhrHeaders: {
                'X-Requested-With': 'Sourcegraph',
            },
        }
    }

    return {
        user: requestGraphQL<CurrentAuthStateResult>(currentAuthStateQuery)
            .pipe(map(data => data.data?.currentUser))
            .toPromise(),
    }
}
