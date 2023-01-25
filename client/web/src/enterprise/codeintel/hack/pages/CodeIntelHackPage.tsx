import { FunctionComponent, ReactNode, useCallback, useEffect, useMemo, useState } from 'react'

import { RouteComponentProps } from 'react-router'

import { useApolloClient } from '@apollo/client'
import {
    mdiAlertCircle,
    mdiCheck,
    mdiCheckCircle,
    mdiDatabaseEdit,
    mdiDatabasePlus,
    mdiFileUpload,
    mdiInformationOutline,
    mdiMapSearch,
    mdiProgressClock,
    mdiTimerSand,
} from '@mdi/js'
import { Timestamp } from '@sourcegraph/branded/src/components/Timestamp'
import { ErrorLike, isDefined, isErrorLike, pluralize } from '@sourcegraph/common'
import { TelemetryProps } from '@sourcegraph/shared/src/telemetry/telemetryService'
import { ThemeProps } from '@sourcegraph/shared/src/theme'
import {
    Alert,
    AlertProps,
    Badge,
    Button,
    Card,
    CardBody,
    CardSubtitle,
    CardText,
    CardTitle,
    Code,
    Container,
    ErrorAlert,
    ErrorMessage,
    H3,
    Icon,
    Link,
    LoadingSpinner,
    PageHeader,
    Text,
    Tooltip,
    useObservable,
} from '@sourcegraph/wildcard'
import classNames from 'classnames'
import { Observable } from 'rxjs'
import { takeWhile } from 'rxjs/operators'
import {
    Connection,
    FilteredConnection,
    FilteredConnectionQueryArguments,
} from '../../../../components/FilteredConnection'
import { Timeline, TimelineStage } from '../../../../components/Timeline'
import { AuditLogOperation, HackFields, HackState, LsifUploadsAuditLogsFields } from '../../../../graphql-operations'
import { queryHack } from '../hooks/queryHack'
import { queryHackDependencyGraph } from '../hooks/queryHackDependencyGraph'
import {
    NormalizedUploadRetentionMatch,
    queryHackRetention as queryUploadRetentionMatches,
    RetentionPolicyMatch,
    UploadReferenceMatch,
} from '../hooks/queryHackRetention'
import styles from './CodeIntelHackPage.module.scss'
import { Collapsible } from '../../../../components/Collapsible'
import { LogOutput } from '../../../../components/LogOutput'
import { CodeIntelUploadOrIndexRepository } from '../../shared/components/CodeIntelUploadOrIndexerRepository'
import { CodeIntelUploadOrIndexRoot } from '../../shared/components/CodeIntelUploadOrIndexRoot'
import { CodeIntelUploadOrIndexCommit } from '../../shared/components/CodeIntelUploadOrIndexCommit'
import { CodeIntelUploadOrIndexCommitTags } from '../../shared/components/CodeIntelUploadOrIndexCommitTags'
import { CodeIntelUploadOrIndexIndexer } from '../../shared/components/CodeIntelUploadOrIndexIndexer'
import { formatDurationLong } from '../../../../util/time'

export interface CodeIntelHackPageProps extends RouteComponentProps<{ id: string }>, ThemeProps, TelemetryProps {
    now?: () => Date
}

enum DependencyGraphState {
    ShowDependencies,
    ShowDependents,
}

enum RetentionPolicyMatcherState {
    ShowMatchingOnly,
    ShowAll,
}

const variantByState = new Map<HackState, AlertProps['variant']>([
    [HackState.COMPLETED, 'success'],
    [HackState.INDEXING_ERRORED, 'danger'],
    [HackState.PROCESSING_ERRORED, 'danger'],
])

