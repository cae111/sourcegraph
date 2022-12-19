const callback = (entries: IntersectionObserverEntry[]) => {
    for (const entry of entries) {
        entry.target.dispatchEvent(new CustomEvent<boolean>('intersecting', { detail: entry.isIntersecting }))
    }
}
function createObserver(root: HTMLElement | null) {
    return new IntersectionObserver(callback, { root, rootMargin: '0px 0px 500px 0px' })
}

const globalObserver = createObserver(null)

export function observeIntersection(node: HTMLElement, root?: HTMLElement | null) {
    let observer = globalObserver

    if (root) {
        observer = new IntersectionObserver(callback, { root, rootMargin: '0px 0px 500px 0px' })
    }

    observer.observe(node)

    return {
        update(newRoot: HTMLElement) {
            if (root !== newRoot) {
                observer.unobserve(node)
            }
            observer = createObserver(newRoot)
            observer.observe(node)
        },
        destroy() {
            observer.unobserve(node)
        },
    }
}
