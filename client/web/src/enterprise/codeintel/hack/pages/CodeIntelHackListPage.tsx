import { FunctionComponent, useCallback, useEffect, useMemo } from 'react'

import { RouteComponentProps } from 'react-router'

import { useApolloClient } from '@apollo/client'
import { TelemetryProps } from '@sourcegraph/shared/src/telemetry/telemetryService'
import { ThemeProps } from '@sourcegraph/shared/src/theme'
import {
    FilteredConnection,
    FilteredConnectionFilter,
    FilteredConnectionQueryArguments,
} from '../../../../components/FilteredConnection'
import { HackFields, HackState } from '../../../../graphql-operations'
import { queryHackList } from '../hooks/queryHackList'

import { Timestamp } from '@sourcegraph/branded/src/components/Timestamp'
import {
    Alert,
    Badge,
    Code,
    Container,
    H3,
    Icon,
    Link,
    LoadingSpinner,
    PageHeader,
    useObservable,
} from '@sourcegraph/wildcard'
import * as H from 'history'

import { mdiAlertCircle, mdiCheckCircle, mdiFileUpload, mdiTimerSand } from '@mdi/js'
import styles from './CodeIntelHackListPage.module.scss'

import classNames from 'classnames'
import { of } from 'rxjs'
import { PageTitle } from '../../../../components/PageTitle'
import { queryCommitGraphMetadata } from '../../indexes/hooks/queryCommitGraphMetadata'

export interface CodeIntelHackListPageProps extends RouteComponentProps<{}>, ThemeProps, TelemetryProps {
    repo?: { id: string }
    now?: () => Date
}

const filters: FilteredConnectionFilter[] = [
    {
        id: 'filters',
        label: 'State',
        type: 'select',
        values: [
            {
                label: 'All',
                value: 'all',
                tooltip: 'Show all hacks',
                args: {},
            },
            {
                label: 'Completed',
                value: 'completed',
                tooltip: 'Show completed hacks only',
                args: { states: HackState.COMPLETED },
            },

            {
                label: 'Queued',
                value: 'queued',
                tooltip: 'Show queued hacks only',
                args: {
                    states: [
                        HackState.UPLOADING_INDEX,
                        HackState.QUEUED_FOR_INDEXING,
                        HackState.QUEUED_FOR_PROCESSING,
                    ].join(','),
                },
            },
            {
                label: 'In progress',
                value: 'in-progress',
                tooltip: 'Show in-progress hacks only',
                args: { states: [HackState.INDEXING, HackState.PROCESSING].join(',') },
            },
            {
                label: 'Errored',
                value: 'errored',
                tooltip: 'Show errored hacks only',
                args: { states: [HackState.INDEXING_ERRORED, HackState.PROCESSING_ERRORED].join(',') },
            },
        ],
    },
]

