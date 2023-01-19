import {
    aggregateStreamingSearch,
    LATEST_VERSION,
    type AggregateStreamingSearchResults,
} from '@sourcegraph/shared/src/search/stream'
import type { StreamSearchOptions } from '@sourcegraph/shared/src/search/stream'
import { BehaviorSubject, merge, Observable, of } from 'rxjs'
import { shareReplay } from 'rxjs/operators'
import type { PageLoad } from './$types'
import { navigating } from '$app/stores'
import { get } from 'svelte/store'
import { SearchPatternType } from '@sourcegraph/shared/src/graphql-operations'
import { parseSearchURL } from '@sourcegraph/web/src/search/index'
import { filterExists } from '@sourcegraph/shared/src/search/query/validate'
import { FilterType } from '@sourcegraph/shared/src/search/query/filters'
import { getGlobalSearchContextFilter } from '@sourcegraph/shared/src/search/query/query'
import { omitFilter } from '@sourcegraph/shared/src/search/query/transformer'

const cache: Record<string, Observable<AggregateStreamingSearchResults | undefined>> = {}

export const load: PageLoad = ({ url, depends }) => {
    const hasQuery = url.searchParams.has('q')
    const caseSensitiveURL = url.searchParams.get('case') === 'yes'

    if (hasQuery) {
        let {
            query = '',
            searchMode,
            patternType = SearchPatternType.literal,
            caseSensitive,
        } = parseSearchURL(url.search)
        // Necessary for allowing to submit the same query again
        // FIXME: This is not correct
        depends(`query:${query}--${caseSensitiveURL}`)

        let searchContext = 'global'
        if (filterExists(query, FilterType.context)) {
            // TODO: Validate search context
            const globalSearchContext = getGlobalSearchContextFilter(query)
            if (globalSearchContext?.spec) {
                searchContext = globalSearchContext.spec
                query = omitFilter(query, globalSearchContext.filter)
            }
        }

        const options: StreamSearchOptions = {
            version: LATEST_VERSION,
            patternType,
            caseSensitive,
            trace: '',
            featureOverrides: [],
            chunkMatches: true,
            searchMode,
        }

        const key = createCacheKey(options, url.search)
        let searchStream = cache[key]

        // Browser back button should always use the cached version if available
        if (get(navigating)?.type !== 'popstate' || !searchStream) {
            const querySource = new BehaviorSubject<string>(query)
            searchStream = cache[key] = merge(of(undefined), aggregateStreamingSearch(querySource, options)).pipe(
                shareReplay(1)
            )
            // Primes the stream
            searchStream.subscribe()
        }
        const resultStream = searchStream //merge(searchStream.pipe(throttleTime(500)), searchStream.pipe(last()))

        return {
            query,
            stream: resultStream,
            queryOptions: {
                caseSensitive,
                patternType,
                searchMode,
                searchContext,
            },
        }
    } else {
        return { query: '', stream: null }
    }
}

function createCacheKey(options: StreamSearchOptions, query: string): string {
    return [
        options.version,
        options.patternType,
        options.caseSensitive,
        options.caseSensitive,
        options.searchMode,
        options.chunkMatches,
        query,
    ].join('--')
}
