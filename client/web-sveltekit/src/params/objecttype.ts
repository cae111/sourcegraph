import type { ParamMatcher } from '@sveltejs/kit'

export const match: ParamMatcher = param => {
    return param === 'tree' || param === 'blob'
}
