<script lang="ts">
    import Icon from '$lib/Icon.svelte'
    import { mdiFileDocumentOutline, mdiFolder, mdiFolderOutline } from '@mdi/js'
    import { page } from '$app/stores'
    import { isErrorLike, type ErrorLike } from '@sourcegraph/common'
    import type { TreeFields } from '@sourcegraph/shared/src/graphql-operations'

    export let treeOrError: TreeFields | ErrorLike | null

    $: entries = treeOrError && !isErrorLike(treeOrError) ? treeOrError.entries : []
</script>

<div class="root">
    <div class="header">
        <Icon svgPath={mdiFolder} ariaLabel="" />
        <h1>{$page.params.path}</h1>
    </div>
    <h2>Files and directories</h2>
    <ul>
        {#each entries as entry}
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
</div>

<style lang="scss">
    .root {
        padding: 1rem;
    }

    .header {
        display: flex;
        align-items: center;

        h1 {
            margin: 0;
            margin-left: 1rem;
        }
    }

    ul {
        list-style: none;
        padding: 0;
        margin: 0;
    }
</style>
