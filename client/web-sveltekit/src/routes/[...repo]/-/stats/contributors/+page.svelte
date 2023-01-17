<script lang="ts">
    import {goto} from '$app/navigation';
    import {page} from '$app/stores';
	import LoadingSpinner from '$lib/LoadingSpinner.svelte';
	import { getRelativeTime } from '$lib/relativeTime';
	import UserAvatar from '$lib/UserAvatar.svelte';
    import {currentDate} from '$lib/stores'

	import type { PageData } from "./$types";
	import Paginator from '$lib/Paginator.svelte';

    export let data: PageData

    $: timePeriod = data.after
    $: contributorsLoader = data.contributors
    $: loading = $contributorsLoader.loading
    let connection: Extract<typeof $contributorsLoader, {loading: false}>['data'];
    $: if (!$contributorsLoader.loading && $contributorsLoader.data) {
        connection = $contributorsLoader.data
    }

    async function setTimePeriod(event: MouseEvent) {
        const element = event.target as HTMLButtonElement
        timePeriod = element.dataset.value ?? ''
        const newURL = new URL($page.url)
        newURL.search = `after=${timePeriod}`
        connection = null
        await goto(newURL)
    }
</script>
<section>
    <div class="container">
        <form method="GET">
            Time period: <input name="after" bind:value={timePeriod} placeholder="All time"/>
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
                <Paginator disabled={loading} pageInfo={connection.pageInfo} />
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
