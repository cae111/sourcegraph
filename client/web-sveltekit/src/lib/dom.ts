/**
 * An action that dispatches a custom 'click-outside' event when the user clicks
 * outside the attached element.
 */
export function onClickOutside(node: HTMLElement) {
    function handler(event: MouseEvent) {
        if (event.target && !node.contains(event.target as HTMLElement)) {
            node.dispatchEvent(new CustomEvent('click-outside', { detail: event.target }))
        }
    }

    window.addEventListener('mousedown', handler)

    return {
        destroy() {
            window.removeEventListener('mousedown', handler)
        },
    }
}
