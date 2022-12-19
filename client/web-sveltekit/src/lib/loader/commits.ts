import { externalLinkFieldsFragment, type Repo, type ResolvedRevision } from '@sourcegraph/web/src/repo/backend'
import { dataOrThrowErrors, gql, type GraphQLResult } from '@sourcegraph/http-client'
import { requestGraphQL } from '@sourcegraph/web/src/backend/graphql'
import type {
    RepositoryGitCommitsResult,
    RepositoryCommitResult,
    Scalars,
    RepositoryComparisonDiffResult,
    RepositoryComparisonDiffVariables,
    GitCommitFields,
} from '@sourcegraph/web/src/graphql-operations'
import type { Observable } from 'rxjs'
import { map } from 'rxjs/operators/index'
import { fileDiffFields, diffStatFields } from '@sourcegraph/web/src/backend/diff'
import { isErrorLike, type ErrorLike } from '@sourcegraph/common'
import { browser } from '$app/environment'

export const gitCommitFragment = gql`
    fragment GitCommitFields on GitCommit {
        id
        oid
        abbreviatedOID
        message
        subject
        body
        author {
            ...SignatureFields
        }
        committer {
            ...SignatureFields
        }
        parents {
            oid
            abbreviatedOID
            url
        }
        url
        canonicalURL
        externalURLs {
            ...ExternalLinkFields
        }
        tree(path: "") {
            canonicalURL
        }
    }

    fragment SignatureFields on Signature {
        person {
            avatarURL
            name
            email
            displayName
            user {
                id
                username
                url
                displayName
            }
        }
        date
    }

    ${externalLinkFieldsFragment}
`

const REPOSITORY_GIT_COMMITS_PER_PAGE = 20

const REPOSITORY_GIT_COMMITS_QUERY = gql`
    query RepositoryGitCommits($repo: ID!, $revspec: String!, $first: Int, $afterCursor: String, $filePath: String) {
        node(id: $repo) {
            __typename
            ... on Repository {
                commit(rev: $revspec) {
                    ancestors(first: $first, path: $filePath, afterCursor: $afterCursor) {
                        nodes {
                            ...GitCommitFields
                        }
                        pageInfo {
                            hasNextPage
                            endCursor
                        }
                    }
                }
            }
        }
    }
    ${gitCommitFragment}
`

const COMMIT_QUERY = gql`
    query RepositoryCommit($repo: ID!, $revspec: String!) {
        node(id: $repo) {
            __typename
            ... on Repository {
                commit(rev: $revspec) {
                    __typename # Necessary for error handling to check if commit exists
                    ...GitCommitFields
                }
            }
        }
    }
    ${gitCommitFragment}
`

export function fetchRepoCommits(
    repoId: string,
    revision: string,
    filePath: string | null,
    first: number = REPOSITORY_GIT_COMMITS_PER_PAGE
): Observable<GraphQLResult<RepositoryGitCommitsResult>> {
    return requestGraphQL(REPOSITORY_GIT_COMMITS_QUERY, {
        repo: repoId,
        revspec: revision,
        filePath: filePath ?? null,
        first,
        afterCursor: null,
    })
}

export function fetchRepoCommit(repoId: string, revision: string): Observable<GraphQLResult<RepositoryCommitResult>> {
    return requestGraphQL(COMMIT_QUERY, { repo: repoId, revspec: revision })
}

export type RepositoryComparisonDiff = Extract<RepositoryComparisonDiffResult['node'], { __typename?: 'Repository' }>

export function queryRepositoryComparisonFileDiffs(args: {
    repo: Scalars['ID']
    base: string | null
    head: string | null
    first: number | null
    after: string | null
    paths: string[] | null
}): Observable<RepositoryComparisonDiff['comparison']['fileDiffs']> {
    return requestGraphQL<RepositoryComparisonDiffResult, RepositoryComparisonDiffVariables>(
        gql`
            query RepositoryComparisonDiff(
                $repo: ID!
                $base: String
                $head: String
                $first: Int
                $after: String
                $paths: [String!]
            ) {
                node(id: $repo) {
                    __typename
                    ... on Repository {
                        comparison(base: $base, head: $head) {
                            fileDiffs(first: $first, after: $after, paths: $paths) {
                                nodes {
                                    ...FileDiffFields
                                }
                                totalCount
                                pageInfo {
                                    endCursor
                                    hasNextPage
                                }
                                diffStat {
                                    ...DiffStatFields
                                }
                            }
                        }
                    }
                }
            }

            ${fileDiffFields}

            ${diffStatFields}
        `,
        args
    ).pipe(
        map(result => {
            const data = dataOrThrowErrors(result)

            const repo = data.node
            if (repo === null) {
                throw new Error('Repository not found')
            }
            if (repo.__typename !== 'Repository') {
                throw new Error('Not a repository')
            }
            return repo.comparison.fileDiffs
        })
    )
}

const clientCache: Map<string, { nodes: GitCommitFields[] }> = new Map()

function getCacheKey(resolvedRevision: ResolvedRevision & Repo): string {
    return [resolvedRevision.repo.id, resolvedRevision.commitID ?? ''].join('/')
}

export async function fetchCommits(
    resolvedRevision: (ResolvedRevision & Repo) | ErrorLike,
    force: boolean = false
): Promise<{ nodes: GitCommitFields[] }> {
    if (!isErrorLike(resolvedRevision)) {
        if (browser && !force) {
            const fromCache = clientCache.get(getCacheKey(resolvedRevision))
            if (fromCache) return fromCache
        }
        const commits = await fetchRepoCommits(resolvedRevision.repo.id, resolvedRevision.commitID ?? '', null)
            .toPromise()
            .then(result => {
                const { node } = dataOrThrowErrors(result)
                if (!node) {
                    return { nodes: [] }
                }
                if (node.__typename !== 'Repository') {
                    return { nodes: [] }
                }
                if (!node.commit?.ancestors) {
                    return { nodes: [] }
                }
                return node?.commit?.ancestors
            })

        if (browser) {
            clientCache.set(getCacheKey(resolvedRevision), commits)
        }
        return commits
    }
    return { nodes: [] }
}
