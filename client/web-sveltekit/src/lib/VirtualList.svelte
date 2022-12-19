<script lang="ts">
    import { observeIntersection } from './intersection-observer'

    type T = $$Generic
    export let items: T[]
    export let count: number
    export let as: 'ul' | 'ol' = 'ul'
    export let scrollParent: HTMLElement | null = null

    let root: HTMLElement

    $: itemsToShow = items.slice(0, count)
</script>

<svelte:element this={as} class="list" bind:this={root}>
    {#each itemsToShow as item}
        <slot {item} />
    {/each}
    <div use:observeIntersection={scrollParent ?? root} on:intersecting />
</svelte:element>

<style lang="scss">
    .list {
        margin: 0;
        padding: 0;
        list-style: none;
        margin-top: 1rem;
    }
    div {
        height: 10px;
    }
</style>
