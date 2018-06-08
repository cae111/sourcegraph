import DirectionalSignIcon from '@sourcegraph/icons/lib/DirectionalSign'
import ErrorIcon from '@sourcegraph/icons/lib/Error'
import * as React from 'react'
import { Route, RouteComponentProps, Switch } from 'react-router'
import { merge, Subject, Subscription } from 'rxjs'
import { catchError, distinctUntilChanged, map, switchMap, tap, withLatestFrom } from 'rxjs/operators'
import { ParsedRepoRev, parseRepoRev, redirectToExternalHost } from '.'
import { parseBrowserRepoURL } from '.'
import * as GQL from '../backend/graphqlschema'
import { HeroPage } from '../components/HeroPage'
import { searchQueryForRepoRev } from '../search'
import { queryUpdates } from '../search/input/QueryInput'
import { ErrorLike, isErrorLike } from '../util/errors'
import { GoToCodeHostAction } from './actions/GoToCodeHostAction'
import { EREPONOTFOUND, EREPOSEEOTHER, fetchRepository, RepoSeeOtherError } from './backend'
import { RepositoryBranchesArea } from './branches/RepositoryBranchesArea'
import { RepositoryCommitPage } from './commit/RepositoryCommitPage'
import { RepositoryCompareArea } from './compare/RepositoryCompareArea'
import { RepositoryGraphAction } from './graph/RepositoryGraphAction'
import { RepositoryReleasesArea } from './releases/RepositoryReleasesArea'
import { RepoHeader } from './RepoHeader'
import { RepoHeaderActionPortal } from './RepoHeaderActionPortal'
import { RepoRevContainer } from './RepoRevContainer'
import { RepositoryErrorPage } from './RepositoryErrorPage'
import { RepositoryGitDataContainer } from './RepositoryGitDataContainer'
import { RepoSettingsArea } from './settings/RepoSettingsArea'
import { RepositoryStatsArea } from './stats/RepositoryStatsArea'

const RepoPageNotFound: React.SFC = () => (
    <HeroPage icon={DirectionalSignIcon} title="404: Not Found" subtitle="The repository page was not found." />
)

interface Props extends RouteComponentProps<{ repoRevAndRest: string }> {
    user: GQL.IUser | null
    onHelpPopoverToggle: () => void
    isLightTheme: boolean
}

interface State extends ParsedRepoRev {
    filePath?: string
    rest?: string

    repoHeaderLeftChildren?: React.ReactFragment | null
    repoHeaderRightChildren?: React.ReactFragment | null

    /**
     * The fetched repository or an error if occurred.
     * `undefined` while loading.
     */
    repoOrError?: GQL.IRepository | ErrorLike

    /** The external links to show in the repository header, if any. */
    externalLinks?: GQL.IExternalLink[]
}

const enableRepositoryGraph = localStorage.getItem('repositoryGraph') !== null

/**
 * Renders a horizontal bar and content for a repository page.
 */
export class RepoContainer extends React.Component<Props, State> {
    private routeMatchChanges = new Subject<{ repoRevAndRest: string }>()
    private repositoryUpdates = new Subject<Partial<GQL.IRepository>>()
    private repositoryAdds = new Subject<void>()
    private subscriptions = new Subscription()

    constructor(props: Props) {
        super(props)

        this.state = {
            ...parseURLPath(props.match.params.repoRevAndRest),
        }
    }

    public componentDidMount(): void {
        const parsedRouteChanges = this.routeMatchChanges.pipe(
            map(({ repoRevAndRest }) => parseURLPath(repoRevAndRest))
        )

        // Fetch repository.
        const repositoryChanges = parsedRouteChanges.pipe(map(({ repoPath }) => repoPath), distinctUntilChanged())
        this.subscriptions.add(
            merge(
                repositoryChanges,
                this.repositoryAdds.pipe(withLatestFrom(repositoryChanges), map(([, repoPath]) => repoPath))
            )
                .pipe(
                    tap(() => this.setState({ repoOrError: undefined })),
                    switchMap(repoPath =>
                        fetchRepository({ repoPath }).pipe(
                            catchError(error => {
                                switch (error.code) {
                                    case EREPOSEEOTHER:
                                        redirectToExternalHost((error as RepoSeeOtherError).redirectURL)
                                        return []
                                }
                                this.setState({ repoOrError: error })
                                return []
                            })
                        )
                    )
                )
                .subscribe(
                    repo => {
                        this.setState({ repoOrError: repo })
                    },
                    err => {
                        console.error(err)
                    }
                )
        )

        // Update header and other global state.
        this.subscriptions.add(
            parsedRouteChanges.subscribe(({ repoPath, rev, rawRev, rest }) => {
                this.setState({ repoPath, rev, rawRev, rest })

                queryUpdates.next(searchQueryForRepoRev(repoPath, rev))
            })
        )

        this.routeMatchChanges.next(this.props.match.params)

        // Merge in repository updates.
        this.subscriptions.add(
            this.repositoryUpdates.subscribe(update =>
                this.setState(({ repoOrError }) => ({ repoOrError: { ...repoOrError, ...update } as GQL.IRepository }))
            )
        )
    }

