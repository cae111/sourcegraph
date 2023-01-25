import { FunctionComponent, useCallback, useEffect, useMemo, useState } from 'react'

import { RouteComponentProps } from 'react-router'

import { useApolloClient } from '@apollo/client'
import { TelemetryProps } from '@sourcegraph/shared/src/telemetry/telemetryService'
import { ThemeProps } from '@sourcegraph/shared/src/theme'
import {
    FilteredConnection,
    FilteredConnectionFilter,
    FilteredConnectionQueryArguments,
} from '../../../../components/FilteredConnection'
import { PreciseIndexFields, PreciseIndexState } from '../../../../graphql-operations'
import { queryPreciseIndexes } from '../hooks/queryPreciseIndexes'
import { useEnqueueIndexJob } from '../hooks/useEnqueueIndexJob'
import { Timestamp } from '@sourcegraph/branded/src/components/Timestamp'
import {
    Alert,
    Badge,
    Button,
    Code,
    Container,
    ErrorAlert,
    H3,
    Icon,
    Input,
    Label,
    Link,
    LoadingSpinner,
    PageHeader,
    useObservable,
} from '@sourcegraph/wildcard'
import * as H from 'history'

import { mdiAlertCircle, mdiCheckCircle, mdiDatabase, mdiFileUpload, mdiSourceRepository, mdiTimerSand } from '@mdi/js'
import styles from './CodeIntelPreciseIndexesPage.module.scss'

import { AuthenticatedUser } from '@sourcegraph/shared/src/auth'
import classNames from 'classnames'
import { of, Subject } from 'rxjs'
import { PageTitle } from '../../../../components/PageTitle'
import { queryCommitGraph } from '../hooks/queryCommitGraph'

export interface CodeIntelPreciseIndexesPageProps extends RouteComponentProps<{}>, ThemeProps, TelemetryProps {
    authenticatedUser: AuthenticatedUser | null
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
                tooltip: 'Show all indexes',
                args: {},
            },
            {
                label: 'Completed',
                value: 'completed',
                tooltip: 'Show completed indexes only',
                args: { states: PreciseIndexState.COMPLETED },
            },

            {
                label: 'Queued',
                value: 'queued',
                tooltip: 'Show queued indexes only',
                args: {
                    states: [
                        PreciseIndexState.UPLOADING_INDEX,
                        PreciseIndexState.QUEUED_FOR_INDEXING,
                        PreciseIndexState.QUEUED_FOR_PROCESSING,
                    ].join(','),
                },
            },
            {
                label: 'In progress',
                value: 'in-progress',
                tooltip: 'Show in-progress indexes only',
                args: { states: [PreciseIndexState.INDEXING, PreciseIndexState.PROCESSING].join(',') },
            },
            {
                label: 'Errored',
                value: 'errored',
                tooltip: 'Show errored indexes only',
                args: { states: [PreciseIndexState.INDEXING_ERRORED, PreciseIndexState.PROCESSING_ERRORED].join(',') },
            },
        ],
    },
]

