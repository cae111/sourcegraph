<script lang="ts">
	import Icon from "./Icon.svelte";
	import { mdiPageFirst, mdiPageLast, mdiChevronRight, mdiChevronLeft } from '@mdi/js';
    import {page} from '$app/stores'

    export let pageInfo: {hasPreviousPage: boolean, hasNextPage: boolean, startCursor: string|null, endCursor: string|null}
    export let disabled: boolean

    function urlWithParameter(name: string, value: string|null) {
        const url = new URL($page.url)
        url.searchParams.delete('$before')
        url.searchParams.delete('$after')
        url.searchParams.delete('$last')
        if (value !== null) {
            url.searchParams.set(name, value)
        }
        return url
    }

    $: firstPageURL = urlWithParameter('', null).toString()
    $: previousPageURL = urlWithParameter('$before', pageInfo.startCursor).toString()
    $: nextPageURL = urlWithParameter('$after', pageInfo.endCursor).toString()
    $: lastPageURL = urlWithParameter('$last', '').toString()
</script>

<div>
    <a href={firstPageURL} class:disabled={disabled||!pageInfo.hasPreviousPage}><Icon svgPath={mdiPageFirst} inline /></a>
    <a href={previousPageURL} class:disabled={disabled||!pageInfo.hasPreviousPage}><Icon svgPath={mdiChevronLeft} inline />Previous</a>
    <a href={nextPageURL} class:disabled={disabled||!pageInfo.hasNextPage}>Next <Icon svgPath={mdiChevronRight} inline /></a>
    <a href={lastPageURL} class:disabled={disabled||!pageInfo.hasNextPage}><Icon svgPath={mdiPageLast} inline /></a>
</div>

<style lang="scss">
    a {
        color: var(--body-color);
        padding: 0.125rem 0.5rem;
        border-radius: var(--border-radius);
        border: 1px solid var(--border-color);

        &.disabled {
            pointer-events: none;
            cursor: not-allowed;
            color: var(--text-muted);
        }
    }
</style>
