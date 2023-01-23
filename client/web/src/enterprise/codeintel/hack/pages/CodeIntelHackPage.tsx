import { FunctionComponent, useCallback, useEffect, useMemo, useState } from 'react'

import { RouteComponentProps } from 'react-router'

import { useApolloClient } from '@apollo/client'
import { Timestamp } from '@sourcegraph/branded/src/components/Timestamp'
import { ErrorLike, isErrorLike } from '@sourcegraph/common'
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
    PageHeader,
    Text,
    useObservable,
} from '@sourcegraph/wildcard'
import { takeWhile } from 'rxjs/operators'
import { HackFields, HackState, LsifUploadConnectionFields } from '../../../../graphql-operations'
import { queryHack } from '../hooks/queryHack'

import {
    mdiAlertCircle,
    mdiCheck,
    mdiFileUpload,
    mdiInformationOutline,
    mdiMapSearch,
    mdiProgressClock,
    mdiTimerSand,
} from '@mdi/js'
import { isDefined } from '@sourcegraph/common'
import classNames from 'classnames'
import { Observable } from 'rxjs'
import { Collapsible } from '../../../../components/Collapsible'
import { ExecutionLogEntry } from '../../../../components/ExecutionLogEntry'
import {
    Connection,
    FilteredConnection,
    FilteredConnectionQueryArguments,
} from '../../../../components/FilteredConnection'
import { Timeline, TimelineStage } from '../../../../components/Timeline'
import { ExecutionMetaInformation } from '../../indexes/components/ExecutionMetaInformation'
import { DependencyOrDependentNode } from '../../uploads/components/DependencyOrDependentNode'
import { EmptyDependencies } from '../../uploads/components/EmptyDependencies'
import { EmptyDependents } from '../../uploads/components/EmptyDependents'
import { EmptyUploadRetentionMatchStatus } from '../../uploads/components/EmptyUploadRetentionStatusNode'
import { RetentionMatchNode } from '../../uploads/components/UploadRetentionStatusNode'
import { queryLsifUploadsList } from '../../uploads/hooks/queryLsifUploadsList'
import {
    NormalizedUploadRetentionMatch,
    queryUploadRetentionMatches,
} from '../../uploads/hooks/queryUploadRetentionMatches'

import styles from './CodeIntelHackPage.module.scss'
import { UploadAuditLogTimeline } from '../../uploads/components/UploadAuditLogTimeline'

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
        (args: FilteredConnectionQueryArguments): Observable<LsifUploadConnectionFields> => {
            if (hackOrError && !isErrorLike(hackOrError)) {
                return queryLsifUploadsList({ ...args, dependencyOf: hackOrError.id }, apolloClient)
            }
            throw new Error('unreachable: queryDependencies referenced with invalid upload')
        },
        [hackOrError, queryLsifUploadsList, apolloClient]
    )

    const queryDependents = useCallback(
        (args: FilteredConnectionQueryArguments) => {
            if (hackOrError && !isErrorLike(hackOrError)) {
                return queryLsifUploadsList({ ...args, dependentOf: hackOrError.id }, apolloClient)
            }

            throw new Error('unreachable: queryDependents referenced with invalid upload')
        },
        [hackOrError, queryLsifUploadsList, apolloClient]
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

                <HackTimeline hack={hackOrError} />

                {(hackOrError.state === HackState.COMPLETED || hackOrError.state === HackState.DELETING) && (
                    <>
                        <Container className="mt-2">
                            <Collapsible
                                title={
                                    dependencyGraphState === DependencyGraphState.ShowDependencies ? (
                                        <H3 className="mb-0">Dependencies</H3>
                                    ) : (
                                        <H3 className="mb-0">Dependents</H3>
                                    )
                                }
                                titleAtStart={true}
                            >
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
                                            emptyElement={<EmptyDependencies />}
                                        />
                                    </>
                                ) : (
                                    <>
                                        <Button
                                            type="button"
                                            className="float-right p-0 mb-2"
                                            variant="link"
                                            onClick={() =>
                                                setDependencyGraphState(DependencyGraphState.ShowDependencies)
                                            }
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
                                            emptyElement={<EmptyDependents />}
                                        />
                                    </>
                                )}
                            </Collapsible>
                        </Container>

                        <Container className="mt-2">
                            <Collapsible title={<H3 className="mb-0">Retention overview</H3>} titleAtStart={true}>
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
                                        onClick={() =>
                                            setRetentionPolicyMatcherState(RetentionPolicyMatcherState.ShowAll)
                                        }
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
                            </Collapsible>
                        </Container>
                    </>
                )}

                <Container className="mt-2">
                    <Collapsible title={<H3 className="mb-0">Audit Logs</H3>} titleAtStart={true}>
                        {hackOrError.auditLogs?.length ?? 0 > 0 ? (
                            <UploadAuditLogTimeline logs={hackOrError.auditLogs || []} />
                        ) : (
                            <Text alignment="center" className="text-muted w-100 mb-0 mt-1">
                                <Icon className="mb-2" svgPath={mdiMapSearch} inline={false} aria-hidden={true} />
                                <br />
                                This upload has no audit logs.
                            </Text>
                        )}
                    </Collapsible>
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
