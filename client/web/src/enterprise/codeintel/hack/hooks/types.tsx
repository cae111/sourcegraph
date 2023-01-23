import { gql } from '@sourcegraph/http-client'

export const hackFieldsFragment = gql`
    fragment HackFields on Hack {
        __typename
        id
        projectRoot {
            url
            path
            repository {
                url
                name
            }
            commit {
                url
                oid
                abbreviatedOID
            }
        }
        inputCommit
        tags
        inputRoot
        inputIndexer
        indexer {
            name
            url
        }
        state
        queuedAt
        uploadedAt
        indexingStartedAt
        indexingFinishedAt
        processingStartedAt
        processingFinishedAt
        steps {
            ...LsifIndexStepsFields
        }
        failure
        placeInQueue
        shouldReindex
        isLatestForRepo

        auditLogs {
            ...HackAuditLogFields
        }
    }

    fragment LsifIndexStepsFields on IndexSteps {
        setup {
            ...ExecutionLogEntryFields
        }
        preIndex {
            root
            image
            commands
            logEntry {
                ...ExecutionLogEntryFields
            }
        }
        index {
            indexerArgs
            outfile
            logEntry {
                ...ExecutionLogEntryFields
            }
        }
        upload {
            ...ExecutionLogEntryFields
        }
        teardown {
            ...ExecutionLogEntryFields
        }
    }

    fragment ExecutionLogEntryFields on ExecutionLogEntry {
        key
        command
        startTime
        exitCode
        out
        durationMilliseconds
    }

    fragment HackAuditLogFields on LSIFUploadAuditLog {
        logTimestamp
        reason
        changedColumns {
            column
            old
            new
        }
        operation
    }
`

export const hackConnectionFieldsFragment = gql`
    fragment HackConnectionFields on HackConnection {
        nodes {
            ...HackFields
        }
        totalCount
        pageInfo {
            endCursor
            hasNextPage
        }
    }

    ${hackFieldsFragment}
`
