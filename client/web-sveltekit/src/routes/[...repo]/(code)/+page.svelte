<script lang="ts">
    import Commit from '$lib/Commit.svelte'
    import {
        mdiSourceCommit,
        mdiSourceRepository,
        mdiFolderOutline,
        mdiFileDocumentOutline,
        mdiSourceBranch,
        mdiTag,
		mdiAccount,
    } from '@mdi/js'
    import { isErrorLike } from '@sourcegraph/common'

    import type { PageData } from './$types'
    import Icon from '$lib/Icon.svelte'
	import { ButtonGroup, Button } from '$lib/wildcard';

    export let data: PageData

    const menu = [
        {path: '/-/commits', icon: mdiSourceCommit, title: 'Commits'},
        {path: '/-/branches', icon: mdiSourceBranch, title: 'Branches'},
        {path: '/-/tags', icon: mdiTag, title: 'Tags'},
        {path: '/-/stats/contributors', icon: mdiAccount, title: 'Contributors'},
    ]

    $: treeOrError = data.treeEntries
    $: commits = data.commits
</script>

<div class="content">
    <h1><Icon svgPath={mdiSourceRepository} /> {data.repoName}</h1>
    {#if !isErrorLike(data.resolvedRevision)}
        <p>
            {data.resolvedRevision.repo.description}
        </p>
    {/if}
    <p>
        <ButtonGroup>
            {#each menu as entry}
                <Button variant="secondary" outline>
                    <a slot="custom" let:className class={className} href="{data.repoURL}{entry.path}">
                        <Icon svgPath={entry.icon} inline /> {entry.title}
                    </a>
                </Button>
            {/each}
        </ButtonGroup>
    </p>

    {#if !$treeOrError.loading && $treeOrError.data && !isErrorLike($treeOrError.data)}
        <h3>Files and directories</h3>
        <ul class="files">
            {#each $treeOrError.data.entries as entry}
                <li>
                    <a
                        data-sveltekit-preload-data={entry.isDirectory ? 'hover' : 'tap'}
                        data-sveltekit-preload-code="hover"
                        href={entry.url}
                    ><Icon svgPath={entry.isDirectory ? mdiFolderOutline : mdiFileDocumentOutline} inline />
                        {entry.name}</a
                >
                </li>
            {/each}
        </ul>
    {/if}

    <h3 class="mt-3">Changes</h3>
    <ul class="commits">
        {#if $commits.loading}
            Loading...
        {:else if $commits.data}
            {#each $commits.data as commit (commit.url)}
                <li><Commit {commit} /></li>
            {/each}
        {/if}
    </ul>
</div>

<style lang="scss">
    .content {
        padding: 1rem;
        overflow: auto;
    }

    ul.commits {
        padding: 0;
        margin: 0;
        list-style: none;

        li {
            border-bottom: 1px solid var(--border-color);
            padding: 0.5rem 0;

            &:last-child {
                border: none;
            }
        }
    }

    ul.files {
        padding: 0;
        margin: 0;
        list-style: none;
        columns: 3;
    }
</style>
