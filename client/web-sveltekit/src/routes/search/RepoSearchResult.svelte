<script lang="ts">
	import { displayRepoName, splitPath } from "$lib/shared/repo";
	import { getFileMatchUrl, getRepoMatchLabel, getRepoMatchUrl, getRepositoryUrl, type ContentMatch, type RepositoryMatch } from "@sourcegraph/shared/src/search/stream";
	import SearchResult from "./SearchResult.svelte";


    export let result: RepositoryMatch

    $: repoName = getRepoMatchLabel(result)
    $: repoAtRevisionURL = getRepoMatchUrl(result)
</script>

<SearchResult {result}>
    <div slot="title">
        <a href={repoAtRevisionURL}>{repoName}</a>
    </div>
</SearchResult>
