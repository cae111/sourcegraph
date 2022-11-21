<script lang="ts">
    import { navigating, page } from '$app/stores'
    import type { AggregateStreamingSearchResults } from '@sourcegraph/shared/src/search/stream'
    import { SearchPatternType } from '@sourcegraph/search'
    import type { QueryState } from '@sourcegraph/search'
    import SearchBox from '$lib/search/SearchBox.svelte'
    import type { Observable } from 'rxjs'
    import FileSearchResult from './FileSearchResult.svelte'
    import RepoSearchResult from './RepoSearchResult.svelte'

    export let stream: Observable<AggregateStreamingSearchResults>
    let patternType: SearchPatternType = SearchPatternType.literal

    $: submittedURLQuery = $page.url.searchParams.get('q') ?? ''
    $: results = $stream && $stream.results

    let queryState: QueryState
    $: queryState = {
        query: submittedURLQuery,
    }
</script>

<section>
    <SearchBox {queryState} on:change={event => (queryState = event.detail)} {patternType} />

    {#if !$stream}
        <div>Loading...</div>
    {/if}

    {#if results}
        <div class="results">
            <ol>
                {#each results as result, index (index)}
                    <li>
                        {#if result.type === 'content'}
                            <FileSearchResult {result} />
                        {:else if result.type === 'repo'}
                            <RepoSearchResult {result} />
                        {/if}
                    </li>
                {/each}
            </ol>
        </div>
    {/if}
</section>

<style lang="scss">
    section {
        flex: 1;
        display: flex;
        align-items: center;
        flex-direction: column;
        padding: 2rem 2rem 0 2rem;
        overflow: hidden;

        :global(.search-box) {
            align-self: stretch;
        }
    }
    ol {
        margin: 0;
        padding: 0;
        margin-top: 1rem;
        list-style: none;
    }

    .results {
        align-self: stretch;
        overflow: auto;
    }
</style>