export const CodeIntelHackPage: FunctionComponent<CodeIntelHackPageProps> = ({
    match: {
        params: { id },
    },
    now,
    history,
    location,
    telemetryService,
}) => {
    useEffect(() => telemetryService.logViewEvent('CodeIntelHackPage'), [telemetryService])

    const apolloClient = useApolloClient()
    const hackOrError = useObservable(
        useMemo(() => queryHack(id, apolloClient).pipe(takeWhile(shouldReload, true)), [id, queryHack, apolloClient])
    )

    const [dependencyGraphState, setDependencyGraphState] = useState(DependencyGraphState.ShowDependencies)
    const [retentionPolicyMatcherState, setRetentionPolicyMatcherState] = useState(RetentionPolicyMatcherState.ShowAll)

    const queryDependencies = useCallback(
        (args: FilteredConnectionQueryArguments) => {
            if (hackOrError && !isErrorLike(hackOrError)) {
                return queryHackDependencyGraph({ ...args, dependencyOf: hackOrError.id }, apolloClient)
            }
            throw new Error('unreachable: queryDependencies referenced with invalid upload')
        },
        [hackOrError, queryHackDependencyGraph, apolloClient]
    )

    const queryDependents = useCallback(
        (args: FilteredConnectionQueryArguments) => {
            if (hackOrError && !isErrorLike(hackOrError)) {
                return queryHackDependencyGraph({ ...args, dependentOf: hackOrError.id }, apolloClient)
            }

            throw new Error('unreachable: queryDependents referenced with invalid upload')
        },
        [hackOrError, queryHackDependencyGraph, apolloClient]
    )

    const queryRetentionPoliciesCallback = useCallback(
        (args: FilteredConnectionQueryArguments): Observable<Connection<NormalizedUploadRetentionMatch>> => {
            if (hackOrError && !isErrorLike(hackOrError)) {
                return queryUploadRetentionMatches(apolloClient, id, {
                    matchesOnly: retentionPolicyMatcherState === RetentionPolicyMatcherState.ShowMatchingOnly,
                    ...args,
                })
            }

            throw new Error('unreachable: queryRetentionPolicies referenced with invalid upload')
        },
        [hackOrError, apolloClient, id, queryUploadRetentionMatches, retentionPolicyMatcherState]
    )

    return isErrorLike(hackOrError) ? (
        <ErrorAlert prefix="Error fetching hack" error={hackOrError} />
    ) : hackOrError ? (
        <>
            <PageHeader
                headingElement="h2"
                path={[
                    {
                        text: `HACK ${hackOrError.id}`,
                    },
                ]}
                className="mb-3"
            />

            <Container>
                <Card>
                    <CardBody>
                        <CardTitle>
                            {hackOrError.projectRoot ? (
                                <Link to={hackOrError.projectRoot.repository.url}>
                                    {hackOrError.projectRoot.repository.name}
                                </Link>
                            ) : (
                                <span>Unknown repository</span>
                            )}
                        </CardTitle>

                        <CardSubtitle className="mb-2 text-muted">
                            {/* TODO - share this */}

                            {hackOrError.uploadedAt ? (
                                <span>
                                    Uploaded <Timestamp date={hackOrError.uploadedAt} now={now} noAbout={true} />
                                </span>
                            ) : hackOrError.queuedAt ? (
                                <span>
                                    Queued <Timestamp date={hackOrError.queuedAt} now={now} noAbout={true} />
                                </span>
                            ) : (
                                <></>
                            )}
                        </CardSubtitle>

                        <CardText>
                            Directory{' '}
                            {hackOrError.projectRoot ? (
                                <Link to={hackOrError.projectRoot.url}>
                                    <strong>{hackOrError.projectRoot.path || '/'}</strong>
                                </Link>
                            ) : (
                                <span>{hackOrError.inputRoot || '/'}</span>
                            )}{' '}
                            indexed at commit{' '}
                            <Code>
                                {hackOrError.projectRoot ? (
                                    <Link to={hackOrError.projectRoot.commit.url}>
                                        <Code>{hackOrError.projectRoot.commit.abbreviatedOID}</Code>
                                    </Link>
                                ) : (
                                    <span>{hackOrError.inputCommit.slice(0, 7)}</span>
                                )}
                            </Code>{' '}
                            by{' '}
                            <span>
                                {hackOrError.indexer &&
                                    (hackOrError.indexer.url === '' ? (
                                        <>{hackOrError.indexer.name}</>
                                    ) : (
                                        <Link to={hackOrError.indexer.url}>{hackOrError.indexer.name}</Link>
                                    ))}
                            </span>
                            {', '}
                            {/* TODO - share this */}
                            {hackOrError.tags.length > 0 && (
                                <>
                                    tagged as{' '}
                                    {hackOrError.tags
                                        .slice(0, 3)
                                        .map<React.ReactNode>(tag => (
                                            <Badge key={tag} variant="outlineSecondary">
                                                {tag}
                                            </Badge>
                                        ))
                                        .reduce((previous, current) => [previous, ', ', current])}
                                    {hackOrError.tags.length > 3 && <> and {hackOrError.tags.length - 3} more</>}
                                </>
                            )}
                        </CardText>
                    </CardBody>
                </Card>

                <Alert variant={variantByState.get(hackOrError.state) ?? 'primary'}>
                    <span>
                        {hackOrError.state === HackState.UPLOADING_INDEX ? (
                            <span>Still uploading...</span>
                        ) : hackOrError.state === HackState.DELETING ? (
                            <span>Upload is queued for deletion.</span>
                        ) : hackOrError.state === HackState.QUEUED_FOR_INDEXING ? (
                            <>
                                Hack is queued for indexing.{' '}
                                <LousyDescription
                                    placeInQueue={hackOrError.placeInQueue}
                                    typeName={'hack'}
                                    pluralTypeName={'hacks'}
                                />
                            </>
                        ) : hackOrError.state === HackState.QUEUED_FOR_PROCESSING ? (
                            <>
                                <span>
                                    Hack is queued for processing.{' '}
                                    <LousyDescription
                                        placeInQueue={hackOrError.placeInQueue}
                                        typeName={'hack'}
                                        pluralTypeName={'hacks'}
                                    />
                                </span>
                            </>
                        ) : hackOrError.state === HackState.INDEXING ? (
                            <span>Hack is currently being indexed...</span>
                        ) : hackOrError.state === HackState.PROCESSING ? (
                            <span>Hack is currently being processed...</span>
                        ) : hackOrError.state === HackState.COMPLETED ? (
                            <span>Hack processed successfully.</span>
                        ) : hackOrError.state === HackState.INDEXING_ERRORED ? (
                            <span>
                                Hack failed to index: <ErrorMessage error={hackOrError.failure} />
                            </span>
                        ) : hackOrError.state === HackState.PROCESSING_ERRORED ? (
                            <span>
                                Hack failed to process: <ErrorMessage error={hackOrError.failure} />
                            </span>
                        ) : (
                            <></>
                        )}
                    </span>
                </Alert>

                {hackOrError.isLatestForRepo && (
                    <div>
                        <Icon aria-hidden={true} svgPath={mdiInformationOutline} /> This upload can answer queries for
                        the tip of the default branch and are targets of cross-repository find reference operations.
                    </div>
                )}

                <div>TODO - DELETE/REINDEX BUTTON</div>

                <Container className="mt-2">
                    <HackTimeline hack={hackOrError} />
                </Container>

                {(hackOrError.state === HackState.COMPLETED || hackOrError.state === HackState.DELETING) && (
                    <>
                        <Container className="mt-2">
                            {/* <Collapsible
                                title={
                                    dependencyGraphState === DependencyGraphState.ShowDependencies ? (
                                        <H3 className="mb-0">Dependencies</H3>
                                    ) : (
                                        <H3 className="mb-0">Dependents</H3>
                                    )
                                }
                                titleAtStart={true}
                            > */}
                            {dependencyGraphState === DependencyGraphState.ShowDependencies ? (
                                <>
                                    <Button
                                        type="button"
                                        className="float-right p-0 mb-2"
                                        variant="link"
                                        onClick={() => setDependencyGraphState(DependencyGraphState.ShowDependents)}
                                    >
                                        Show dependents
                                    </Button>
                                    <FilteredConnection
                                        listComponent="div"
                                        listClassName={classNames(styles.grid, 'mb-3')}
                                        inputClassName="w-auto"
                                        noun="dependency"
                                        pluralNoun="dependencies"
                                        nodeComponent={DependencyOrDependentNode}
                                        queryConnection={queryDependencies}
                                        history={history}
                                        location={location}
                                        cursorPaging={true}
                                        useURLQuery={false}
                                        // emptyElement={<EmptyDependencies />}
                                    />
                                </>
                            ) : (
                                <>
                                    <Button
                                        type="button"
                                        className="float-right p-0 mb-2"
                                        variant="link"
                                        onClick={() => setDependencyGraphState(DependencyGraphState.ShowDependencies)}
                                    >
                                        Show dependencies
                                    </Button>
                                    <FilteredConnection
                                        listComponent="div"
                                        listClassName={classNames(styles.grid, 'mb-3')}
                                        inputClassName="w-auto"
                                        noun="dependent"
                                        pluralNoun="dependents"
                                        nodeComponent={DependencyOrDependentNode}
                                        queryConnection={queryDependents}
                                        history={history}
                                        location={location}
                                        cursorPaging={true}
                                        useURLQuery={false}
                                        // emptyElement={<EmptyDependents />}
                                    />
                                </>
                            )}
                            {/* </Collapsible> */}
                        </Container>

                        <Container className="mt-2">
                            {/* <Collapsible title={<H3 className="mb-0">Retention overview</H3>} titleAtStart={true}> */}
                            {retentionPolicyMatcherState === RetentionPolicyMatcherState.ShowAll ? (
                                <Button
                                    type="button"
                                    className="float-right p-0 mb-2"
                                    variant="link"
                                    onClick={() =>
                                        setRetentionPolicyMatcherState(RetentionPolicyMatcherState.ShowMatchingOnly)
                                    }
                                >
                                    Show matching only
                                </Button>
                            ) : (
                                <Button
                                    type="button"
                                    className="float-right p-0 mb-2"
                                    variant="link"
                                    onClick={() => setRetentionPolicyMatcherState(RetentionPolicyMatcherState.ShowAll)}
                                >
                                    Show all
                                </Button>
                            )}
                            <FilteredConnection
                                listComponent="div"
                                listClassName={classNames(styles.grid, 'mb-3')}
                                inputClassName="w-auto"
                                noun="match"
                                pluralNoun="matches"
                                nodeComponent={RetentionMatchNode}
                                queryConnection={queryRetentionPoliciesCallback}
                                history={history}
                                location={location}
                                cursorPaging={true}
                                useURLQuery={false}
                                emptyElement={<EmptyUploadRetentionMatchStatus />}
                            />
                            {/* </Collapsible> */}
                        </Container>
                    </>
                )}

                <Container className="mt-2">
                    {/* <Collapsible title={<H3 className="mb-0">Audit Logs</H3>} titleAtStart={true}> */}
                    {hackOrError.auditLogs?.length ?? 0 > 0 ? (
                        <UploadAuditLogTimeline logs={hackOrError.auditLogs || []} />
                    ) : (
                        <Text alignment="center" className="text-muted w-100 mb-0 mt-1">
                            <Icon className="mb-2" svgPath={mdiMapSearch} inline={false} aria-hidden={true} />
                            <br />
                            This upload has no audit logs.
                        </Text>
                    )}
                    {/* </Collapsible> */}
                </Container>
            </Container>
        </>
    ) : (
        <></>
    )
}

