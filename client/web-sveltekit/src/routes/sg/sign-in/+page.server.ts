import type { Actions } from './$types'

export const actions: Actions = {
    default: async ({ cookies, request, fetch }) => {
        const data = await request.formData()
        const email = data.get('email')
        const password = data.get('password')

        fetch('https://sourcegraph.test:3443/-/sign-in', {
            credentials: 'same-origin',
            method: 'POST',
            headers: {
                //...context.xhrHeaders,
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
        })
    },
}
