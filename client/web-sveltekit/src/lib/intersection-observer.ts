const callback = (entries: IntersectionObserverEntry[]) => {
    for (const entry of entries) {
        entry.target.dispatchEvent(new CustomEvent<boolean>('intersecting', { detail: entry.isIntersecting }))
    }
}
function createObserver(root: HTMLElement | null) {
    return new IntersectionObserver(callback, { root, rootMargin: '0px 0px 500px 0px' })
}

const globalObserver = createObserver(null)

export function observeIntersection(node: HTMLElement) {
    let observer = globalObserver

    let scrollAncestor: HTMLElement | null = node.parentElement
    while (scrollAncestor) {
        const overflow = getComputedStyle(scrollAncestor).overflowY
        if (overflow === 'auto' || overflow === 'scroll') {
            break
        }
        scrollAncestor = scrollAncestor.parentElement
    }

    if (scrollAncestor && scrollAncestor !== document.getRootNode()) {
        observer = new IntersectionObserver(callback, { root: scrollAncestor, rootMargin: '0px 0px 500px 0px' })
    }

    observer.observe(node)

    return {
        destroy() {
            observer.unobserve(node)
        },
    }
}
