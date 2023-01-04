<script lang="ts">
    import Header from './Header.svelte'
    import './styles.scss'
    import { settings } from '$lib/stores'
    import type { LayoutData } from './$types'

    export let data: LayoutData

    $: authenticatedUser = data.user

    $: console.log($settings)
</script>

<svelte:head>
    <title>Sourcegraph</title>
    <meta name="description" content="Code search" />
</svelte:head>

<div class="app theme-light">
    <Header {authenticatedUser} />

    <main>
        <slot />
    </main>
</div>

<style>
    .app {
        display: flex;
        flex-direction: column;
        height: 100vh;
        overflow: hidden;
    }

    main {
        flex: 1;
        display: flex;
        flex-direction: column;
        box-sizing: border-box;
        overflow: hidden;
    }
</style>
