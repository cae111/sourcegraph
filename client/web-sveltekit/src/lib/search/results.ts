import { fetchHighlightedFileLineRanges } from '@sourcegraph/shared/src/backend/file'
import type { HighlightResponseFormat, HighlightLineRange } from '@sourcegraph/shared/src/graphql-operations'
import type { PlatformContext } from '@sourcegraph/shared/src/platform/context'
import type { Observable } from 'rxjs'

interface Result {
    repository: string
    commit?: string
    path: string
}

export function fetchFileRangeMatches(args: {
    result: Result
    format?: HighlightResponseFormat
    ranges: HighlightLineRange[]
    platformContext: PlatformContext
}): Observable<string[][]> {
    return fetchHighlightedFileLineRanges(
        {
            repoName: args.result.repository,
            commitID: args.result.commit || '',
            filePath: args.result.path,
            disableTimeout: false,
            format: args.format,
            ranges: args.ranges,
            platformContext: args.platformContext,
        },
        false
    )
}
