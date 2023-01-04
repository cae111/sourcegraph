<script lang="ts">
    import { invalidate } from '$app/navigation'
    import Icon from '$lib/Icon.svelte'
    import Tooltip from '$lib/Tooltip.svelte'
    import { mdiCodeBrackets, mdiFormatLetterCase, mdiMagnify, mdiRegex } from '@mdi/js'
    import { SearchPatternType } from '@sourcegraph/shared/src/graphql-operations'

    import CodeMirrorQueryInput from './CodeMirrorQueryInput.svelte'
    import { queryStateStore, submitSearch } from './state'

    export let queryState: ReturnType<typeof queryStateStore>
    export let patternType: SearchPatternType
    export let selectedSearchContext: string
    export let autoFocus = false

    $: regularExpressionEnabled = $queryState.patternType === SearchPatternType.regexp
    $: structuralEnabled = $queryState.patternType === SearchPatternType.structural

    function setOrUnsetPatternType(patternType: SearchPatternType): void {
        queryState.setPatternType(currentPatternType =>
            currentPatternType === patternType ? SearchPatternType.standard : patternType
        )
    }

    async function handleSubmit(event: Event) {
        event.preventDefault()
        const currentQueryState = $queryState
        await invalidate(`query:${$queryState.query}--${$queryState.caseSensitive}`)
        submitSearch(currentQueryState)
    }
</script>

<form class="search-box" action="/search" method="get" on:submit={handleSubmit}>
    <input class="hidden" value={$queryState.query} name="q" />
    <span class="context"><span class="search-filter-keyword">context:</span><span>{selectedSearchContext}</span></span>
    <span class="divider" />
    <CodeMirrorQueryInput
        {autoFocus}
        placeholder="Search for code or files"
        queryState={$queryState}
        on:change={event => queryState.setQuery(event.detail.query)}
        on:submit={handleSubmit}
        {patternType}
    />
    <Tooltip tooltip={`${$queryState.caseSensitive ? 'Disable' : 'Enable'} case sensitivity`}>
        <button
            class="toggle"
            type="button"
            class:active={$queryState.caseSensitive}
            on:click={() => queryState.setCaseSensitive(caseSensitive => !caseSensitive)}
        >
            <Icon svgPath={mdiFormatLetterCase} inline />
        </button>
    </Tooltip>
    <Tooltip tooltip={`${regularExpressionEnabled ? 'Disable' : 'Enable'} regular expression`}>
        <button
            class="toggle"
            type="button"
            class:active={regularExpressionEnabled}
            on:click={() => setOrUnsetPatternType(SearchPatternType.regexp)}
        >
            <Icon svgPath={mdiRegex} inline />
        </button>
    </Tooltip>
    <Tooltip tooltip={`${structuralEnabled ? 'Disable' : 'Enable'} structural search`}>
        <button
            class="toggle"
            type="button"
            class:active={structuralEnabled}
            on:click={() => setOrUnsetPatternType(SearchPatternType.structural)}
        >
            <Icon svgPath={mdiCodeBrackets} inline />
        </button>
    </Tooltip>
    <button class="submit">
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

    .context {
        font-family: var(--code-font-family);
        font-size: 0.75rem;
    }

    button.toggle {
        width: 1.5rem;
        height: 1.5rem;
        padding: 0;
        margin: 0;
        border: 0;
        background-color: transparent;
        cursor: pointer;
        border-radius: var(--border-radius);
        display: flex;
        align-items: center;
        justify-content: center;

        &.active {
            background-color: var(--primary);
            color: var(--light-text);
        }

        :global(svg) {
            transform: scale(1.172);
        }
    }

    button.submit {
        margin-left: 1rem;
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

    .divider {
        width: 1px;
        height: 1rem;
        background-color: var(--border-color-2);
        margin: 0 0.5rem;
    }
</style>
