<section>
    <div class="tree">File tree</div>
    <div class="blob">
        <slot />
    </div>
</section>

<style>
    section {
        display: flex;
        overflow: hidden;
    }

    .tree {
        width: 200px;
    }

    .blob {
        flex: 1;
        overflow: auto;
        margin: 1rem;
        padding: 1rem;
        background-color: var(--color-bg-1);
        border-radius: 5px;
    }
</style>
