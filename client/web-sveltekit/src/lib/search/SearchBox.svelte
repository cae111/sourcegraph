<script lang="ts">
    import { enhance } from '$app/forms'
    import { goto, invalidate } from '$app/navigation'
    import Icon from '$lib/Icon.svelte'
    import { mdiMagnify } from '@mdi/js'

    import type { QueryState, SearchPatternType } from '@sourcegraph/search'
    import CodeMirrorQueryInput from './CodeMirrorQueryInput.svelte'

    export let queryState: QueryState
    export let patternType: SearchPatternType

    let form: HTMLFormElement | null = null

    $: fullQuery = queryState.query

    async function handleSubmit(event: Event) {
        event.preventDefault()
        const url = `/search?q=${fullQuery}`
        await invalidate(`query:${fullQuery}`)
        // TODO: Replace URL if it's the same query
        await goto(url)
    }
</script>

<form class="search-box" bind:this={form} action="/search" method="get" on:submit={handleSubmit}>
    <input class="hidden" value={fullQuery} name="q" />
    <CodeMirrorQueryInput
        placeholder="Search for code or files"
        {queryState}
        on:change
        on:submit={handleSubmit}
        {patternType}
    />
    <button>
        <Icon ariaLabel="search" svgPath={mdiMagnify} inline />
    </button>
</form>

<style lang="scss">
    form {
        flex: 1;
        display: flex;
        align-items: center;
        background-color: var(--color-bg-1);
        padding-left: 0.5rem;
        border-top-left-radius: 5px;
        border-bottom-left-radius: 5px;
        border: 1px solid var(--border-color);
        margin: 2px;

        &:focus-within {
            outline: 0;
            box-shadow: var(--focus-box-shadow);
        }
    }

    .hidden {
        display: none;
    }

    button {
        padding: 0.5rem 1rem;
        border-top-right-radius: 5px;
        border-bottom-right-radius: 5px;
        background-color: var(--primary);
        border: none;
        color: var(--light-text);
        cursor: pointer;

        &:hover {
            background-color: var(--primary-3);
        }
    }
</style>
