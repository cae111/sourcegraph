<script lang="ts">
    import logo from '$lib/images/sourcegraph-logo-light.svg'
    import SearchBox from '$lib/search/SearchBox.svelte'
    import { queryStateStore } from '$lib/search/state'
    import type { SearchPageContext } from '$lib/search/utils'
    import { SearchPatternType } from '@sourcegraph/shared/src/graphql-operations'
    import { setContext } from 'svelte'

    let queryState = queryStateStore()

    setContext<SearchPageContext>('search-context', {
        setQuery(newQuery) {
            queryState.setQuery(newQuery)
        },
    })
</script>

<section>
    <img class="logo" src={logo} alt="Sourcegraph Logo" />
    <SearchBox autoFocus {queryState} patternType={SearchPatternType.literal} selectedSearchContext="global" />
    <slot />
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
