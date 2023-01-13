<script lang="ts">
    import {goto} from '$app/navigation';
    import {page} from '$app/stores';
	import LoadingSpinner from '$lib/LoadingSpinner.svelte';
	import { getRelativeTime } from '$lib/relativeTime';
	import UserAvatar from '$lib/UserAvatar.svelte';
    import {currentDate} from '$lib/stores'

	import type { PageData } from "./$types";
	import { mdiPageFirst, mdiPageLast, mdiPageNext, mdiPagePrevious } from '@mdi/js';
	import Icon from '$lib/Icon.svelte';

    export let data: PageData

    $: after = data.after
    $: timePeriod = after
    $: contributors = data.contributors

    async function setTimePeriod(event: MouseEvent) {
        const element = event.target as HTMLButtonElement
        timePeriod = element.dataset.value ?? ''
        const newURL = new URL($page.url)
        newURL.searchParams.set('after', timePeriod)
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
        {#if $contributors.loading}
            <LoadingSpinner />
        {:else if $contributors.data}
            {@const connection = $contributors.data}
            {@const nodes = connection.nodes}
            <table class="mt-3">
                <tbody>
                    {#each nodes as contributor}
                        {@const commit = contributor.commits.nodes[0]}
                        <tr>
                            <td><UserAvatar user={contributor.person} /> {contributor.person.displayName}</td>
                            <td>{getRelativeTime(new Date(commit.author.date), $currentDate)}: <a href={commit.url}>{commit.subject}</a></td>
                            <td>{contributor.count} commits</td>
                        </tr>
                    {/each}
                </tbody>
            </table>
            <div>
                <form action="?after={$page.url.searchParams.get('after')}">
                    <button disabled={connection.pageInfo.has}><Icon svgPath={mdiPageFirst} /></button>
                    <button disabled={connection.pageInfo.hasPreviousPage} name="pbefore" value={connection.pageInfo.startCursor}><Icon svgPath={mdiPagePrevious} />Previous</button>
                    <button name="pafter" value={connection.pageInfo.endCursor}>Next <Icon svgPath={mdiPageNext} /></button>
                    <button name="last"><Icon svgPath={mdiPageLast} /></button>
                </form>
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
    }
</style>
