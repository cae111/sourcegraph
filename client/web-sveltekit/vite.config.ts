import { sveltekit } from '@sveltejs/kit/vite'
import { resolve } from 'path'
import type { UserConfig } from 'vite'
import { splitVendorChunkPlugin } from 'vite'

const config: UserConfig = {
    plugins: [sveltekit()],
    define: {
        'process.platform': '"browser"',
    },
    css: {
        preprocessorOptions: {
            scss: {
                loadPaths: [resolve('../../node_modules')],
            },
        },
    },
}

export default config
