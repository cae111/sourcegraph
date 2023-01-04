<script lang="ts">
    import { platformContext } from '$lib/stores'

    import type { MatchGroup } from '@sourcegraph/shared/src/components/ranking/PerFileResultRanking'
    import type { ContentMatch } from '@sourcegraph/shared/src/search/stream'
    import { map } from 'rxjs/operators/index'
    import CodeExcerpt from './CodeExcerpt.svelte'
    import { HighlightResponseFormat, type HighlightLineRange } from '@sourcegraph/shared/src/graphql-operations'
    import { fetchFileRangeMatches } from '$lib/search/results'

    export let result: ContentMatch
    export let grouped: MatchGroup[]

    function fetchHighlightedFileMatchLineRanges(startLine: number, endLine: number) {
        return fetchFileRangeMatches({
            result,
            platformContext: $platformContext!,
            format: HighlightResponseFormat.HTML_HIGHLIGHT,
            ranges: grouped.map(
                (group): HighlightLineRange => ({
                    startLine: group.startLine,
                    endLine: group.endLine,
                })
            ),
        }).pipe(
            map(lines => {
                return lines[grouped.findIndex(group => group.startLine === startLine && group.endLine === endLine)]
            })
        )
    }
</script>

<div class="container">
    {#each grouped as group}
        <div class="code">
            <CodeExcerpt
                startLine={group.startLine}
                endLine={group.endLine}
                blobLines={group.blobLines}
                fetchHighlightedFileRangeLines={fetchHighlightedFileMatchLineRanges}
                matches={group.matches}
            />
        </div>
    {/each}
</div>

<style lang="scss">
    .container {
        border-radius: var(--border-radius);
        border: 1px solid var(--border-color);
        background-color: var(--code-bg);
    }

    .code {
        &:not(:first-child) {
            border-top: 1px solid var(--border-color);
        }
    }
</style>
