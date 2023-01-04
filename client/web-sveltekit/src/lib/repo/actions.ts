import { onDestroy, type ComponentType } from 'svelte'
import { writable, derived, get } from 'svelte/store'

interface Action {
    key: string
    priority: number
    component: ComponentType
}

export function createActionContext() {
    const actions = writable<Action[]>([])
    const sortedActions = derived(actions, $actions => [...$actions].sort((a, b) => a.priority - b.priority))

    return {
        subscribe: sortedActions.subscribe,
        setAction(action: Action) {
            actions.update(actions => {
                const existingAction = actions.find(a => a.key === action.key)
                if (existingAction) {
                    if (existingAction.component === action.component) {
                        return actions
                    }
                    actions = actions.filter(a => a.key !== action.key)
                }
                return [...actions, action]
            })
            onDestroy(() => {
                actions.update(actions => actions.filter(a => a.key !== action.key))
            })
        },
    }
}
