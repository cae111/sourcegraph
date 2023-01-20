import { sveltekit } from '@sveltejs/kit/vite'
import { resolve, join } from 'path'
import type { UserConfig } from 'vite'

const config: UserConfig = {
    plugins: [sveltekit()],
    define: {
        'process.platform': '"browser"',
        'process.env': '{}',
    },
    css: {
        preprocessorOptions: {
            scss: {
                loadPaths: [resolve('../../node_modules')],
            },
        },
        modules: {
            localsConvention: 'camelCase',
        },
    },
    server: {
        proxy: {
            '^(/sign-in|/.assets|/-|/.api|/search/stream)': {
                target: 'https://sourcegraph.com',
                changeOrigin: true,
                secure: false,
            },
        },
    },
    resolve: {
        alias: {
            wildcard: join(__dirname, '../wildcard/'),
        },
    },
}

export default config