const terminalStates = new Set(['TODO']) // TODO

function shouldReload(hack: HackFields | ErrorLike | null | undefined): boolean {
    return !isErrorLike(hack) && !(hack && terminalStates.has(hack.state))
}

//
//
//

export interface CodeIntelStateDescriptionPlaceInQueueProps {
    placeInQueue?: number | null
    typeName: string
    pluralTypeName?: string
}

const LousyDescription: FunctionComponent<React.PropsWithChildren<CodeIntelStateDescriptionPlaceInQueueProps>> = ({
    placeInQueue,
    typeName,
    pluralTypeName,
}) => {
    if (placeInQueue === 1) {
        return <>This hack is up next for processing.</>
    }

    return <>{placeInQueue ? `There are ${placeInQueue - 1} hacks ahead of this one.` : ''}</>
}

export interface HackTimelineProps {
    hack: HackFields
    now?: () => Date
    className?: string
}

export const HackTimeline: FunctionComponent<React.PropsWithChildren<HackTimelineProps>> = ({
    hack,
    now,
    className,
}) => {
    const stages = useMemo(() => {
        const stages: TimelineStage[] = []

        // TODO - document
        if (hack.queuedAt) {
            stages.push({
                icon: <Icon aria-label="Success" svgPath={mdiTimerSand} />,
                text: 'Queued for indexing',
                date: hack.queuedAt,
                className: 'bg-success',
            })
        }

        // TODO - document
        if (hack.indexingStartedAt) {
            stages.push({
                icon: <Icon aria-label="Success" svgPath={mdiProgressClock} />,
                text: 'Began indexing',
                date: hack.indexingStartedAt,
                className: 'bg-success',
            })
        }

        // TODO - document
        var v = indexSetupStage(hack, now)
        if (v) {
            stages.push(v)
        }
        v = indexPreIndexStage(hack, now)
        if (v) {
            stages.push(v)
        }
        v = indexIndexStage(hack, now)
        if (v) {
            stages.push(v)
        }
        v = indexUploadStage(hack, now)
        if (v) {
            stages.push(v)
        }
        // TODO - hide a bit more
        v = indexTeardownStage(hack, now)
        if (v) {
            stages.push(v)
        }

        // Do not distinctly show the end of indexing unless it was a failure that produced
        // to submit an upload record. If we did submit a record, then the end result of this
        // job is successful to the user (if processing succeeds).
        if (hack.indexingFinishedAt && hack.state === HackState.INDEXING_ERRORED) {
            stages.push({
                icon: <Icon aria-label="" svgPath={mdiAlertCircle} />,
                text: 'Failed indexing',
                date: hack.indexingFinishedAt,
                className: 'bg-danger',
            })
        }

        // TODO - document
        if (hack.uploadedAt) {
            if (hack.state === HackState.UPLOADING_INDEX) {
                stages.push({
                    icon: <Icon aria-label="Success" svgPath={mdiFileUpload} />,
                    text: 'Began uploading',
                    date: hack.uploadedAt,
                    className: 'bg-success',
                })
            } else if (hack.state === HackState.PROCESSING_ERRORED) {
                if (!hack.processingStartedAt) {
                    stages.push({
                        icon: <Icon aria-label="" svgPath={mdiAlertCircle} />,
                        text: 'Uploading failed',
                        date: hack.uploadedAt,
                        className: 'bg-danger',
                    })
                }
            } else {
                stages.push({
                    icon: <Icon aria-label="Success" svgPath={mdiTimerSand} />,
                    text: 'Queued for processing',
                    date: hack.uploadedAt,
                    className: 'bg-success',
                })
            }
        }

        // TODO - document
        if (hack.processingStartedAt) {
            stages.push({
                icon: <Icon aria-label="Success" svgPath={mdiProgressClock} />,
                text: 'Began processing',
                date: hack.processingStartedAt,
                className: 'bg-success',
            })
        }

        // TODO - document
        if (hack.processingFinishedAt) {
            if (hack.state === HackState.PROCESSING_ERRORED) {
                if (hack.processingStartedAt) {
                    stages.push({
                        icon: <Icon aria-label="Failed" svgPath={mdiAlertCircle} />,
                        text: 'Failed',
                        date: hack.processingFinishedAt,
                        className: 'bg-danger',
                    })
                }
            } else {
                stages.push({
                    icon: <Icon aria-label="Success" svgPath={mdiCheck} />,
                    text: 'Finished',
                    date: hack.processingFinishedAt,
                    className: 'bg-success',
                })
            }
        }

        return stages
    }, [hack, now])

    return (
        <>
            <H3>Timeline</H3>
            <Timeline stages={stages} now={now} className={className} />
        </>
    )
}

