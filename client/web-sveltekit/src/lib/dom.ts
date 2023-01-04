export function onClickOutside(node: HTMLElement) {
    function handler(event: MouseEvent) {
        if (event.target && !node.contains(event.target)) {
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
