<script lang="ts">
    import type { PageData } from './$types'
    import SearchHome from './SearchHome.svelte'
    import SearchResults from './SearchResults.svelte'

    export let data: PageData
</script>

{#if data.query && data.stream}
    <SearchResults stream={data.stream} query={data.query} />
{:else}
    <SearchHome />
{/if}
