<script>
    import Header from './Header.svelte'
    import './styles.scss'
</script>

<div class="app theme-light">
    <Header />

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
