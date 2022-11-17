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

<div>
    <SearchBox {queryState} on:change={event => (queryState = event.detail)} {patternType} />
</div>

{#if $navigating}
    Loading...
{/if}

{#if results}
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
{/if}

<style lang="scss">
    ol {
        margin: 0;
        margin-top: 1rem;
        padding: 0;
        list-style: none;
    }
</style>
