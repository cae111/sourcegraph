<svelte:options immutable />

<script lang="ts">
    import { displayRepoName, splitPath } from '$lib/shared/repo'
    import { getFileMatchUrl, getRepositoryUrl, type SymbolMatch } from '@sourcegraph/shared/src/search/stream'
    import SearchResult from './SearchResult.svelte'
    import Icon from '$lib/Icon.svelte'
    import CodeExcerpt from './CodeExcerpt.svelte'
    import { HighlightResponseFormat } from '@sourcegraph/shared/src/graphql-operations'
    import { platformContext } from '$lib/stores'
    import { fetchFileRangeMatches } from '$lib/search/results'
    import { map } from 'rxjs/operators/index'
    import { getSymbolIconPath } from '@sourcegraph/shared/src/symbols/symbols'

    export let result: SymbolMatch

    $: repoName = result.repository
    $: repoAtRevisionURL = getRepositoryUrl(result.repository, result.branches)
    $: [fileBase, fileName] = splitPath(result.path)

    function fetchHighlightedSymbolMatchLineRanges(startLine: number, endLine: number) {
        return fetchFileRangeMatches({
            result,
            platformContext: $platformContext!,
            format: HighlightResponseFormat.HTML_HIGHLIGHT,
            ranges: result.symbols.map(symbol => ({
                startLine: symbol.line - 1,
                endLine: symbol.line,
            })),
        }).pipe(
            map(lines => {
                return lines[
                    result.symbols.findIndex(symbol => symbol.line - 1 === startLine && symbol.line === endLine)
                ]
            })
        )
    }
</script>

<SearchResult {result}>
    <div slot="title">
        <a href={repoAtRevisionURL}>{displayRepoName(repoName)}</a>
        <span aria-hidden={true}>›</span>
        <a href={getFileMatchUrl(result)}>
            {#if fileBase}{fileBase}/{/if}<strong>{fileName}</strong>
        </a>
    </div>
    {#each result.symbols as symbol}
        <div class="result">
            <div class="symbol-icon--kind-{symbol.kind.toLowerCase()}">
                <Icon svgPath={getSymbolIconPath(symbol.kind)} inline />
            </div>
            <CodeExcerpt
                startLine={symbol.line - 1}
                endLine={symbol.line}
                matches={[]}
                fetchHighlightedFileRangeLines={fetchHighlightedSymbolMatchLineRanges}
                --background-color="transparent"
            />
        </div>
    {/each}
</SearchResult>

<style lang="scss">
    @import '@sourcegraph/shared/src/symbols/SymbolIcon.module.scss';

    .result {
        margin-bottom: 0.5rem;
        display: flex;
        align-items: center;
        width: 100%;
        background-color: var(--color-bg-2);
        padding: 0.25rem;
        border-radius: var(--border-radius);
    }
</style>