export const CodeIntelHackListPage: FunctionComponent<CodeIntelHackListPageProps> = ({
    repo,
    now,
    telemetryService,
    history,
    location,
}) => {
    useEffect(() => telemetryService.logViewEvent('CodeIntelHackListPage'), [telemetryService])

    const apolloClient = useApolloClient()
    const queryHackListCallback = useCallback(
        (args: FilteredConnectionQueryArguments) => {
            return queryHackList(args, apolloClient)
        },
        [queryHackList, apolloClient]
    )

    const commitGraphMetadata = useObservable(
        useMemo(
            () => (repo ? queryCommitGraphMetadata(repo?.id, apolloClient) : of(undefined)),
            [repo, queryCommitGraphMetadata, apolloClient]
        )
    )

    const queryConnection = useCallback(
        (args: FilteredConnectionQueryArguments) => {
            return queryHackListCallback(args)
        },
        [queryHackList]
    )

    return (
        <div>
            <PageTitle title="Hacks" />
            <PageHeader headingElement="h2" path={[{ text: 'Hacks' }]} description={'Hacks!!.'} className="mb-3" />

            {repo && commitGraphMetadata && (
                <>
                    <Alert variant={commitGraphMetadata.stale ? 'primary' : 'success'} aria-live="off">
                        {commitGraphMetadata.stale ? (
                            <>
                                Repository commit graph is currently stale and is queued to be refreshed. Refreshing the
                                commit graph updates which uploads are visible from which commits.
                            </>
                        ) : (
                            <>Repository commit graph is currently up to date.</>
                        )}{' '}
                        {commitGraphMetadata.updatedAt && (
                            <>
                                Last refreshed <Timestamp date={commitGraphMetadata.updatedAt} now={now} />.
                            </>
                        )}
                    </Alert>
                </>
            )}

            <div>TODO - ENQUEUE BUTTON</div>
            <div>TODO - DELETE AND REINDEX BUTTONS</div>

            <Container>
                <div className="list-group position-relative">
                    <FilteredConnection<HackFields, Omit<HackNodeProps, 'node'>>
                        listComponent="div"
                        // inputClassName="mr-2"
                        listClassName={classNames(styles.grid, 'mb-3')}
                        noun="hack"
                        pluralNoun="hacks"
                        // querySubject={querySubject}
                        nodeComponent={HackNode}
                        nodeComponentProps={{ history }}
                        queryConnection={queryConnection}
                        history={history}
                        location={location}
                        cursorPaging={true}
                        filters={filters}
                        // headComponent={() => (
                        //     <thead>
                        //         <tr>
                        //             <th>Repo</th>
                        //             <th>Commit</th>
                        //             <th>Root</th>
                        //             <th>Indexer</th>
                        //             <th>State</th>
                        //         </tr>
                        //     </thead>
                        // )}
                        // emptyElement={<EmptyAutoIndex />}
                        // updates={deletes}
                    />
                </div>
            </Container>
        </div>
    )
}

export interface HackNodeProps {
    node: HackFields
    now?: () => Date
    history: H.History
}

export const HackNode: FunctionComponent<React.PropsWithChildren<HackNodeProps>> = ({ node, now, history }) => (
    <>
        <span className={styles.separator} />

        <div
            className={classNames(styles.information, 'd-flex flex-column')}
            onClick={() => history.push({ pathname: `./hack/${node.id}` })}
        >
            <div className="m-0">
                <H3>
                    {node.projectRoot ? (
                        <Link to={node.projectRoot.repository.url}>{node.projectRoot.repository.name}</Link>
                    ) : (
                        <span>Unknown repository</span>
                    )}
                </H3>
            </div>

            <div>
                <span className="mr-2 d-block d-mdinline-block">
                    Directory{' '}
                    {node.projectRoot ? (
                        <Link to={node.projectRoot.url}>
                            <strong>{node.projectRoot.path || '/'}</strong>
                        </Link>
                    ) : (
                        <span>{node.inputRoot || '/'}</span>
                    )}{' '}
                    indexed at commit{' '}
                    {
                        <Code>
                            {node.projectRoot?.commit ? (
                                <Link to={node.projectRoot.commit.url}>
                                    <Code>{node.projectRoot.commit.abbreviatedOID}</Code>
                                </Link>
                            ) : (
                                <span>{true ? node.inputCommit.slice(0, 7) : node.inputCommit}</span>
                            )}
                        </Code>
                    }
                    {node.tags.length > 0 && (
                        <>
                            ,{' '}
                            <>
                                {node.tags.length > 0 && (
                                    <>
                                        tagged as{' '}
                                        {node.tags
                                            .slice(0, 3)
                                            .map<React.ReactNode>(tag => (
                                                <Badge key={tag} variant="outlineSecondary">
                                                    {tag}
                                                </Badge>
                                            ))
                                            .reduce((previous, current) => [previous, ', ', current])}
                                        {node.tags.length > 3 && <> and {node.tags.length - 3} more</>}
                                    </>
                                )}
                            </>
                            ,
                        </>
                    )}{' '}
                    by{' '}
                    <span>
                        {node.indexer &&
                            (node.indexer.url === '' ? (
                                <>{node.indexer.name}</>
                            ) : (
                                <Link to={node.indexer.url}>{node.indexer.name}</Link>
                            ))}
                    </span>
                </span>

                <small className="text-mute">
                    {node.uploadedAt ? (
                        <span>
                            Uploaded <Timestamp date={node.uploadedAt} now={now} noAbout={true} />
                        </span>
                    ) : node.queuedAt ? (
                        <span>
                            Queued <Timestamp date={node.queuedAt} now={now} noAbout={true} />
                        </span>
                    ) : (
                        <></>
                    )}
                </small>
            </div>
        </div>

        <span className={classNames(styles.state, 'd-none d-md-inline')}>
            <div className="d-flex flex-column align-items-center">
                <CodeIntelStateIcon state={node.state} />
                <CodeIntelStateLabel state={node.state} placeInQueue={node.placeInQueue} className="mt-2 ml-2" />
            </div>
        </span>
    </>
)

