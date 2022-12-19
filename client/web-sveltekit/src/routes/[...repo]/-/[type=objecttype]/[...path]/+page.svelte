<script lang="ts">
    import CodeMirrorBlob from '$lib/CodeMirrorBlob.svelte'
    import FileTree from '$lib/FileTree.svelte'
    import TreeInfo from './TreeInfo.svelte'
    import type { PageData } from './$types'
    import { page } from '$app/stores'

    export let data: PageData

    function last<T>(arr: T[]): T {
        return arr[arr.length - 1]
    }

    $: blob = data.prefetch.blob
    $: treeEntries = data.prefetch.treeEntries
</script>

<section>
    <div class="sidebar"><FileTree activeEntry={last($page.params.path.split('/'))} treeOrError={$treeEntries} /></div>
    <div class="content">
        {#if blob}
            {#await blob}
                Loading blob...
            {:then data}
                {#if data}
                    <CodeMirrorBlob blob={data} />
                {/if}
            {/await}
        {:else}
            <TreeInfo treeOrError={$treeEntries} />
        {/if}
    </div>
</section>

<style lang="scss">
    section {
        display: flex;
        overflow: hidden;
        margin: 1rem;
        margin-bottom: 0;
        flex: 1;
    }

    .sidebar {
        width: 200px;
        overflow: hidden;
        display: flex;
        flex-direction: column;
    }

    .content {
        flex: 1;
        overflow: auto;
        margin: 1rem;
        margin-bottom: 0;
        background-color: var(--color-bg-1);
        border-radius: var(--border-radius);
        overflow: hidden;
        display: flex;
        flex-direction: column;
        border: 1px solid var(--border-color);
        border-radius: var(--border-radius);
    }
</style>