export const CodeIntelPreciseIndexesPage: FunctionComponent<CodeIntelPreciseIndexesPageProps> = ({
    authenticatedUser,
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
            return queryPreciseIndexes({ ...args, repo: repo?.id }, apolloClient)
        },
        [queryPreciseIndexes, apolloClient]
    )

    const commitGraphMetadata = useObservable(
        useMemo(
            () => (repo ? queryCommitGraph(repo?.id, apolloClient) : of(undefined)),
            [repo, queryCommitGraph, apolloClient]
        )
    )

    const queryConnection = useCallback(
        (args: FilteredConnectionQueryArguments) => {
            return queryHackListCallback(args)
        },
        [queryHackListCallback]
    )

    const querySubject = useMemo(() => new Subject<string>(), [])

    return (
        <div>
            <PageTitle title="Precise indexes" />
            <PageHeader
                headingElement="h2"
                path={[{ text: 'Precise indexes' }]}
                description={'Precise code intelligence index data and auto-indexing jobs.'}
                className="mb-3"
            />

            {repo && (
                <>
                    {commitGraphMetadata && (
                        <>
                            <Alert variant={commitGraphMetadata.stale ? 'primary' : 'success'} aria-live="off">
                                {commitGraphMetadata.stale ? (
                                    <>
                                        Repository commit graph is currently stale and is queued to be refreshed.
                                        Refreshing the commit graph updates which uploads are visible from which
                                        commits.
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

                    {authenticatedUser?.siteAdmin && (
                        <Container className="mb-2">
                            <EnqueueForm repoId={repo.id} querySubject={querySubject} />
                        </Container>
                    )}
                </>
            )}

            <div>TODO - DELETE AND REINDEX BUTTONS</div>

            <Container>
                <div className="list-group position-relative">
                    <FilteredConnection<PreciseIndexFields, Omit<HackNodeProps, 'node'>>
                        listComponent="div"
                        inputClassName="ml-2 flex-1"
                        listClassName={classNames(styles.grid, 'mb-3')}
                        noun="precise index"
                        pluralNoun="precise indexes"
                        querySubject={querySubject}
                        nodeComponent={HackNode}
                        nodeComponentProps={{ history }}
                        queryConnection={queryConnection}
                        history={history}
                        location={location}
                        cursorPaging={true}
                        filters={filters}
                        // emptyElement={<EmptyAutoIndex />}
                        // updates={deletes}
                    />
                </div>
            </Container>
        </div>
    )
}

export interface HackNodeProps {
    node: PreciseIndexFields
    now?: () => Date
    history: H.History
}

export const HackNode: FunctionComponent<React.PropsWithChildren<HackNodeProps>> = ({ node, now, history }) => (
    <>
        <span className={styles.separator} />

        <div
            className={classNames(styles.information, 'd-flex flex-column')}
            onClick={() => history.push({ pathname: `./indexes/${node.id}` })}
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
                <CodeIntelStateIcon state={node.state} autoIndexed={!!node.indexingFinishedAt} />
                <CodeIntelStateLabel
                    state={node.state}
                    autoIndexed={!!node.indexingFinishedAt}
                    placeInQueue={node.placeInQueue}
                    className="mt-2"
                />
            </div>
        </span>
    </>
)

export interface CodeIntelStateIconProps {
    state: PreciseIndexState
    autoIndexed: boolean
    className?: string
}

export const CodeIntelStateIcon: FunctionComponent<React.PropsWithChildren<CodeIntelStateIconProps>> = ({
    state,
    autoIndexed,
    className,
}) =>
    state === PreciseIndexState.QUEUED_FOR_PROCESSING ? (
        <div className="text-center">
            <Icon className={className} svgPath={mdiTimerSand} inline={false} aria-label="Queued" />
            <Icon className={className} svgPath={mdiDatabase} inline={false} aria-label="Queued for processing" />
        </div>
    ) : state === PreciseIndexState.PROCESSING ? (
        <LoadingSpinner inline={false} className={className} />
    ) : state === PreciseIndexState.PROCESSING_ERRORED ? (
        <Icon
            className={classNames('text-danger', className)}
            svgPath={mdiAlertCircle}
            inline={false}
            aria-label="Errored"
        />
    ) : state === PreciseIndexState.COMPLETED ? (
        <Icon
            className={classNames('text-success', className)}
            svgPath={mdiCheckCircle}
            inline={false}
            aria-label="Completed"
        />
    ) : state === PreciseIndexState.UPLOADING_INDEX ? (
        <Icon className={className} svgPath={mdiFileUpload} inline={false} aria-label="Uploading" />
    ) : state === PreciseIndexState.DELETING ? (
        <Icon
            className={classNames('text-muted', className)}
            svgPath={mdiCheckCircle}
            inline={false}
            aria-label="Deleting"
        />
    ) : state === PreciseIndexState.QUEUED_FOR_INDEXING ? (
        <div className="text-center">
            <Icon className={className} svgPath={mdiTimerSand} inline={false} aria-label="Queued" />
            <Icon className={className} svgPath={mdiSourceRepository} inline={false} aria-label="Queued for indexing" />
        </div>
    ) : state === PreciseIndexState.INDEXING ? (
        <LoadingSpinner inline={false} className={className} />
    ) : state === PreciseIndexState.INDEXING_ERRORED ? (
        <Icon
            className={classNames('text-danger', className)}
            svgPath={mdiAlertCircle}
            inline={false}
            aria-label="Errored"
        />
    ) : autoIndexed ? (
        <Icon
            className={classNames('text-success', className)}
            svgPath={mdiCheckCircle}
            inline={false}
            aria-label="Completed"
        />
    ) : (
        <></>
    )

export interface CodeIntelStateLabelProps {
    state: PreciseIndexState
    autoIndexed: boolean
    placeInQueue?: number | null
    className?: string
}

const labelClassNames = classNames(styles.label, 'text-muted')

export const CodeIntelStateLabel: FunctionComponent<React.PropsWithChildren<CodeIntelStateLabelProps>> = ({
    state,
    autoIndexed,
    placeInQueue,
    className,
}) =>
    state === PreciseIndexState.QUEUED_FOR_PROCESSING ? (
        <span className={classNames(labelClassNames, className)}>
            Queued <CodeIntelStateLabelPlaceInQueue placeInQueue={placeInQueue} />
        </span>
    ) : state === PreciseIndexState.PROCESSING ? (
        <span className={classNames(labelClassNames, className)}>Processing...</span>
    ) : state === PreciseIndexState.PROCESSING_ERRORED ? (
        <span className={classNames(labelClassNames, className)}>Errored</span>
    ) : state === PreciseIndexState.COMPLETED ? (
        <span className={classNames(labelClassNames, className)}>Completed</span>
    ) : state === PreciseIndexState.DELETED ? (
        <span className={classNames(labelClassNames, className)}>Deleted</span>
    ) : state === PreciseIndexState.DELETING ? (
        <span className={classNames(labelClassNames, className)}>Deleting</span>
    ) : state === PreciseIndexState.UPLOADING_INDEX ? (
        <span className={classNames(labelClassNames, className)}>Uploading...</span>
    ) : state === PreciseIndexState.QUEUED_FOR_INDEXING ? (
        <span className={classNames(labelClassNames, className)}>
            Queued <CodeIntelStateLabelPlaceInQueue placeInQueue={placeInQueue} />
        </span>
    ) : state === PreciseIndexState.INDEXING ? (
        <span className={classNames(labelClassNames, className)}>Indexing...</span>
    ) : state === PreciseIndexState.INDEXING_ERRORED ? (
        <span className={classNames(labelClassNames, className)}>Errored</span>
    ) : state === PreciseIndexState.INDEXING_COMPLETED ? (
        <span className={classNames(labelClassNames, className)}>completed</span>
    ) : autoIndexed ? (
        <span className={classNames(labelClassNames, className)}>Completed</span>
    ) : (
        <></>
    )

export interface CodeIntelStateLabelPlaceInQueueProps {
    placeInQueue?: number | null
}

const CodeIntelStateLabelPlaceInQueue: FunctionComponent<
    React.PropsWithChildren<CodeIntelStateLabelPlaceInQueueProps>
> = ({ placeInQueue }) => (placeInQueue ? <span className={styles.block}>(#{placeInQueue})</span> : <></>)

export interface EnqueueFormProps {
    repoId: string
    querySubject: Subject<string>
}

enum State {
    Idle,
    Queueing,
    Queued,
}

export const EnqueueForm: FunctionComponent<React.PropsWithChildren<EnqueueFormProps>> = ({ repoId, querySubject }) => {
    const [revlike, setRevlike] = useState('HEAD')
    const [state, setState] = useState(() => State.Idle)
    const [queueResult, setQueueResult] = useState<number>()
    const [enqueueError, setEnqueueError] = useState<Error>()
    const { handleEnqueueIndexJob } = useEnqueueIndexJob()

    const enqueue = useCallback(async () => {
        setState(State.Queueing)
        setEnqueueError(undefined)
        setQueueResult(undefined)

        try {
            const indexes = await handleEnqueueIndexJob({
                variables: { id: repoId, rev: revlike },
            }).then(({ data }) => data)

            const queueResultLength = indexes?.queueAutoIndexJobsForRepo.length || 0
            setQueueResult(queueResultLength)
            if (queueResultLength > 0) {
                querySubject.next(indexes?.queueAutoIndexJobsForRepo[0].inputCommit)
            }
        } catch (error) {
            setEnqueueError(error)
            setQueueResult(undefined)
        } finally {
            setState(State.Queued)
        }
    }, [repoId, revlike, querySubject, handleEnqueueIndexJob])

    return (
        <>
            {enqueueError && <ErrorAlert prefix="Error enqueueing index job" error={enqueueError} />}
            <div className="mb-3">
                Provide a{' '}
                <Link
                    to="https://git-scm.com/docs/git-rev-parse.html#_specifying_revisions"
                    rel="noopener noreferrer"
                    target="_blank"
                >
                    Git revspec
                </Link>{' '}
                to enqueue a new auto-indexing job.
            </div>
            <div className="form-inline">
                <Label htmlFor="revlike">Git revspec</Label>

                <Input
                    id="revlike"
                    className="ml-2"
                    value={revlike}
                    onChange={event => setRevlike(event.target.value)}
                />

                <Button
                    type="button"
                    title="Enqueue thing"
                    disabled={state === State.Queueing}
                    className="ml-2"
                    variant="primary"
                    onClick={enqueue}
                >
                    Enqueue
                </Button>
            </div>

            {state === State.Queued &&
                queueResult !== undefined &&
                (queueResult > 0 ? (
                    <Alert className="mt-3 mb-0" variant="success">
                        {queueResult} auto-indexing jobs enqueued.
                    </Alert>
                ) : (
                    <Alert className="mt-3 mb-0" variant="info">
                        Failed to enqueue any auto-indexing jobs.
                        <br />
                        Check if the auto-index configuration is up-to-date.
                    </Alert>
                ))}
        </>
    )
}
