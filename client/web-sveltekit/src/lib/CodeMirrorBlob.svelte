<script lang="ts">
    import { browser } from '$app/environment'

    import { EditorState } from '@codemirror/state'

    import { EditorView, lineNumbers } from '@codemirror/view'
    import { syntaxHighlight } from '@sourcegraph/web/src/repo/blob/codemirror/highlight'
    import type { BlobFileFields } from '@sourcegraph/web/src/graphql-operations'
    import '@sourcegraph/branded/src/global-styles/highlight.scss'

    export let blob: BlobFileFields
    let editor: EditorView
    let container: HTMLDivElement | null = null

    function createEditor(container: HTMLDivElement): EditorView {
        const extensions = [
            lineNumbers(),
            syntaxHighlight.of({ content: blob.content, lsif: blob.highlight.lsif }),
            EditorView.theme({
                '&': {
                    'min-height': 0,
                    color: 'var(--color-code)',
                },
                '.cm-scroller': {
                    overflow: 'auto',
                    'font-family': 'var(--code-font-family)',
                    'font-size': 'var(--code-font-size)',
                },
                '.cm-gutters': {
                    'background-color': 'var(--bg-code)',
                    border: 'none',
                    color: 'var(--line-number-color)',
                    'padding-right': '1rem',
                },
                '.cm-line': {
                    'line-height': '1rem',
                },
            }),
        ]

        const view = new EditorView({
            state: EditorState.create({ doc: blob.content, extensions }),
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

    $: if (e() && e()?.state.sliceDoc() !== blob.content) {
        const view = e()
        view?.dispatch({
            changes: { from: 0, to: view.state.doc.length, insert: blob.content },
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
        display: contents;
        overflow: hidden;
    }
    pre {
        margin: 0;
    }
</style>
