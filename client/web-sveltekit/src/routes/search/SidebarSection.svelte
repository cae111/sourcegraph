<script lang="ts">
    import Icon from '$lib/Icon.svelte'
    import type { SidebarFilter } from '$lib/search/utils'
    import Tooltip from '$lib/Tooltip.svelte'
    import { mdiChevronDown, mdiChevronUp } from '@mdi/js'

    export let items: SidebarFilter[]
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
                <button class="item" on:click data-value={item.value} data-run={item.runImmediately}>
                    <span class="label">{item.label}</span>
                    {#if item.count !== undefined}
                        <Tooltip tooltip="At least {item.count} results match this filter.">
                            <span class="count">{item.count}</span>
                        </Tooltip>
                    {/if}
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