const indexSetupStage = (hack: HackFields, now?: () => Date): TimelineStage | undefined =>
    !hack.steps || hack.steps.setup.length === 0
        ? undefined
        : {
              text: 'Setup',
              details: hack.steps.setup.map(logEntry => (
                  <ExecutionLogEntry key={logEntry.key} logEntry={logEntry} now={now} />
              )),
              ...genericStage(hack.steps.setup),
          }

const indexPreIndexStage = (hack: HackFields, now?: () => Date): TimelineStage | undefined => {
    if (!hack.steps) {
        return undefined
    }

    const logEntries = hack.steps.preIndex.map(step => step.logEntry).filter(isDefined)

    return logEntries.length === 0
        ? undefined
        : {
              text: 'Pre Index',
              details: hack.steps.preIndex.map(
                  step =>
                      step.logEntry && (
                          <div key={`${step.image}${step.root}${step.commands.join(' ')}}`}>
                              <ExecutionLogEntry logEntry={step.logEntry} now={now}>
                                  <ExecutionMetaInformation
                                      {...{
                                          image: step.image,
                                          commands: step.commands,
                                          root: step.root,
                                      }}
                                  />
                              </ExecutionLogEntry>
                          </div>
                      )
              ),
              ...genericStage(logEntries),
          }
}

