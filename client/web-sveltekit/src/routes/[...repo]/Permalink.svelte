<script lang="ts">
    import { mdiLink } from '@mdi/js'
    import { replaceRevisionInURL } from '@sourcegraph/web/src/util/url'
    import { page } from '$app/stores'
    import { isErrorLike } from '@sourcegraph/common'
    import Icon from '$lib/Icon.svelte'

    $: resolvedRevision = isErrorLike($page.data.resolvedRevision) ? null : $page.data.resolvedRevision

    $: href = resolvedRevision
        ? replaceRevisionInURL($page.url.pathname + $page.url.search + $page.url.hash, resolvedRevision.commitID)
        : ''
</script>

{#if href}
    <a {href}><Icon svgPath={mdiLink} inline /></a>
{/if}
