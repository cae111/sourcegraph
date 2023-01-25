<script lang="ts">
    import logoLight from '$lib/images/sourcegraph-logo-light.svg'
    import logoDark from '$lib/images/sourcegraph-logo-dark.svg'
    import SearchBox from '$lib/search/SearchBox.svelte'
    import { queryStateStore } from '$lib/search/state'
    import type { SearchPageContext } from '$lib/search/utils'
    import { settings, isLightTheme } from '$lib/stores'
    import { SearchPatternType } from '@sourcegraph/shared/src/graphql-operations'
    import { setContext } from 'svelte'

    // TODO: Shared query store?
    const queryState = queryStateStore({}, $settings)
    $: queryState.setSettings($settings)

    setContext<SearchPageContext>('search-context', {
        setQuery(newQuery) {
            queryState.setQuery(newQuery)
        },
    })
</script>

<section>
    <div class="content">
        <img class="logo" src={$isLightTheme ? logoLight : logoDark} alt="Sourcegraph Logo" />
        <div class="search">
            <SearchBox autoFocus {queryState} patternType={SearchPatternType.literal} selectedSearchContext="global" />
        </div>
        <slot />
    </div>
</section>

<style lang="scss">
    section {
        overflow-y: auto;
        padding: 0 1rem;
        display: flex;
        flex-direction: column;
        flex: 1;
        align-items: center;
    }

    div.content {
        flex-shrink: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        width: 100%;
        max-width: 64rem;
        overflow-x: hidden;

        :global(.search-box) {
            align-self: stretch;
        }
    }

    .search {
        width: 100%;
    }

    img.logo {
        width: 20rem;
        margin-top: 6rem;
        max-width: 90%;
        min-height: 54px;
        margin-bottom: 3rem;
    }
</style>
