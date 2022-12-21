import { memoizeObservable } from '@sourcegraph/common'
import { makeRepoURI } from '@sourcegraph/shared/src/util/url'
import { requestGraphQL } from '@sourcegraph/web/src/backend/graphql'
import type { BlobFileFields, BlobResult, BlobVariables } from '@sourcegraph/web/src/graphql-operations'
import type { Observable } from 'rxjs'
import { dataOrThrowErrors, gql } from '@sourcegraph/http-client'
import { map } from 'rxjs/internal/operators/map'

/**
 * Makes sure that default values are applied consistently for the cache key and the `fetchBlob` function.
 */
const applyDefaultValuesToFetchBlobOptions = ({
    disableTimeout = false,
    ...options
}: FetchBlobOptions): Required<FetchBlobOptions> => ({
    ...options,
    disableTimeout,
})

function fetchBlobCacheKey(options: FetchBlobOptions): string {
    const { disableTimeout } = applyDefaultValuesToFetchBlobOptions(options)

    return `${makeRepoURI(options)}?disableTimeout=${disableTimeout}`
}

interface FetchBlobOptions {
    repoName: string
    revision: string
    filePath: string
    disableTimeout?: boolean
}

export const fetchHighlight = memoizeObservable((options: FetchBlobOptions): Observable<BlobFileFields | null> => {
    const { repoName, revision, filePath, disableTimeout } = applyDefaultValuesToFetchBlobOptions(options)

    return requestGraphQL<BlobResult, BlobVariables>(
        gql`
            query Highlight($repoName: String!, $revision: String!, $filePath: String!, $disableTimeout: Boolean!) {
                repository(name: $repoName) {
                    commit(rev: $revision) {
                        file(path: $filePath) {
                            ...BlobFileFields
                        }
                    }
                }
            }

            fragment BlobFileFields on File2 {
                __typename
                highlight(disableTimeout: $disableTimeout, format: JSON_SCIP) {
                    aborted
                    lsif
                }
            }
        `,
        { repoName, revision, filePath, disableTimeout }
    ).pipe(
        map(dataOrThrowErrors),
        map(data => {
            if (!data.repository?.commit) {
                throw new Error('Commit not found')
            }

            return data.repository.commit.file
        })
    )
}, fetchBlobCacheKey)

// FIXME: Query naming and type generation
export const fetchBlobPlaintext = memoizeObservable((options: FetchBlobOptions): Observable<BlobFileFields | null> => {
    const { repoName, revision, filePath } = applyDefaultValuesToFetchBlobOptions(options)

    return requestGraphQL<BlobResult, BlobVariables>(
        gql`
            query Blob($repoName: String!, $revision: String!, $filePath: String!) {
                repository(name: $repoName) {
                    commit(rev: $revision) {
                        file(path: $filePath) {
                            ...BlobFileFields
                        }
                    }
                }
            }

            fragment BlobFileFields on File2 {
                __typename
                content
                richHTML
                ... on GitBlob {
                    lfs {
                        byteSize
                    }
                    externalURLs {
                        url
                        serviceKind
                    }
                }
            }
        `,
        { repoName, revision, filePath }
    ).pipe(
        map(dataOrThrowErrors),
        map(data => {
            if (!data.repository?.commit) {
                throw new Error('Commit not found')
            }

            return data.repository.commit.file
        })
    )
}, fetchBlobCacheKey)
