import { SearchPatternType, SearchMode } from '@sourcegraph/search'
import {
    aggregateStreamingSearch,
    LATEST_VERSION,
    type AggregateStreamingSearchResults,
} from '@sourcegraph/shared/src/search/stream'
import type { StreamSearchOptions } from '@sourcegraph/shared/src/search/stream'
import { BehaviorSubject, merge, Observable, of } from 'rxjs'
import { last, share, shareReplay, throttleTime } from 'rxjs/operators/index'
import type { PageLoad } from './$types'
import { navigating } from '$app/stores'
import { get } from 'svelte/store'

const cache: Record<string, Observable<AggregateStreamingSearchResults | undefined>> = {}

export const load: PageLoad = ({ url, depends }) => {
    const query = url.searchParams.get('q')

    if (query) {
        depends(`query:${query}`)

        const options: StreamSearchOptions = {
            version: LATEST_VERSION,
            patternType: SearchPatternType.literal,
            caseSensitive: false,
            trace: '',
            featureOverrides: [],
            searchMode: SearchMode.Precise,
            chunkMatches: true,
        }

        const key = createCacheKey(options, query)
        let searchStream = cache[key]
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
        }
    } else {
        return { query, stream: null }
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