export interface CodeIntelStateIconProps {
    state: HackState
    className?: string
}

export const CodeIntelStateIcon: FunctionComponent<React.PropsWithChildren<CodeIntelStateIconProps>> = ({
    state,
    className,
}) =>
    state === HackState.QUEUED_FOR_INDEXING ? (
        <Icon className={className} svgPath={mdiTimerSand} inline={false} aria-label="Queued for indexing" />
    ) : state === HackState.QUEUED_FOR_PROCESSING ? (
        <Icon className={className} svgPath={mdiTimerSand} inline={false} aria-label="Queued for processing" />
    ) : state === HackState.INDEXING ? (
        <LoadingSpinner inline={false} className={className} />
    ) : state === HackState.INDEXING_ERRORED ? (
        <Icon
            className={classNames('text-danger', className)}
            svgPath={mdiAlertCircle}
            inline={false}
            aria-label="Indexing errored"
        />
    ) : state === HackState.PROCESSING ? (
        <LoadingSpinner inline={false} className={className} />
    ) : state === HackState.PROCESSING_ERRORED ? (
        <Icon
            className={classNames('text-danger', className)}
            svgPath={mdiAlertCircle}
            inline={false}
            aria-label="Processing errored"
        />
    ) : state === HackState.COMPLETED ? (
        <Icon
            className={classNames('text-success', className)}
            svgPath={mdiCheckCircle}
            inline={false}
            aria-label="Completed"
        />
    ) : state === HackState.UPLOADING_INDEX ? (
        <Icon className={className} svgPath={mdiFileUpload} inline={false} aria-label="Uploading" />
    ) : state === HackState.DELETING ? (
        <Icon
            className={classNames('text-muted', className)}
            svgPath={mdiCheckCircle}
            inline={false}
            aria-label="Deleting"
        />
    ) : (
        <></>
    )

export interface CodeIntelStateLabelProps {
    state: HackState
    placeInQueue?: number | null
    className?: string
}

const labelClassNames = classNames(styles.label, 'text-muted')

export const CodeIntelStateLabel: FunctionComponent<React.PropsWithChildren<CodeIntelStateLabelProps>> = ({
    state,
    placeInQueue,
    className,
}) =>
    state === HackState.QUEUED_FOR_INDEXING ? (
        <span className={classNames(labelClassNames, className)}>
            Queued for indexing <CodeIntelStateLabelPlaceInQueue placeInQueue={placeInQueue} />
        </span>
    ) : state === HackState.QUEUED_FOR_PROCESSING ? (
        <span className={classNames(labelClassNames, className)}>
            Queued for processing <CodeIntelStateLabelPlaceInQueue placeInQueue={placeInQueue} />
        </span>
    ) : (
        <span className={classNames(labelClassNames, className)}>
            {state === HackState.INDEXING
                ? 'Indexing'
                : state === HackState.INDEXING_ERRORED
                ? 'Indexing errored'
                : state === HackState.INDEXING_COMPLETED
                ? 'Indexing completed'
                : state === HackState.PROCESSING
                ? 'Processing'
                : state === HackState.PROCESSING_ERRORED
                ? 'Processing errored'
                : state === HackState.COMPLETED
                ? 'Processing completed'
                : state === HackState.DELETED
                ? 'Deleted'
                : state === HackState.DELETING
                ? 'Deleting'
                : state === HackState.UPLOADING_INDEX
                ? 'Uploading index'
                : 'Unknown'}
        </span>
    )

export interface CodeIntelStateLabelPlaceInQueueProps {
    placeInQueue?: number | null
}

const CodeIntelStateLabelPlaceInQueue: FunctionComponent<
    React.PropsWithChildren<CodeIntelStateLabelPlaceInQueueProps>
> = ({ placeInQueue }) => (placeInQueue ? <span className={styles.block}>(#{placeInQueue} in line)</span> : <></>)
