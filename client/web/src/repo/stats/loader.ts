import { gql } from '@sourcegraph/http-client'

export const CONTRIBUTORS_QUERY = gql`
    query PagedRepositoryContributors(
        $repo: ID!
        $first: Int
        $last: Int
        $after: String
        $before: String
        $revisionRange: String
        $afterDate: String
        $path: String
    ) {
        node(id: $repo) {
            ... on Repository {
                __typename
                contributors(
                    first: $first
                    last: $last
                    before: $before
                    after: $after
                    revisionRange: $revisionRange
                    afterDate: $afterDate
                    path: $path
                ) {
                    ...PagedRepositoryContributorConnectionFields
                }
            }
        }
    }

    fragment PagedRepositoryContributorConnectionFields on RepositoryContributorConnection {
        totalCount
        pageInfo {
            hasNextPage
            hasPreviousPage
            endCursor
            startCursor
        }
        nodes {
            ...PagedRepositoryContributorNodeFields
        }
    }

    fragment PagedRepositoryContributorNodeFields on RepositoryContributor {
        person {
            name
            displayName
            email
            avatarURL
            user {
                username
                url
                displayName
                avatarURL
            }
        }
        count
        commits(first: 1) {
            nodes {
                oid
                abbreviatedOID
                url
                subject
                author {
                    date
                }
            }
        }
    }
`
