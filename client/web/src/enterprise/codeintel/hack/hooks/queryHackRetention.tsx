import { ApolloClient } from '@apollo/client'
import { from, Observable } from 'rxjs'
import { map } from 'rxjs/operators'

import { getDocumentNode, gql } from '@sourcegraph/http-client'

import { Connection } from '../../../../components/FilteredConnection'
import { GitObjectType, HackRetentionResult, HackRetentionVariables } from '../../../../graphql-operations'

export const retentionByUploadTitle = 'Retention by reference'
export const retentionByBranchTipTitle = 'Retention by tip of default branch'

export type NormalizedUploadRetentionMatch = RetentionPolicyMatch | UploadReferenceMatch

export interface RetentionPolicyMatch {
    matchType: 'RetentionPolicy'
    matches: boolean
    protectingCommits: string[]
    configurationPolicy: {
        id: string
        name: string
        type: GitObjectType
        retentionDurationHours: number | null
    } | null
}

export interface UploadReferenceMatch {
    matchType: 'UploadReference'
    uploadSlice: {
        id: string
        inputCommit: string
        inputRoot: string
        projectRoot: {
            repository: { id: string; name: string }
        } | null
    }[]
    total: number
}

const UPLOAD_RETENTIONS_QUERY = gql`
    query HackRetention($id: ID!, $matchesOnly: Boolean!, $after: String, $first: Int, $query: String) {
        node(id: $id) {
            __typename
            ... on Hack {
                retentionPolicyOverview(matchesOnly: $matchesOnly, query: $query, after: $after, first: $first) {
                    __typename
                    nodes {
                        __typename
                        configurationPolicy {
                            __typename
                            id
                            name
                            type
                            retentionDurationHours
                        }
                        matches
                        protectingCommits
                    }
                    totalCount
                    pageInfo {
                        endCursor
                        hasNextPage
                    }
                }
            }
        }

        hack(dependentOf: $id) {
            __typename
            totalCount
            nodes {
                id
                inputCommit
                inputRoot
                projectRoot {
                    repository {
                        name
                        id
                    }
                }
            }
        }
    }
`
export const queryHackRetention = (
    client: ApolloClient<object>,
    id: string,
    { matchesOnly, after, first, query }: Partial<HackRetentionVariables> & Pick<HackRetentionVariables, 'matchesOnly'>
): Observable<Connection<NormalizedUploadRetentionMatch>> => {
    const variables: HackRetentionVariables = {
        id,
        matchesOnly,
        query: query ?? null,
        first: first ?? null,
        after: after ?? null,
    }

    return from(
        client.query<HackRetentionResult, HackRetentionVariables>({
            query: getDocumentNode(UPLOAD_RETENTIONS_QUERY),
            variables: { ...variables },
        })
    ).pipe(
        map(({ data }) => {
            const { node, ...rest } = data
            if (!node || node.__typename !== 'Hack') {
                throw new Error('No such Hack')
            }

            return { node, ...rest }
        }),
        map(({ node, hack: hacks }) => {
            const conn: Connection<NormalizedUploadRetentionMatch> = {
                totalCount: (node.retentionPolicyOverview.totalCount ?? 0) + ((hacks.totalCount ?? 0) > 0 ? 1 : 0),
                nodes: [],
            }

            if ((hacks.totalCount ?? 0) > 0 && retentionByUploadTitle.toLowerCase().includes(query ?? '')) {
                conn.nodes.push({
                    matchType: 'UploadReference',
                    uploadSlice: hacks.nodes,
                    total: hacks.totalCount ?? 0,
                })
            }

            conn.nodes.push(
                ...node.retentionPolicyOverview.nodes
                    .map(
                        (node): NormalizedUploadRetentionMatch => ({
                            matchType: 'RetentionPolicy',
                            ...node,
                            protectingCommits: node.protectingCommits ?? [],
                        })
                    )
                    .filter(node => {
                        if (
                            node.matchType === 'RetentionPolicy' &&
                            !node.configurationPolicy &&
                            !retentionByBranchTipTitle.toLowerCase().includes(query ?? '')
                        ) {
                            return false
                        }
                        return true
                    })
            )

            conn.pageInfo = node.retentionPolicyOverview.pageInfo
            return conn
        })
    )
}
