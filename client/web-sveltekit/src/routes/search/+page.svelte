<script lang="ts">
    import QueryExamples from './QueryExamples.svelte'
    import { getQueryExamples } from '$lib/search/queryExamples'

    import type { PageData } from './$types'
    import SearchHome from './SearchHome.svelte'
    import SearchResults from './SearchResults.svelte'

    export let data: PageData

    const queryExamples = getQueryExamples()
</script>

{#if data.stream}
    <SearchResults stream={data.stream} query={data.query ?? ''} queryOptions={data.queryOptions} />
{:else}
    <SearchHome>
        <div class="mt-5">
            <QueryExamples examples={queryExamples} />
        </div>
    </SearchHome>
{/if}