const indexIndexStage = (hack: HackFields, now?: () => Date): TimelineStage | undefined =>
    !hack.steps || !hack.steps.index.logEntry
        ? undefined
        : {
              text: 'Index',
              details: (
                  <>
                      <ExecutionLogEntry logEntry={hack.steps.index.logEntry} now={now}>
                          <ExecutionMetaInformation
                              {...{
                                  image: hack.inputIndexer,
                                  commands: hack.steps.index.indexerArgs,
                                  root: hack.inputRoot,
                              }}
                          />
                      </ExecutionLogEntry>
                  </>
              ),
              ...genericStage(hack.steps.index.logEntry),
          }

const indexUploadStage = (hack: HackFields, now?: () => Date): TimelineStage | undefined =>
    !hack.steps || !hack.steps.upload
        ? undefined
        : {
              text: 'Upload',
              details: <ExecutionLogEntry logEntry={hack.steps.upload} now={now} />,
              ...genericStage(hack.steps.upload),
          }

const indexTeardownStage = (hack: HackFields, now?: () => Date): TimelineStage | undefined =>
    !hack.steps || hack.steps.teardown.length === 0
        ? undefined
        : {
              text: 'Teardown',
              details: hack.steps.teardown.map(logEntry => (
                  <ExecutionLogEntry key={logEntry.key} logEntry={logEntry} now={now} />
              )),
              ...genericStage(hack.steps.teardown),
          }

