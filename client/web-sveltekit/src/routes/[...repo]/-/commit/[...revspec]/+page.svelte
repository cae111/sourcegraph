<script lang="ts">
    import type { PageData } from './$types'
    import Commit from '$lib/Commit.svelte'
    import FileDiff from './FileDiff.svelte'

    export let data: PageData

    $: ({ commit, diff } = data.prefetch)
</script>

{#if $commit}
    <section>
        <div class="header">
            <div class="info"><Commit commit={$commit} alwaysExpanded /></div>
            <div>
                <span>Commit:&nbsp;{$commit.abbreviatedOID}</span>
                <span class="parents">
                    {$commit.parents.length} parents:
                    {#each $commit.parents as parent}
                        <a href={parent.url}>{parent.abbreviatedOID}</a>{' '}
                    {/each}
                </span>
            </div>
        </div>
        {#if $diff}
            <ul>
                {#each $diff.nodes as node}
                    <li><FileDiff fileDiff={node} /></li>
                {/each}
            </ul>
        {/if}
    </section>
{/if}

<style lang="scss">
    section {
        padding: 1rem;
        overflow: auto;
    }

    .header {
        display: flex;
    }

    .parents {
        white-space: nowrap;
    }
    .info {
        flex: 1;
    }

    ul {
        list-style: none;

        li {
            margin-bottom: 1rem;
        }
    }
</style>
