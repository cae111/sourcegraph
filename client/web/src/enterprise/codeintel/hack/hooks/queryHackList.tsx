import { ApolloClient } from '@apollo/client'
import { from, Observable } from 'rxjs'
import { map } from 'rxjs/operators'
import { getDocumentNode, gql } from '@sourcegraph/http-client'
import { HackConnectionFields, HackListResult, HackListVariables, HackState } from '../../../../graphql-operations'
import { hackFieldsFragment } from './types'

const HACK_LIST = gql`
    query HackList($states: [HackState!], $query: String, $first: Int, $after: String) {
        hack(states: $states, query: $query, first: $first, after: $after) {
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

export const queryHackList = (
    { states, query, first, after }: Partial<Omit<HackListVariables, 'states'>> & { states?: string },
    client: ApolloClient<object>
): Observable<HackConnectionFields> => {
    const variables: HackListVariables = {
        states: states ? states.split(',').map(state => state.toUpperCase() as HackState) : null,
        query: query ?? null,
        first: first ?? null,
        after: after ?? null,
    }

    return from(
        client.query<HackListResult, HackListVariables>({
            query: getDocumentNode(HACK_LIST),
            variables: { ...variables },
        })
    ).pipe(
        map(({ data }) => data),
        map(({ hack }) => hack)
    )
}
