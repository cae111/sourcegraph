<script lang="ts">
    import logo from '$lib/images/sourcegraph-logo-light.svg'
    import SearchBox from '$lib/search/SearchBox.svelte'
    import type { QueryState } from '@sourcegraph/search'
    import { SearchPatternType } from '@sourcegraph/search'

    let queryState: QueryState = { query: '' }
</script>

<section>
    <img class="logo" src={logo} alt="Sourcegraph Logo" />
    <SearchBox {queryState} on:change={event => (queryState = event.detail)} patternType={SearchPatternType.literal} />
</section>

<style lang="scss">
    section {
        display: flex;
        flex-direction: column;
        align-items: center;
        overflow: auto;
        max-width: 64rem;
        align-self: center;

        :global(.search-box) {
            min-width: 60rem;
        }
    }

    img.logo {
        width: 20rem;
        margin-top: 6rem;
        max-width: 90%;
        min-height: 54px;
        margin-bottom: 3rem;
    }
</style>
