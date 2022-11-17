import type { PageLoad } from './$types'

export const load: PageLoad = ({ url, params }) => {
    console.log(params)

    return {
        repo: 'test',
    }
}
