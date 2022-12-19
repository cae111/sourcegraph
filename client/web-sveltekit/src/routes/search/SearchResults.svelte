<script context="module" lang="ts">
    interface Cache {
        scrollPosition: number
        count: number
        expanded: Set<SearchMatch>
    }
    const cache = new Map<string, Cache>()

    const DEFAULT_INITIAL_ITEMS_TO_SHOW = 15
    const INCREMENTAL_ITEMS_TO_SHOW = 10
</script>

<script lang="ts">
    import type { AggregateStreamingSearchResults, SearchMatch } from '@sourcegraph/shared/src/search/stream'
    import { SearchPatternType } from '@sourcegraph/search'
    import type { QueryState } from '@sourcegraph/search'
    import SearchBox from '$lib/search/SearchBox.svelte'
    import type { Observable } from 'rxjs'
    import FileSearchResult from './FileSearchResult.svelte'
    import RepoSearchResult from './RepoSearchResult.svelte'
    import { beforeNavigate } from '$app/navigation'
    import VirtualList from '$lib/VirtualList.svelte'
    import { writable } from 'svelte/store'
    import { setContext } from 'svelte'

    export let query: string
    export let stream: Observable<AggregateStreamingSearchResults | undefined>

    let patternType: SearchPatternType = SearchPatternType.literal
    let resultContainer = writable<HTMLElement | null>(null)
    let queryState: QueryState

    setContext('scroll-container', resultContainer)

    $: queryState = {
        query,
    }

    $: loading = $stream && !$stream.progress.done
    $: results = $stream && $stream.results

    // Logic for maintaining list state (scroll position, rendered items, open
    // items) for backwards navigation.
    $: cacheEntry = cache.get(query)
    $: count = cacheEntry?.count ?? DEFAULT_INITIAL_ITEMS_TO_SHOW
    $: scrollPosition = cacheEntry?.scrollPosition ?? 0
    $: expandedSet = cacheEntry?.expanded || new Set<SearchMatch>()
    $: if ($resultContainer) {
        $resultContainer.scrollTop = scrollPosition
    }

    setContext('search-results', {
        isExpanded(match: SearchMatch): boolean {
            return expandedSet.has(match)
        },
        setExpanded(match: SearchMatch, expanded: boolean): void {
            if (expanded) {
                expandedSet.add(match)
            } else {
                expandedSet.delete(match)
            }
        },
    })
    beforeNavigate(() => {
        cache.set(query, { count, scrollPosition: $resultContainer?.scrollTop ?? 0, expanded: expandedSet })
    })

    $: matchCount = $stream ? $stream.progress.matchCount + ($stream.progress.skipped.length > 0 ? '+' : '') : ''

    function loadMore(event: { detail: boolean }) {
        if (event.detail) {
            count += INCREMENTAL_ITEMS_TO_SHOW
        }
    }
</script>

<section>
    <div class="search">
        <SearchBox {queryState} on:change={event => (queryState = event.detail)} {patternType} />
    </div>

    <div class="results" bind:this={$resultContainer}>
        <div class="scroll-container">
            {#if !$stream || loading}
                <div>Loading...</div>
            {/if}

            {#if !loading && results}
                {#if matchCount}
                    <div>
                        {matchCount} results in {$stream?.progress.durationMs}ms
                    </div>
                {/if}
                <VirtualList
                    as="ol"
                    scrollParent={$resultContainer}
                    {count}
                    items={results}
                    let:item={result}
                    on:intersecting={loadMore}
                >
                    <li>
                        {#if result.type === 'content'}
                            <FileSearchResult {result} />
                        {:else if result.type === 'repo'}
                            <RepoSearchResult {result} />
                        {/if}
                    </li>
                </VirtualList>
            {/if}
        </div>
    </div>
</section>

<style lang="scss">
    .search {
        border-bottom: 1px solid var(--border-color);
        display: flex;
        align-self: stretch;
        padding: 1rem;
    }

    section {
        flex: 1;
        display: flex;
        align-items: center;
        flex-direction: column;
        overflow: hidden;

        :global(.search-box) {
            align-self: stretch;
        }
    }

    .results {
        flex: 1;
        align-self: stretch;
        overflow: auto;

        .scroll-container {
            padding: 1rem;
        }
    }
</style>
