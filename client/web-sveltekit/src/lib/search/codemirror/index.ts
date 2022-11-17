import { type ChangeSpec, EditorState, type Extension, RangeSetBuilder } from '@codemirror/state'
import { Decoration, EditorView, ViewUpdate } from '@codemirror/view'
import type { Observable } from 'rxjs'

import { createCancelableFetchSuggestions } from '@sourcegraph/shared/src/search/query/providers-utils'
import type { SearchMatch } from '@sourcegraph/shared/src/search/stream'

import {
    createDefaultSuggestionSources,
    type DefaultSuggestionSourcesOptions,
    searchQueryAutocompletion,
    type StandardSuggestionSource,
} from './completion'
import { loadingIndicator } from './loading-indicator'
import { decoratedTokens } from './parsedQuery'
import { toCSSClassName, type DecoratedToken } from '@sourcegraph/shared/src/search/query/decoratedToken'

export { createDefaultSuggestionSources, searchQueryAutocompletion }
export type { StandardSuggestionSource }

/**
 * Creates an extension that calls the provided callback whenever the editor
 * content has changed.
 */
export const changeListener = (callback: (value: string) => void): Extension =>
    EditorView.updateListener.of((update: ViewUpdate) => {
        if (update.docChanged) {
            return callback(update.state.sliceDoc())
        }
    })

const replacePattern = /[\n\r↵]+/g
/**
 * An extension that enforces that the input will be single line. Consecutive
 * line breaks will be replaces by a single space.
 */
export const singleLine = EditorState.transactionFilter.of(transaction => {
    if (!transaction.docChanged) {
        return transaction
    }

    const newText = transaction.newDoc.sliceString(0)
    const changes: ChangeSpec[] = []

    // new RegExp(...) creates a copy of the regular expression so that we have
    // our own stateful copy for using `exec` below.
    const lineBreakPattern = new RegExp(replacePattern)
    let match: RegExpExecArray | null = null
    while ((match = lineBreakPattern.exec(newText))) {
        // Insert space for line breaks following non-whitespace characters
        if (match.index > 0 && !/\s/.test(newText[match.index - 1])) {
            changes.push({ from: match.index, to: match.index + match[0].length, insert: ' ' })
        } else {
            // Otherwise remove it
            changes.push({ from: match.index, to: match.index + match[0].length })
        }
    }

    return changes.length > 0 ? [transaction, { changes, sequential: true }] : transaction
})

/**
 * Creates a search query suggestions extension with default suggestion sources
 * and cancable requests.
 */
export const createDefaultSuggestions = ({
    isSourcegraphDotCom,
    globbing,
    fetchSuggestions,
    disableFilterCompletion,
    disableSymbolCompletion,
    applyOnEnter,
    showWhenEmpty,
}: Omit<DefaultSuggestionSourcesOptions, 'fetchSuggestions'> & {
    fetchSuggestions: (query: string) => Observable<SearchMatch[]>
    /**
     * Whether or not to allow suggestions selection by Enter key.
     */
    applyOnEnter?: boolean
}): Extension => [
    searchQueryAutocompletion(
        createDefaultSuggestionSources({
            fetchSuggestions: createCancelableFetchSuggestions(fetchSuggestions),
            globbing,
            isSourcegraphDotCom,
            disableSymbolCompletion,
            disableFilterCompletion,
            showWhenEmpty,
        }),
        applyOnEnter
    ),
    loadingIndicator(),
]

// Defines decorators for syntax highlighting
const tokenDecorators: { [key: string]: Decoration } = {}
//const focusedFilterDeco = Decoration.mark({ class: 'focusedFilter'})

// Chooses the correct decorator for the decorated token
const decoratedToDecoration = (token: DecoratedToken): Decoration => {
    const className = toCSSClassName(token)
    const decorator = tokenDecorators[className]
    return decorator || (tokenDecorators[className] = Decoration.mark({ class: className }))
}

// This provides syntax highlighting. This is a custom solution so that we an
// use our existing query parser (instead of using CodeMirror's language
// support). That's not to say that we couldn't properly integrate with
// CodeMirror's language system with more effort.
export const querySyntaxHighlighting = EditorView.decorations.compute([decoratedTokens], state => {
    const tokens = state.facet(decoratedTokens)
    const builder = new RangeSetBuilder<Decoration>()
    for (const token of tokens) {
        builder.add(token.range.start, token.range.end, decoratedToDecoration(token))
    }
    return builder.finish()
})