const genericStage = <E extends { startTime: string; exitCode: number | null }>(
    value: E | E[]
): Pick<TimelineStage, 'icon' | 'date' | 'className' | 'expandedByDefault'> => {
    const finished = Array.isArray(value)
        ? value.every(logEntry => logEntry.exitCode !== null)
        : value.exitCode !== null
    const success = Array.isArray(value) ? value.every(logEntry => logEntry.exitCode === 0) : value.exitCode === 0

    return {
        icon: !finished ? (
            <Icon aria-label="Success" svgPath={mdiProgressClock} />
        ) : success ? (
            <Icon aria-label="Success" svgPath={mdiCheck} />
        ) : (
            <Icon aria-label="Failed" svgPath={mdiAlertCircle} />
        ),
        date: Array.isArray(value) ? value[0].startTime : value.startTime,
        className: success || !finished ? 'bg-success' : 'bg-danger',
        expandedByDefault: !(success || !finished),
    }
}

interface ExecutionLogEntryProps extends React.PropsWithChildren<{}> {
    logEntry: {
        key: string
        command: string[]
        startTime: string
        exitCode: number | null
        out: string
        durationMilliseconds: number | null
    }
    now?: () => Date
}

export const ExecutionLogEntry: React.FunctionComponent<React.PropsWithChildren<ExecutionLogEntryProps>> = ({
    logEntry,
    children,
    now,
}) => (
    <Card className="mb-3">
        <CardBody>
            {logEntry.command.length > 0 ? (
                <LogOutput text={logEntry.command.join(' ')} className="mb-3" logDescription="Executed command:" />
            ) : (
                <div className="mb-3">
                    <span className="text-muted">Internal step {logEntry.key}.</span>
                </div>
            )}

            <div>
                {logEntry.exitCode === null && <LoadingSpinner className="mr-1" />}
                {logEntry.exitCode !== null && (
                    <>
                        {logEntry.exitCode === 0 ? (
                            <Icon
                                className="text-success mr-1"
                                svgPath={mdiCheckCircle}
                                inline={false}
                                aria-label="Success"
                            />
                        ) : (
                            <Icon
                                className="text-danger mr-1"
                                svgPath={mdiAlertCircle}
                                inline={false}
                                aria-label="Failed"
                            />
                        )}
                    </>
                )}
                <span className="text-muted">Started</span>{' '}
                <Timestamp date={logEntry.startTime} now={now} noAbout={true} />
                {logEntry.exitCode !== null && logEntry.durationMilliseconds !== null && (
                    <>
                        <span className="text-muted">, ran for</span>{' '}
                        {formatDurationLong(logEntry.durationMilliseconds)}
                    </>
                )}
            </div>
            {children}
        </CardBody>

        <div className="p-2">
            {logEntry.out ? (
                <Collapsible title="Log output" titleAtStart={true} buttonClassName="p-2">
                    <LogOutput text={logEntry.out} logDescription="Log output:" />
                </Collapsible>
            ) : (
                <div className="p-2">
                    <span className="text-muted">No log output available.</span>
                </div>
            )}
        </div>
    </Card>
)

export interface RetentionMatchNodeProps {
    node: NormalizedUploadRetentionMatch
}