    public componentWillReceiveProps(props: Props): void {
        if (props.match.params !== this.props.match.params) {
            this.routeMatchChanges.next(props.match.params)
        }
    }

    public componentWillUnmount(): void {
        this.subscriptions.unsubscribe()
    }

    public render(): JSX.Element | null {
        if (!this.state.repoOrError) {
            // Render nothing while loading
            return null
        }

        const { repoPath, filePath, position, range } = parseBrowserRepoURL(
            location.pathname + location.search + location.hash
        )
        const viewerCanAdminister = !!this.props.user && this.props.user.siteAdmin

        if (isErrorLike(this.state.repoOrError)) {
            // Display error page
            switch (this.state.repoOrError.code) {
                case EREPONOTFOUND:
                    return (
                        <RepositoryErrorPage
                            repo={repoPath}
                            repoID={null}
                            error={this.state.repoOrError}
                            viewerCanAdminister={viewerCanAdminister}
                            onDidAddRepository={this.onDidAddRepository}
                        />
                    )
                default:
                    return <HeroPage icon={ErrorIcon} title="Error" subtitle={this.state.repoOrError.message} />
            }
        }

        const repoMatchURL = `/${this.state.repoOrError.uri}`

        const transferProps = {
            repo: this.state.repoOrError,
            user: this.props.user,
            isLightTheme: this.props.isLightTheme,
            repoMatchURL,
            onHelpPopoverToggle: this.props.onHelpPopoverToggle,
        }

        const isSettingsPage =
            location.pathname === `${repoMatchURL}/-/settings` ||
            location.pathname.startsWith(`${repoMatchURL}/-/settings/`)

        return (
            <div className="repo-composite-container composite-container">
                <RepoHeader
                    repo={this.state.repoOrError}
                    rev={this.state.rev}
                    filePath={filePath}
                    className="repo-composite-container__header"
                    location={this.props.location}
                    history={this.props.history}
                />
                {enableRepositoryGraph && (
                    <RepoHeaderActionPortal
                        position="right"
                        priority={-1}
                        element={
                            <RepositoryGraphAction
                                key="repository-graph"
                                repo={this.state.repoOrError.uri}
                                rev={this.state.rev}
                            />
                        }
                    />
                )}
                <RepoHeaderActionPortal
                    position="right"
                    key="go-to-code-host"
                    element={
                        <GoToCodeHostAction
                            key="go-to-code-host"
                            repo={this.state.repoOrError}
                            // We need a rev to generate code host URLs, since we don't have a default use HEAD.
                            rev={this.state.rev || 'HEAD'}
                            filePath={filePath}
                            position={position}
                            range={range}
                            externalLinks={this.state.externalLinks}
                        />
                    }
                />
                {this.state.repoOrError.enabled || isSettingsPage ? (
                    <Switch>
                        {[
                            '',
                            `@${this.state.rawRev}`, // must exactly match how the rev was encoded in the URL
                            '/-/blob',
                            '/-/tree',
                            '/-/graph',
                            '/-/commits',
                        ].map(routePath => (
                            <Route
                                path={`${repoMatchURL}${routePath}`}
                                key="hardcoded-key" // see https://github.com/ReactTraining/react-router/issues/4578#issuecomment-334489490
                                exact={routePath === ''}
                                // tslint:disable-next-line:jsx-no-lambda
                                render={routeComponentProps => (
                                    <RepoRevContainer
                                        {...routeComponentProps}
                                        {...transferProps}
                                        rev={this.state.rev}
                                        // must exactly match how the rev was encoded in the URL
                                        routePrefix={`${repoMatchURL}${
                                            this.state.rawRev ? `@${this.state.rawRev}` : ''
                                        }`}
                                    />
                                )}
                            />
                        ))}
                        <Route
                            path={`${repoMatchURL}/-/commit/:revspec+`}
                            key="hardcoded-key" // see https://github.com/ReactTraining/react-router/issues/4578#issuecomment-334489490
                            // tslint:disable-next-line:jsx-no-lambda
                            render={routeComponentProps => (
                                <RepositoryGitDataContainer repoPath={this.state.repoPath}>
                                    <RepositoryCommitPage
                                        {...routeComponentProps}
                                        {...transferProps}
                                        onDidUpdateExternalLinks={this.onDidUpdateExternalLinks}
                                    />
                                </RepositoryGitDataContainer>
                            )}
                        />
                        <Route
                            path={`${repoMatchURL}/-/branches`}
                            key="hardcoded-key" // see https://github.com/ReactTraining/react-router/issues/4578#issuecomment-334489490
                            // tslint:disable-next-line:jsx-no-lambda
                            render={routeComponentProps => (
                                <RepositoryGitDataContainer repoPath={this.state.repoPath}>
                                    <RepositoryBranchesArea {...routeComponentProps} {...transferProps} />
                                </RepositoryGitDataContainer>
                            )}
                        />
                        <Route
                            path={`${repoMatchURL}/-/tags`}
                            key="hardcoded-key" // see https://github.com/ReactTraining/react-router/issues/4578#issuecomment-334489490
                            // tslint:disable-next-line:jsx-no-lambda
                            render={routeComponentProps => (
                                <RepositoryGitDataContainer repoPath={this.state.repoPath}>
                                    <RepositoryReleasesArea {...routeComponentProps} {...transferProps} />
                                </RepositoryGitDataContainer>
                            )}
                        />
                        <Route
                            path={`${repoMatchURL}/-/compare/:spec*`}
                            key="hardcoded-key" // see https://github.com/ReactTraining/react-router/issues/4578#issuecomment-334489490
                            // tslint:disable-next-line:jsx-no-lambda
                            render={routeComponentProps => (
                                <RepositoryGitDataContainer repoPath={this.state.repoPath}>
                                    <RepositoryCompareArea {...routeComponentProps} {...transferProps} />
                                </RepositoryGitDataContainer>
                            )}
                        />
                        <Route
                            path={`${repoMatchURL}/-/stats`}
                            key="hardcoded-key" // see https://github.com/ReactTraining/react-router/issues/4578#issuecomment-334489490
                            // tslint:disable-next-line:jsx-no-lambda
                            render={routeComponentProps => (
                                <RepositoryGitDataContainer repoPath={this.state.repoPath}>
                                    <RepositoryStatsArea {...routeComponentProps} {...transferProps} />
                                </RepositoryGitDataContainer>
                            )}
                        />
                        <Route
                            path={`${repoMatchURL}/-/settings`}
                            key="hardcoded-key" // see https://github.com/ReactTraining/react-router/issues/4578#issuecomment-334489490
                            // tslint:disable-next-line:jsx-no-lambda
                            render={routeComponentProps => (
                                <RepoSettingsArea
                                    {...routeComponentProps}
                                    {...transferProps}
                                    onDidUpdateRepository={this.onDidUpdateRepository}
                                />
                            )}
                        />
                        <Route key="hardcoded-key" component={RepoPageNotFound} />
                    </Switch>
                ) : (
                    <RepositoryErrorPage
                        repo={this.state.repoOrError.uri}
                        repoID={this.state.repoOrError.id}
                        error="disabled"
                        viewerCanAdminister={viewerCanAdminister}
                        onDidUpdateRepository={this.onDidUpdateRepository}
                    />
                )}
            </div>
        )
    }

    private onDidUpdateRepository = (update: Partial<GQL.IRepository>) => this.repositoryUpdates.next(update)
    private onDidAddRepository = () => this.repositoryAdds.next()

    private onDidUpdateExternalLinks = (externalLinks: GQL.IExternalLink[] | undefined): void =>
        this.setState({ externalLinks })
}

/**
 * Parses the URL path (without the leading slash).
 *
 * TODO(sqs): replace with parseBrowserRepoURL?
 *
 * @param repoRevAndRest a string like /my/repo@myrev/-/blob/my/file.txt
 */
function parseURLPath(repoRevAndRest: string): ParsedRepoRev & { rest?: string } {
    const [repoRev, rest] = repoRevAndRest.split('/-/', 2)
    return { ...parseRepoRev(repoRev), rest }
}
