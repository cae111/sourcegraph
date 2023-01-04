import { SearchPatternType } from '@sourcegraph/shared/src/graphql-operations'
import { SearchMode } from '@sourcegraph/search'
import { buildSearchURLQuery } from '@sourcegraph/shared/src/util/url'
import { goto } from '$app/navigation'
import { writable } from 'svelte/store'
import type { SettingsCascade } from '@sourcegraph/shared/src/settings/settings'

interface Options {
    caseSensitive: boolean
    regularExpression: boolean
    patternType: SearchPatternType
    searchMode: SearchMode
    query: string
    searchContext: string
}

type QuerySettings = Pick<
    SettingsCascade['final'],
    'search.defaultCaseSensitive' | 'search.defaultPatternType' | 'search.defaultMode'
> | null
export type QueryOptions = Pick<Options, 'patternType' | 'caseSensitive' | 'searchMode' | 'searchContext'>

export class QueryState {
    defaultCaseSensitive = false
    defaultPatternType = SearchPatternType.standard
    defaultSearchMode = SearchMode.SmartSearch
    defaultQuery = ''
    defaultSearchContext = 'global'

    private constructor(private options: Partial<Options>, private settings: QuerySettings) {}

    static init(options: Partial<Options>, settings: QuerySettings) {
        return new QueryState(options, settings)
    }

    get caseSensitive(): boolean {
        return this.options.caseSensitive ?? this.settings?.['search.defaultCaseSensitive'] ?? this.defaultCaseSensitive
    }

    get patternType(): SearchPatternType {
        return (
            this.options.patternType ??
            (this.settings?.['search.defaultPatternType'] as SearchPatternType) ??
            this.defaultPatternType
        )
    }

    get searchMode(): SearchMode {
        return (
            this.options.searchMode ?? (this.settings?.['search.defaultMode'] as SearchMode) ?? this.defaultSearchMode
        )
    }

    get query(): string {
        return this.options.query ?? this.defaultQuery
    }

    get searchContext(): string {
        return this.options.searchContext ?? this.defaultSearchContext
    }

    setQuery(newQuery: string | ((query: string) => string)): QueryState {
        const query = typeof newQuery === 'function' ? newQuery(this.query) : newQuery
        return new QueryState({ ...this.options, query }, this.settings)
    }

    setCaseSensitive(caseSensitive: boolean | ((caseSensitive: boolean) => boolean)): QueryState {
        return new QueryState(
            {
                ...this.options,
                caseSensitive: typeof caseSensitive === 'function' ? caseSensitive(this.caseSensitive) : caseSensitive,
            },
            this.settings
        )
    }

    setPatternType(
        patternType: SearchPatternType | ((patternType: SearchPatternType) => SearchPatternType)
    ): QueryState {
        return new QueryState(
            {
                ...this.options,
                patternType: typeof patternType === 'function' ? patternType(this.patternType) : patternType,
            },
            this.settings
        )
    }

    setMode(mode: SearchMode): QueryState {
        return new QueryState({ ...this.options, searchMode: mode }, this.settings)
    }

    setSettings(settings: QuerySettings) {
        return new QueryState(this.options, settings)
    }
}

export function queryStateStore(initial: Partial<Options> = {}, settings: QuerySettings) {
    const { subscribe, update } = writable<QueryState>(QueryState.init(initial, settings))
    return {
        subscribe,
        setQuery(newQuery: string | ((query: string) => string)): void {
            update(state => state.setQuery(newQuery))
        },
        setCaseSensitive(caseSensitive: boolean | ((caseSensitive: boolean) => boolean)): void {
            update(state => state.setCaseSensitive(caseSensitive))
        },
        setPatternType(patternType: SearchPatternType | ((patternType: SearchPatternType) => SearchPatternType)): void {
            update(state => state.setPatternType(patternType))
        },
        setSettings(settings: QuerySettings) {
            update(state => state.setSettings(settings))
        },
        setMode(mode: SearchMode): void {
            update(state => state.setMode(mode))
        },
    }
}

export function submitSearch(
    queryState: Pick<QueryState, 'searchMode' | 'query' | 'caseSensitive' | 'patternType' | 'searchContext'>
): void {
    const searchQueryParameter = buildSearchURLQuery(
        queryState.query,
        queryState.patternType,
        queryState.caseSensitive,
        queryState.searchContext,
        queryState.searchMode
    )

    goto('/search?' + searchQueryParameter)
}
