import { SearchPatternType } from '@sourcegraph/shared/src/graphql-operations'
import { SearchMode } from '@sourcegraph/search'
import { buildSearchURLQuery } from '@sourcegraph/shared/src/util/url'
import { goto } from '$app/navigation'
import { writable } from 'svelte/store'

interface Options {
    caseSensitive: boolean
    regularExpression: boolean
    patternType: SearchPatternType
    searchMode: SearchMode
    query: string
    searchContext: string
}

export type QueryOptions = Pick<Options, 'patternType' | 'caseSensitive' | 'searchMode' | 'searchContext'>

export class QueryState {
    caseSensitive = false
    patternType = SearchPatternType.standard
    searchMode = SearchMode.SmartSearch
    query = ''
    searchContext = ''

    private constructor(options: Partial<Options>) {
        if (options.caseSensitive !== undefined) {
            this.caseSensitive = options.caseSensitive
        }
        if (options.patternType !== undefined) {
            this.patternType = options.patternType
        }
        if (options.searchMode !== undefined) {
            this.searchMode = options.searchMode
        }
        if (options.searchContext !== undefined) {
            this.searchContext = options.searchContext
        }
        if (options.query !== undefined) {
            this.query = options.query
        }
    }

    static init(options: Partial<Options>) {
        return new QueryState(options)
    }

    setQuery(newQuery: string | ((query: string) => string)): QueryState {
        const query = typeof newQuery === 'function' ? newQuery(this.query) : newQuery
        return new QueryState({ ...this, query })
    }

    setCaseSensitive(caseSensitive: boolean | ((caseSensitive: boolean) => boolean)): QueryState {
        return new QueryState({
            ...this,
            caseSensitive: typeof caseSensitive === 'function' ? caseSensitive(this.caseSensitive) : caseSensitive,
        })
    }

    setPatternType(
        patternType: SearchPatternType | ((patternType: SearchPatternType) => SearchPatternType)
    ): QueryState {
        return new QueryState({
            ...this,
            patternType: typeof patternType === 'function' ? patternType(this.patternType) : patternType,
        })
    }
}

export function queryStateStore(initial: Partial<Options> = {}) {
    const { subscribe, update } = writable<QueryState>(QueryState.init(initial))
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
