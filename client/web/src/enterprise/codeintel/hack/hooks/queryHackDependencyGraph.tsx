import { ApolloClient } from '@apollo/client'
import { from, Observable } from 'rxjs'
import { map } from 'rxjs/operators'

import { getDocumentNode, gql } from '@sourcegraph/http-client'

import {
    HackConnectionFields,
    HackDependencyGraphResult,
    HackDependencyGraphVariables,
} from '../../../../graphql-operations'

import { hackFieldsFragment } from './types'

const HACK_DEPENDENCY_GRAPH = gql`
    query HackDependencyGraph($dependencyOf: ID, $dependentOf: ID, $query: String, $first: Int, $after: String) {
        hack(dependencyOf: $dependencyOf, dependentOf: $dependentOf, query: $query, first: $first, after: $after) {
            nodes {
                ...HackFields
            }
            totalCount
            pageInfo {
                endCursor
                hasNextPage
            }
        }
    }

    ${hackFieldsFragment}
`

export const queryHackDependencyGraph = (
    { dependencyOf, dependentOf, query, first, after }: Partial<HackDependencyGraphVariables>,
    client: ApolloClient<object>
): Observable<HackConnectionFields> => {
    const variables: HackDependencyGraphVariables = {
        dependencyOf: dependencyOf ?? null,
        dependentOf: dependentOf ?? null,
        query: query ?? null,
        first: first ?? null,
        after: after ?? null,
    }

    return from(
        client.query<HackDependencyGraphResult, HackDependencyGraphVariables>({
            query: getDocumentNode(HACK_DEPENDENCY_GRAPH),
            variables: { ...variables },
            fetchPolicy: 'cache-first',
        })
    ).pipe(
        map(({ data }) => data),
        map(({ hack }) => hack)
    )
}