export const retentionByUploadTitle = 'Retention by reference'
export const retentionByBranchTipTitle = 'Retention by tip of default branch'

export const RetentionMatchNode: FunctionComponent<React.PropsWithChildren<RetentionMatchNodeProps>> = ({ node }) => {
    if (node.matchType === 'RetentionPolicy') {
        return <RetentionPolicyRetentionMatchNode match={node} />
    }
    if (node.matchType === 'UploadReference') {
        return <UploadReferenceRetentionMatchNode match={node} />
    }

    throw new Error(`invalid node type ${JSON.stringify(node as object)}`)
}

const RetentionPolicyRetentionMatchNode: FunctionComponent<
    React.PropsWithChildren<{ match: RetentionPolicyMatch }>
> = ({ match }) => (
    <>
        <span className={styles.separator} />

        <div className={classNames(styles.information, 'd-flex flex-column')}>
            <div className="m-0">
                {match.configurationPolicy ? (
                    <Link to={`../configuration/${match.configurationPolicy.id}`} className="p-0">
                        <H3 className="m-0 d-block d-md-inline">{match.configurationPolicy.name}</H3>
                    </Link>
                ) : (
                    <H3 className="m-0 d-block d-md-inline">{retentionByBranchTipTitle}</H3>
                )}
                <div className="mr-2 d-block d-mdinline-block">
                    Retained: {match.matches ? 'yes' : 'no'}
                    {match.protectingCommits.length !== 0 && (
                        <>
                            , by {match.protectingCommits.length} visible{' '}
                            {pluralize('commit', match.protectingCommits.length)}, including{' '}
                            {match.protectingCommits
                                .slice(0, 4)
                                .map(hash => hash.slice(0, 7))
                                .join(', ')}
                            <Tooltip content="This upload is retained to service code-intel queries for commit(s) with applicable retention policies.">
                                <Icon
                                    aria-label="This upload is retained to service code-intel queries for commit(s) with applicable retention policies."
                                    className="ml-1"
                                    svgPath={mdiInformationOutline}
                                />
                            </Tooltip>
                        </>
                    )}
                    {!match.configurationPolicy && (
                        <Tooltip content="Uploads at the tip of the default branch are always retained indefinitely.">
                            <Icon
                                aria-label="Uploads at the tip of the default branch are always retained indefinitely."
                                className="ml-1"
                                svgPath={mdiInformationOutline}
                            />
                        </Tooltip>
                    )}
                </div>
            </div>
        </div>
    </>
)

const UploadReferenceRetentionMatchNode: FunctionComponent<
    React.PropsWithChildren<{ match: UploadReferenceMatch }>
> = ({ match }) => (
    <>
        <span className={styles.separator} />

        <div className={classNames(styles.information, 'd-flex flex-column')}>
            <div className="m-0">
                <H3 className="m-0 d-block d-md-inline">{retentionByUploadTitle}</H3>
                <div className="mr-2 d-block d-mdinline-block">
                    Referenced by {match.total} {pluralize('upload', match.total, 'uploads')}, including{' '}
                    {match.uploadSlice
                        .slice(0, 3)
                        .map<React.ReactNode>(upload => (
                            <Link key={upload.id} to={`/site-admin/code-graph/uploads/${upload.id}`}>
                                {upload.projectRoot?.repository.name ?? 'unknown'}
                            </Link>
                        ))
                        .reduce((previous, current) => [previous, ', ', current])}
                    <Tooltip content="Uploads that are dependencies of other upload(s) are retained to service cross-repository code-intel queries.">
                        <Icon
                            aria-label="Uploads that are dependencies of other upload(s) are retained to service cross-repository code-intel queries."
                            className="ml-1"
                            svgPath={mdiInformationOutline}
                        />
                    </Tooltip>
                </div>
            </div>
        </div>
    </>
)

export interface DependencyOrDependentNodeProps {
    node: HackFields
    now?: () => Date
}

