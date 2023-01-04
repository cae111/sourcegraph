<script lang="ts">
    import CodeMirrorBlob from '$lib/CodeMirrorBlob.svelte'
    import FileTree from '$lib/FileTree.svelte'
    import TreeInfo from './TreeInfo.svelte'
    import type { PageData } from './$types'
    import { page } from '$app/stores'
    import Icon from '$lib/Icon.svelte'
    import { mdiChevronDoubleLeft, mdiChevronDoubleRight } from '@mdi/js'
    import WrapLinesAction, { lineWrap } from './WrapLinesAction.svelte'
    import FormatAction from './FormatAction.svelte'
    import type { BlobFileFields } from '@sourcegraph/web/src/graphql-operations'
    import HeaderAction from '$lib/repo/HeaderAction.svelte'

    export let data: PageData

    function last<T>(arr: T[]): T {
        return arr[arr.length - 1]
    }

    $: sidebarEntries = data.prefetch.sidebarEntries
    $: blob = data.prefetch.blob
    $: highlights = data.prefetch.highlights
    $: treeEntries = data.prefetch.treeEntries
    $: isBlob = data.type === 'blob'
    $: loading = $blob ? $blob.loading : $treeEntries.loading
    let blobData: BlobFileFields
    $: if ($blob && !$blob.loading && $blob.data) {
        blobData = $blob.data
    }
    $: formatted = !!blobData?.richHTML
    $: showRaw = $page.url.searchParams.get('view') === 'raw'
    $: showSidebar = true
</script>

{#if isBlob && (!formatted || showRaw)}
    <HeaderAction key="wrap-lines" priority={0} component={WrapLinesAction} />
{/if}
{#if formatted}
    <HeaderAction key="format" priority={-1} component={FormatAction} />
{/if}
<section>
    <div class="sidebar" class:open={showSidebar}>
        {#if showSidebar && !$sidebarEntries.loading && $sidebarEntries.data}
            <FileTree activeEntry={last($page.params.path.split('/'))} treeOrError={$sidebarEntries.data}>
                <h3 slot="title">
                    Files
                    <button on:click={() => (showSidebar = false)}
                        ><Icon svgPath={mdiChevronDoubleLeft} inline /></button
                    >
                </h3>
            </FileTree>
        {/if}
        {#if !showSidebar}
            <button class="open-sidebar" on:click={() => (showSidebar = true)}
                ><Icon svgPath={mdiChevronDoubleRight} inline /></button
            >
        {/if}
    </div>
    <div class="content" class:loading>
        {#if isBlob}
            {#if blobData}
                {#if blobData.richHTML && !showRaw}
                    <div class="rich">
                        {@html blobData.richHTML}
                    </div>
                {:else}
                    <CodeMirrorBlob
                        blob={blobData}
                        highlights={($highlights && !$highlights.loading && $highlights.data) || ''}
                        wrapLines={$lineWrap}
                    />
                {/if}
            {/if}
        {:else if !$treeEntries?.loading && $treeEntries?.data}
            <TreeInfo treeOrError={$treeEntries.data} />
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
        &.open {
            width: 200px;
        }

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

        &.loading {
            filter: blur(1px);
        }

        .rich {
            padding: 1rem;
            overflow: auto;
        }
    }

    button {
        border: 0;
        background-color: transparent;
        padding: 0;
        margin: 0;
        cursor: pointer;
    }

    h3 {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .open-sidebar {
        position: absolute;
        left: 0;
        border: 1px solid var(--border-color);
    }
</style>
