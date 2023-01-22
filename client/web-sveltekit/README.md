# Sourcegraph SvelteKit

This folder contains the experimental [SvelteKit](https://kit.svelte.dev/)
implementation of the Sourcegraph app.

**NOTE:** This is a _very early_ prototype and it will change a lot.

## Developing

```bash
# Install dependencies
pnpm install
# Run dev server
pnpm run dev
```

You can also build the OSS or dotcom version by running `pnpm run dev:oss` and
`pnpm run dev:dotcom` respectively, but they don't really differ in
functionality yet.

The dev server can be accessed on http://localhost:5173. API requests and
signin/signout are proxied to an actual Sourcegraph instance,
https://sourcegraph.com by default (can be overwritten via the
`SOURCEGRAPH_API_URL` environment variable.

## Production build

It's not currently not possible yet to create a production build of the
application.
