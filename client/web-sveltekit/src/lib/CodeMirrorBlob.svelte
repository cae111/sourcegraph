<script lang="ts">
    import { browser } from '$app/environment'

    import { EditorState } from '@codemirror/state'

    import { EditorView, lineNumbers } from '@codemirror/view'

    export let value: string
    let editor: EditorView
    let container: HTMLDivElement | null = null

    function createEditor(container: HTMLDivElement): EditorView {
        const extensions = [
            lineNumbers(),
            EditorView.theme({
                '.cm-scroller': {
                    overflow: 'auto',
                },
            }),
        ]

        const view = new EditorView({
            state: EditorState.create({ doc: value, extensions }),
            parent: container,
        })
        return view
    }

    function e(): EditorView | null {
        return editor
    }

    $: if (container) {
        editor = createEditor(container)
    }

    $: if (e() && e()?.state.sliceDoc() !== value) {
        const view = e()
        view?.dispatch({
            changes: { from: 0, to: view.state.doc.length, insert: value },
        })
    }
</script>

{#if browser}
    <div bind:this={container} class="root test-query-input test-editor" data-editor="codemirror6" />
{:else}
    <div class="root">
        <pre>{value}</pre>
    </div>
{/if}

<style lang="scss">
    .root {
        overflow: hidden;
    }
    pre {
        margin: 0;
    }
</style>
