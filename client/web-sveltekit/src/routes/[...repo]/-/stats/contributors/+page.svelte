<script lang="ts">
    import {goto} from '$app/navigation';
    import {page} from '$app/stores';
	import LoadingSpinner from '$lib/LoadingSpinner.svelte';
	import { getRelativeTime } from '$lib/relativeTime';
	import UserAvatar from '$lib/UserAvatar.svelte';
    import {currentDate} from '$lib/stores'

	import type { PageData } from "./$types";
	import { mdiPageFirst, mdiPageLast, mdiChevronRight, mdiChevronLeft } from '@mdi/js';
	import Icon from '$lib/Icon.svelte';

    export let data: PageData

    $: after = data.after
    $: timePeriod = after
    $: contributorsLoader = data.contributors
    $: loading = $contributorsLoader.loading
    let connection = null
    $: if (!$contributorsLoader.loading && $contributorsLoader.data) {
        connection = $contributorsLoader.data
    }

    async function setTimePeriod(event: MouseEvent) {
        const element = event.target as HTMLButtonElement
        timePeriod = element.dataset.value ?? ''
        const newURL = new URL($page.url)
        newURL.search = `after=${timePeriod}`
        await goto(newURL)
    }
</script>
<section>
    <div class="container">
        <form method="GET">
            Time period: <input name="after" bind:value={timePeriod} />
            <button type="button" data-value="7 days ago" on:click={setTimePeriod}>Last 7 days</button>
            <button type="button" data-value="30 days ago" on:click={setTimePeriod}>Last 30 days</button>
            <button type="button" data-value="1 year ago" on:click={setTimePeriod}>Last year</button>
            <button type="button" data-value="" on:click={setTimePeriod}>All time</button>
        </form>
        {#if !connection && loading}
            <LoadingSpinner />
        {:else if connection}
            {@const nodes = connection.nodes}
            <table class="mt-3">
                <tbody>
                    {#each nodes as contributor}
                        {@const commit = contributor.commits.nodes[0]}
                        <tr>
                            <td><span><UserAvatar user={contributor.person} /></span>&nbsp;<span>{contributor.person.displayName}</span></td>
                            <td>{getRelativeTime(new Date(commit.author.date), $currentDate)}: <a href={commit.url}>{commit.subject}</a></td>
                            <td>{contributor.count}&nbsp;commits</td>
                        </tr>
                    {/each}
                </tbody>
            </table>
            <div class="d-flex flex-column align-items-center">
                <form>
                    <input type="hidden" name="after" value={data.after} />
                    <button disabled={loading || !connection.pageInfo.hasPreviousPage}><Icon svgPath={mdiPageFirst} inline /></button>
                    <button disabled={loading || !connection.pageInfo.hasPreviousPage} name="pbefore" value={connection.pageInfo.startCursor}><Icon svgPath={mdiChevronLeft} inline />Previous</button>
                    <button disabled={loading || !connection.pageInfo.hasNextPage} name="pafter" value={connection.pageInfo.endCursor}>Next <Icon svgPath={mdiChevronRight} inline /></button>
                    <button disabled={loading || !connection.pageInfo.hasNextPage} name="last"><Icon svgPath={mdiPageLast} inline/></button>
                </form>
                <p>
                    <small>Total contributors: {connection.totalCount}</small>
                </p>
            </div>
        {/if}
    </div>
</section>

<style lang="scss">
    section {
        overflow: auto;
        margin-top: 2rem;
    }

    div.container {
        max-width: 54rem;
        margin-left: auto;
        margin-right: auto;
        margin-bottom: 1rem;
    }

    table {
        border-collapse: collapse;
    }

    td {
        padding: 0.5rem;
        border-bottom: 1px solid var(--border-color);

        tr:last-child & {
            border-bottom: none;
        }

        span {
            white-space: nowrap;
            text-overflow: ellipsis;
        }
    }
</style>
