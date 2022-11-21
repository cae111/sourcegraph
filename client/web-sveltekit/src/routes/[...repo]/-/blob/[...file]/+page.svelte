<script lang="ts">
    import CodeMirrorBlob from '$lib/CodeMirrorBlob.svelte'
    import type { PageData } from './$types'

    export let data: PageData
    $: blob = data.blob.blob
</script>

{#await blob}
    Loading blob...
{:then data}
    <CodeMirrorBlob value={data?.content ?? ''} />
{/await}