export const DependencyOrDependentNode: FunctionComponent<React.PropsWithChildren<DependencyOrDependentNodeProps>> = ({
    node,
}) => (
    <>
        <span className={styles.separator} />

        <div className={classNames(styles.information, 'd-flex flex-column')}>
            <div className="m-0">
                <H3 className="m-0 d-block d-md-inline">
                    <CodeIntelUploadOrIndexRepository node={node} />
                </H3>
            </div>

            <div>
                <span className="mr-2 d-block d-mdinline-block">
                    Directory <CodeIntelUploadOrIndexRoot node={node} /> indexed at commit{' '}
                    <CodeIntelUploadOrIndexCommit node={node} />
                    {node.tags.length > 0 && (
                        <>
                            , <CodeIntelUploadOrIndexCommitTags tags={node.tags} />,
                        </>
                    )}{' '}
                    by <CodeIntelUploadOrIndexIndexer node={node} />
                </span>
            </div>
        </div>
    </>
)

export interface UploadAuditLogTimelineProps {
    logs: LsifUploadsAuditLogsFields[]
}

export const UploadAuditLogTimeline: FunctionComponent<React.PropsWithChildren<UploadAuditLogTimelineProps>> = ({
    logs,
}) => {
    const stages = logs?.map(
        (log): TimelineStage => ({
            icon:
                log.operation === AuditLogOperation.CREATE ? (
                    <Icon aria-label="Success" svgPath={mdiDatabasePlus} />
                ) : (
                    <Icon aria-label="Warn" svgPath={mdiDatabaseEdit} />
                ),
            text: stageText(log),
            className: log.operation === AuditLogOperation.CREATE ? 'bg-success' : 'bg-warning',
            expandedByDefault: true,
            date: log.logTimestamp,
            details: (
                <>
                    {log.reason && (
                        <>
                            <Container>
                                <b>Reason</b>: {log.reason}
                            </Container>
                            <br />
                        </>
                    )}
                    <div className={styles.tableContainer}>
                        <table className="table mb-0 table-striped">
                            <thead>
                                <tr>
                                    <th className={styles.dbColumnCol} scope="column">
                                        Column
                                    </th>
                                    <th className={styles.dataColumnCol} scope="column">
                                        Old
                                    </th>
                                    <th scope="column">New</th>
                                </tr>
                            </thead>
                            <tbody>
                                {log.changedColumns.map((change, index) => (
                                    // eslint-disable-next-line react/no-array-index-key
                                    <tr key={index} className="overflow-scroll">
                                        <td className="mr-2">{change.column}</td>
                                        <td className="mr-2">{change.old || 'NULL'}</td>
                                        <td className="mr-2">{change.new || 'NULL'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            ),
        })
    )

    return <Timeline showDurations={false} stages={stages} />
}

function stageText(log: LsifUploadsAuditLogsFields): ReactNode {
    if (log.operation === AuditLogOperation.CREATE) {
        return 'Upload created'
    }

    return (
        <>
            Altered columns:{' '}
            {formatReactNodeList(log.changedColumns.map(change => <span key={change.column}>{change.column}</span>))}
        </>
    )
}

function formatReactNodeList(list: ReactNode[]): ReactNode {
    if (list.length === 0) {
        return <></>
    }
    if (list.length === 1) {
        return list[0]
    }

    return (
        <>
            {list.slice(0, -1).reduce((previous, current) => [previous, ', ', current])} and {list[list.length - 1]}
        </>
    )
}

export const EmptyUploadRetentionMatchStatus: React.FunctionComponent<React.PropsWithChildren<unknown>> = () => (
    <Text alignment="center" className="text-muted w-100 mb-0 mt-1">
        <Icon className="mb-2" svgPath={mdiMapSearch} inline={false} aria-hidden={true} />
        <br />
        No retention policies matched.
    </Text>
)

export interface ExecutionMetaInformationProps {
    image: string
    commands: string[]
    root: string
}

export const ExecutionMetaInformation: React.FunctionComponent<
    React.PropsWithChildren<ExecutionMetaInformationProps>
> = ({ image, commands, root }) => (
    <div className="pt-3">
        <div className={classNames(styles.dockerCommandSpec, 'py-2 border-top pl-2')}>
            <strong className={styles.header}>Image</strong>
            <div>{image}</div>
        </div>
        <div className={classNames(styles.dockerCommandSpec, 'py-2 border-top pl-2')}>
            <strong className={styles.header}>Commands</strong>
            <div>
                <Code>{commands.join(' ')}</Code>
            </div>
        </div>
        <div className={classNames(styles.dockerCommandSpec, 'py-2 border-top pl-2')}>
            <strong className={styles.header}>Root</strong>
            <div>/{root}</div>
        </div>
    </div>
)
