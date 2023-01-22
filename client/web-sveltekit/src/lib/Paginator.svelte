<script context="module" lang="ts">
    enum Param {
        before = '$before',
        after = '$after',
        last = '$last'
    }

    export function getPaginationParams(searchParams: URLSearchParams, pageSize: number): {first: number, last: null, before: null, after: string|null}|{first: null, last: number, before: string|null, after: null} {
        if (searchParams.has('$before')) {
            return {first: null, last: pageSize, before: searchParams.get(Param.before), after: null}
        } else if (searchParams.has('$after')) {
            return {first: pageSize, last: null, before: null, after: searchParams.get(Param.after)}
        } else if (searchParams.has('$last')) {
            return {first: null, last: pageSize, before: null, after: null}
        } else {
            return {first: pageSize, last: null, before: null, after: null}
        }
    }
</script>

<script lang="ts">
	import Icon from "./Icon.svelte";
	import { mdiPageFirst, mdiPageLast, mdiChevronRight, mdiChevronLeft } from '@mdi/js';
    import {page} from '$app/stores'

    export let pageInfo: {hasPreviousPage: boolean, hasNextPage: boolean, startCursor: string|null, endCursor: string|null}
    export let disabled: boolean

    function urlWithParameter(name: string, value: string|null): string  {
        const url = new URL($page.url)
        url.searchParams.delete(Param.before)
        url.searchParams.delete(Param.after)
        url.searchParams.delete(Param.last)
        if (value !== null) {
            url.searchParams.set(name, value)
        }
        return url.toString()
    }

    let firstPageURL = urlWithParameter('', null)
    let lastPageURL = urlWithParameter(Param.last, '')
    $: previousPageURL = urlWithParameter(Param.before, pageInfo.startCursor)
    $: nextPageURL = urlWithParameter(Param.after, pageInfo.endCursor)
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
