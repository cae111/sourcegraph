<script lang="ts">
	import { displayRepoName, splitPath } from "$lib/shared/repo";
	import { getFileMatchUrl, getRepositoryUrl, type ContentMatch } from "@sourcegraph/shared/src/search/stream";
	import SearchResult from "./SearchResult.svelte";


    export let result: ContentMatch

    $: repoName = result.repository
    $: repoAtRevisionURL = getRepositoryUrl(result.repository, result.branches)
    $: [fileBase, fileName] = splitPath(result.path)
</script>

<SearchResult {result}>
    <div slot="title">
        <a href={repoAtRevisionURL}>{displayRepoName(repoName)}</a>
        <span aria-hidden={true}>›</span>
        <a href={getFileMatchUrl(result)}>
            {#if fileBase}{fileBase}/{/if}<strong>{fileName}</strong>
        </a>
    </div>
</SearchResult>
