import { asStore } from '$lib/utils'
import { isErrorLike } from '@sourcegraph/common/src/errors/utils'
import { GitRefType } from '@sourcegraph/shared/src/graphql-operations'
import { queryGitReferences } from '@sourcegraph/web/src/repo/loader'
import type { PageLoad } from './$types'

export const load: PageLoad = ({ parent }) => {
    return {
        tags: asStore(
            parent().then(({ resolvedRevision }) =>
                isErrorLike(resolvedRevision)
                    ? null
                    : queryGitReferences({
                          repo: resolvedRevision.repo.id,
                          type: GitRefType.GIT_TAG,
                          first: 20,
                      }).toPromise()
            )
        ),
    }
}
