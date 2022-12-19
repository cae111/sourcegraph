<svelte:options immutable />

<script lang="ts">
    import { displayRepoName, splitPath } from '$lib/shared/repo'
    import { getFileMatchUrl, getRepositoryUrl, type ContentMatch } from '@sourcegraph/shared/src/search/stream'
    import SearchResult from './SearchResult.svelte'
    import type { MatchItem } from '@sourcegraph/shared/src/components/ranking/PerFileResultRanking'
    import { ZoektRanking } from '@sourcegraph/shared/src/components/ranking/ZoektRanking'
    import FileMatchChildren from './FileMatchChildren.svelte'
    import Icon from '$lib/Icon.svelte'
    import { mdiChevronDown, mdiChevronUp } from '@mdi/js'
    import { pluralize } from '@sourcegraph/common/src/util'
    import { getContext } from 'svelte'

    export let result: ContentMatch

    const ranking = new ZoektRanking(3)
    // The number of lines of context to show before and after each match.
    const context = 1

    $: repoName = result.repository
    $: repoAtRevisionURL = getRepositoryUrl(result.repository, result.branches)
    $: [fileBase, fileName] = splitPath(result.path)
    let items: MatchItem[]
    $: items =
        result.type === 'content'
            ? result.chunkMatches?.map(match => ({
                  highlightRanges: match.ranges.map(range => ({
                      startLine: range.start.line,
                      startCharacter: range.start.column,
                      endLine: range.end.line,
                      endCharacter: range.end.column,
                  })),
                  content: match.content,
                  startLine: match.contentStart.line,
                  endLine: match.ranges[match.ranges.length - 1].end.line,
                  aggregableBadges: match.aggregableBadges,
              })) ||
              result.lineMatches?.map(match => ({
                  highlightRanges: match.offsetAndLengths.map(offsetAndLength => ({
                      startLine: match.lineNumber,
                      startCharacter: offsetAndLength[0],
                      endLine: match.lineNumber,
                      endCharacter: offsetAndLength[0] + offsetAndLength[1],
                  })),
                  content: match.line,
                  startLine: match.lineNumber,
                  endLine: match.lineNumber,
                  aggregableBadges: match.aggregableBadges,
              })) ||
              []
            : []
    $: expandedMatchGroups = ranking.expandedResults(items, context)
    $: collapsedMatchGroups = ranking.collapsedResults(items, context)

    $: collapsible = items.length > collapsedMatchGroups.matches.length

    const sumHighlightRanges = (count: number, item: MatchItem): number => count + item.highlightRanges.length

    $: highlightRangesCount = items.reduce(sumHighlightRanges, 0)
    $: collapsedHighlightRangesCount = collapsedMatchGroups.matches.reduce(sumHighlightRanges, 0)

    $: hiddenMatchesCount = highlightRangesCount - collapsedHighlightRangesCount
    const searchResultContext = getContext('search-results')
    let expanded: boolean = searchResultContext?.isExpanded(result)
    $: expandButtonText = expanded
        ? 'Show less'
        : `Show ${hiddenMatchesCount} more ${pluralize('match', hiddenMatchesCount, 'matches')}`

    let root: HTMLElement
    let userInteracted = false
    $: if (!expanded && root && userInteracted) {
        setTimeout(() => {
            const reducedMotion = !window.matchMedia('(prefers-reduced-motion: no-preference)').matches
            root.scrollIntoView({ block: 'nearest', behavior: reducedMotion ? 'auto' : 'smooth' })
        }, 0)
    }
    $: searchResultContext.setExpanded(result, expanded)
</script>

<SearchResult {result}>
    <div slot="title">
        <a href={repoAtRevisionURL}>{displayRepoName(repoName)}</a>
        <span aria-hidden={true}>›</span>
        <a href={getFileMatchUrl(result)}>
            {#if fileBase}{fileBase}/{/if}<strong>{fileName}</strong>
        </a>
    </div>
    <div bind:this={root}>
        <FileMatchChildren {result} grouped={expanded ? expandedMatchGroups.grouped : collapsedMatchGroups.grouped} />
    </div>
    {#if collapsible}
        <button
            type="button"
            on:click={() => {
                expanded = !expanded
                userInteracted = true
            }}
            class:expanded
        >
            <Icon svgPath={expanded ? mdiChevronUp : mdiChevronDown} ariaLabel="" />
            <span>{expandButtonText}</span>
        </button>
    {/if}
</SearchResult>

<style lang="scss">
    button {
        width: 100%;
        text-align: left;
        border: none;
        padding: 0.25rem 0.5rem;
        background-color: var(--border-color);
        border-bottom-left-radius: var(--border-radius);
        border-bottom-right-radius: var(--border-radius);
        color: var(--collapse-results-color);
        cursor: pointer;

        &.expanded {
            position: sticky;
            bottom: 0;
        }
    }
</style>
