import { ApolloClient } from '@apollo/client'
import { Observable } from 'rxjs'
import { map } from 'rxjs/operators'

import { ErrorLike } from '@sourcegraph/common'
import { fromObservableQuery, getDocumentNode, gql } from '@sourcegraph/http-client'

import { HackFields, HackResult } from '../../../../graphql-operations'

import { hackFieldsFragment } from './types'

const HACK_FIELDS = gql`
    query Hack($id: ID!) {
        node(id: $id) {
            ...HackFields
        }
    }

    ${hackFieldsFragment}
`

const POLL_INTERVAL = 5000

export const queryHack = (
    id: string,
    client: ApolloClient<object>
): Observable<HackFields | ErrorLike | null | undefined> =>
    fromObservableQuery(
        client.watchQuery<HackResult>({
            query: getDocumentNode(HACK_FIELDS),
            variables: { id },
            pollInterval: POLL_INTERVAL,
        })
    ).pipe(
        map(({ data }) => data),
        map(({ node }) => {
            if (!node || node.__typename !== 'Hack') {
                throw new Error('No such Hack')
            }
            return node
        })
    )
