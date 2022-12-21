<script lang="ts">
    import { isErrorLike, type ErrorLike } from '@sourcegraph/common'
    import type { TreeFields } from '@sourcegraph/shared/src/graphql-operations'
    import Icon from './Icon.svelte'
    import { mdiFileDocumentOutline, mdiFolderOutline } from '@mdi/js'

    export let treeOrError: TreeFields | ErrorLike | null
    export let activeEntry: string

    $: entries = !isErrorLike(treeOrError) && treeOrError ? treeOrError.entries : []
</script>

<h3>Files</h3>
<ul>
    {#each entries as entry}
        <li class:active={entry.name === activeEntry}>
            <a href={entry.url}>
                <span>
                    <Icon svgPath={entry.isDirectory ? mdiFolderOutline : mdiFileDocumentOutline} inline />
                </span>
                {entry.name}
            </a>
        </li>
    {/each}
</ul>

<style lang="scss">
    ul {
        flex: 1;
        list-style: none;
        padding: 0;
        margin: 0;
        overflow: auto;
        min-height: 0;
        background-color: var(--body-bg);
    }

    a {
        white-space: nowrap;
        color: var(--body-color);
    }

    .active {
        background-color: var(--color-bg-3);
    }

    span {
        position: sticky;
        left: 0;
        background-color: inherit;
    }
</style>
