<script lang="ts">
    import { browser } from '$app/environment'

    import { Compartment, EditorState, StateEffect, type Extension } from '@codemirror/state'

    import { EditorView, lineNumbers } from '@codemirror/view'
    import { syntaxHighlight } from '@sourcegraph/web/src/repo/blob/codemirror/highlight'
    import type { BlobFileFields } from '@sourcegraph/web/src/graphql-operations'
    import '@sourcegraph/branded/src/global-styles/highlight.scss'

    export let blob: BlobFileFields
    export let highlights: string

    let editor: EditorView
    let container: HTMLDivElement | null = null

    const shCompartment = new Compartment()

    function createEditor(container: HTMLDivElement): EditorView {
        const extensions = [
            lineNumbers(),
            shCompartment.of(configureSyntaxHighlighting(blob.content, highlights)),
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

    function configureSyntaxHighlighting(content: string, lsif: string): Extension {
        return lsif ? syntaxHighlight.of({ content, lsif }) : []
    }

    function updateExtensions(effects: StateEffect<unknown>[]) {
        if (editor) {
            editor.dispatch({ effects })
        }
    }

    $: updateExtensions([shCompartment.reconfigure(configureSyntaxHighlighting(blob.content, highlights))])

    $: if (editor && editor?.state.sliceDoc() !== blob.content) {
        editor.dispatch({
            changes: { from: 0, to: editor.state.doc.length, insert: blob.content },
        })
    }

    $: if (container && !editor) {
        editor = createEditor(container)
    }
</script>

{#if browser}
    <div bind:this={container} class="root test-editor" data-editor="codemirror6" />
{:else}
    <div class="root">
        <pre>{blob.content}</pre>
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
