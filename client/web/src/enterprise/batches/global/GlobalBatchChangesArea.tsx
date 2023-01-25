import React from 'react'

import MapSearchIcon from 'mdi-react/MapSearchIcon'
import { RouteComponentProps, Switch } from 'react-router'
import { CompatRoute } from 'react-router-dom-v5-compat'

import { Scalars } from '@sourcegraph/shared/src/graphql-operations'
import { SettingsCascadeProps } from '@sourcegraph/shared/src/settings/settings'
import { TelemetryProps } from '@sourcegraph/shared/src/telemetry/telemetryService'
import { ThemeProps } from '@sourcegraph/shared/src/theme'
import { lazyComponent } from '@sourcegraph/shared/src/util/lazyComponent'
import { H2, Text } from '@sourcegraph/wildcard'

import { AuthenticatedUser } from '../../../auth'
import { withAuthenticatedUser } from '../../../auth/withAuthenticatedUser'
import { HeroPage } from '../../../components/HeroPage'
import { EnterprisePageRoutes } from '../../../routes.constants'
import { XCompatRoute } from '../../../XCompatRoute'
import type { BatchChangeClosePageProps } from '../close/BatchChangeClosePage'
import type { CreateBatchChangePageProps } from '../create/CreateBatchChangePage'
import type { BatchChangeDetailsPageProps } from '../detail/BatchChangeDetailsPage'
import { TabName } from '../detail/BatchChangeDetailsTabs'
import type { BatchChangeListPageProps, NamespaceBatchChangeListPageProps } from '../list/BatchChangeListPage'
import type { BatchChangePreviewPageProps } from '../preview/BatchChangePreviewPage'
import { Page } from '../../../components/Page'

const BatchChangeListPage = lazyComponent<BatchChangeListPageProps, 'BatchChangeListPage'>(
    () => import('../list/BatchChangeListPage'),
    'BatchChangeListPage'
)
const NamespaceBatchChangeListPage = lazyComponent<NamespaceBatchChangeListPageProps, 'NamespaceBatchChangeListPage'>(
    () => import('../list/BatchChangeListPage'),
    'NamespaceBatchChangeListPage'
)
const BatchChangePreviewPage = lazyComponent<BatchChangePreviewPageProps, 'BatchChangePreviewPage'>(
    () => import('../preview/BatchChangePreviewPage'),
    'BatchChangePreviewPage'
)
const CreateBatchChangePage = lazyComponent<CreateBatchChangePageProps, 'CreateBatchChangePage'>(
    () => import('../create/CreateBatchChangePage'),
    'CreateBatchChangePage'
)
const BatchChangeDetailsPage = lazyComponent<BatchChangeDetailsPageProps, 'BatchChangeDetailsPage'>(
    () => import('../detail/BatchChangeDetailsPage'),
    'BatchChangeDetailsPage'
)
const BatchChangeClosePage = lazyComponent<BatchChangeClosePageProps, 'BatchChangeClosePage'>(
    () => import('../close/BatchChangeClosePage'),
    'BatchChangeClosePage'
)

interface Props extends RouteComponentProps, ThemeProps, TelemetryProps, SettingsCascadeProps {
    authenticatedUser: AuthenticatedUser | null
    isSourcegraphDotCom: boolean
}

/**
 * The global batch changes area.
 */
export const GlobalBatchChangesArea: React.FunctionComponent<React.PropsWithChildren<Props>> = ({
    match,
    location,
    authenticatedUser,
    isSourcegraphDotCom,
    ...props
}) => (
    <div className="w-100">
        <Page>
            <H2>GlobalCodeMonitoringArea content</H2>
            <Text className="mb-5">`match.url` value is: {match.url}</Text>
            <Switch>
                <XCompatRoute pathV6="" path={match.url} exact={true}>
                    <BatchChangeListPage
                        headingElement="h1"
                        canCreate={Boolean(authenticatedUser) && !isSourcegraphDotCom}
                        authenticatedUser={authenticatedUser}
                        isSourcegraphDotCom={isSourcegraphDotCom}
                        {...props}
                        location={location}
                    />
                </XCompatRoute>
                {!isSourcegraphDotCom && (
                    <CompatRoute path={`${match.url}/create`} exact={true}>
                        <AuthenticatedCreateBatchChangePage
                            {...props}
                            headingElement="h1"
                            authenticatedUser={authenticatedUser}
                        />
                    </CompatRoute>
                )}
                <CompatRoute component={NotFoundPage} key="hardcoded-key" />
            </Switch>
        </Page>
    </div>
)

const AuthenticatedCreateBatchChangePage = withAuthenticatedUser<
    CreateBatchChangePageProps & { authenticatedUser: AuthenticatedUser }
>(props => <CreateBatchChangePage {...props} authenticatedUser={props.authenticatedUser} />)

const NotFoundPage: React.FunctionComponent<React.PropsWithChildren<unknown>> = () => (
    <HeroPage icon={MapSearchIcon} title="404: Not Found" />
)

export interface NamespaceBatchChangesAreaProps extends Props {
    namespaceID: Scalars['ID']
}

export const NamespaceBatchChangesArea = withAuthenticatedUser<
    NamespaceBatchChangesAreaProps & { authenticatedUser: AuthenticatedUser }
>(({ match, namespaceID, ...outerProps }) => (
    <div className="pb-3">
        <Switch>
            <CompatRoute
                path={`${match.url}/apply/:specID`}
                render={({ match, ...props }: RouteComponentProps<{ specID: string }>) => (
                    <BatchChangePreviewPage {...outerProps} {...props} batchSpecID={match.params.specID} />
                )}
            />
            <CompatRoute
                path={`${match.url}/:batchChangeName/close`}
                render={({ match, ...props }: RouteComponentProps<{ batchChangeName: string }>) => (
                    <BatchChangeClosePage
                        {...outerProps}
                        {...props}
                        namespaceID={namespaceID}
                        batchChangeName={match.params.batchChangeName}
                    />
                )}
            />
            <CompatRoute
                path={`${match.url}/:batchChangeName/executions`}
                render={({ match, ...props }: RouteComponentProps<{ batchChangeName: string }>) => (
                    <BatchChangeDetailsPage
                        {...outerProps}
                        {...props}
                        namespaceID={namespaceID}
                        batchChangeName={match.params.batchChangeName}
                        initialTab={TabName.Executions}
                    />
                )}
            />
            <CompatRoute
                path={`${match.url}/:batchChangeName`}
                render={({ match, ...props }: RouteComponentProps<{ batchChangeName: string }>) => (
                    <BatchChangeDetailsPage
                        {...outerProps}
                        {...props}
                        namespaceID={namespaceID}
                        batchChangeName={match.params.batchChangeName}
                    />
                )}
            />
            <CompatRoute
                path={match.url}
                render={(props: RouteComponentProps<{}>) => (
                    <NamespaceBatchChangeListPage
                        headingElement="h2"
                        {...props}
                        {...outerProps}
                        namespaceID={namespaceID}
                    />
                )}
                exact={true}
            />
        </Switch>
    </div>
))
