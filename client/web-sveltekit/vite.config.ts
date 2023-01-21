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
            // Proxy requests to specific endpoints to a real Sourcegraph
            // instance.
            '^(/sign-in|/.assets|/-|/.api|/search/stream)': {
                target: process.env.SOURCEGRAPH_API_URL || 'https://sourcegraph.com',
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
