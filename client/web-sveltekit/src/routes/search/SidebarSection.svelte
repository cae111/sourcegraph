<script lang="ts">
    import Icon from '$lib/Icon.svelte'
    import Tooltip from '$lib/Tooltip.svelte'
    import { mdiChevronDown, mdiChevronUp } from '@mdi/js'
    import type { Filter } from '@sourcegraph/shared/src/search/stream'

    export let items: Filter[]
    export let title: string

    let open = true
</script>

<button class="header" type="button" on:click={() => (open = !open)}>
    <header><h5>{title}</h5></header>
    <Icon svgPath={open ? mdiChevronUp : mdiChevronDown} inline --color="var(--icon-color)" />
</button>

{#if open}
    <ul>
        {#each items as item}
            <li>
                <button class="item" on:click data-value={item.value}>
                    <span class="label">{item.label}</span>
                    <Tooltip tooltip="At least {item.count} results match this filter.">
                        <span class="count">{item.count}</span>
                    </Tooltip>
                </button>
            </li>
        {/each}
    </ul>
{/if}

<style lang="scss">
    ul {
        margin: 0;
        padding: 0;
        list-style: none;
    }

    button {
        width: 100%;
        text-align: left;
        border-radius: 3px;
        background-color: transparent;

        &:hover {
            background-color: var(--color-bg-2);
        }
    }

    button.header {
        cursor: pointer;
        padding: 0.25rem;
        margin: 0;
        border: 0;
        display: flex;
        align-items: center;

        header {
            flex: 1;
        }
    }

    button.item {
        cursor: pointer;
        font-size: 0.75rem;
        padding: 0.25rem 0.375rem;
        margin: 0;
        border: none;
        display: flex;

        .label {
            flex: 1;
        }

        .count {
            color: var(--link-color);
        }
    }
</style>
