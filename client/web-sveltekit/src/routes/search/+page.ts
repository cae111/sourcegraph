import { SearchPatternType, SearchMode } from '@sourcegraph/search'
import { aggregateStreamingSearch, LATEST_VERSION } from '@sourcegraph/shared/src/search/stream'
import type { StreamSearchOptions } from '@sourcegraph/shared/src/search/stream'
import { BehaviorSubject, merge } from 'rxjs'
import { last, share, throttleTime } from 'rxjs/operators/index'
import type { PageLoad } from './$types'
import { browser } from '$app/environment'

export const load: PageLoad = ({ url }) => {
    const query = url.searchParams.get('q')

    console.log('browser', browser)

    if (query) {
        const options: StreamSearchOptions = {
            version: LATEST_VERSION,
            patternType: SearchPatternType.literal,
            caseSensitive: false,
            trace: '',
            featureOverrides: [],
            searchMode: SearchMode.Precise,
            chunkMatches: true,
            sourcegraphURL: 'https://sourcegraph.test:3443',
        }

        const querySource = new BehaviorSubject<string>(query)
        const searchStream = aggregateStreamingSearch(querySource, options).pipe(share())
        const resultStream = merge(searchStream.pipe(throttleTime(500)), searchStream.pipe(last()))

        return {
            stream: resultStream,
        }
    } else {
        return { stream: null }
    }
}
