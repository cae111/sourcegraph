<script lang="ts">
    import { page } from '$app/stores'
    import Icon from '$lib/Icon.svelte'
    import { mdiChevronRight, mdiSourceRepository } from '@mdi/js'
    import { isErrorLike } from '@sourcegraph/common'
    import type { LayoutData } from './$types'

    export let data: LayoutData

    function navFromPath(path: string, repo: string, blobPage: boolean): [string, string][] {
        const parts = path.split('/')
        return parts
            .slice(0, -1)
            .map((part, index, all): [string, string] => [part, `/${repo}/-/tree/${all.slice(0, index + 1).join('/')}`])
            .concat([[parts[parts.length - 1], `/${repo}/-/${blobPage ? 'blob' : 'tree'}/${path}`]])
    }

    $: ({ repo, path } = $page.params)
    $: nav = path ? navFromPath(path, repo, $page.url.pathname.includes('/-/blob/')) : []
</script>

{#if isErrorLike(data.resolvedRevision)}
    Something went wrong
{:else}
    <nav>
        <a class="repo" href="/{repo}"><Icon svgPath={mdiSourceRepository} inline /> {repo}</a>
        {#if nav.length > 0}
            <Icon svgPath={mdiChevronRight} inline />
            <span class="crumps">
                {#each nav as [label, url]}
                    <span>/</span>
                    <a href={url}>{label}</a>&nbsp;
                {/each}
            </span>
        {/if}
    </nav>
    <slot />
{/if}

<style>
    nav {
        margin: 1rem 1rem 0 1rem;
        color: var(--body-color);
    }

    .crumps {
        color: var(--link-color);
    }

    .repo {
        color: var(--body-color);
        border: 1px solid var(--border-color);
        padding: 0.25rem 0.5rem;
        border-radius: var(--border-radius);
        text-decoration: none;
    }
</style>
