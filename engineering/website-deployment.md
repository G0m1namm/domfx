# Website deployment

The static website runs on Cloudflare Workers at `https://domfx.dev`. Production
deploys from `main` through its GitHub connection. Package publication is separate.

## Build

Use Node 22.22.3 and pnpm 11.5.0 from the repository root:

```sh
pnpm install --frozen-lockfile
pnpm build:site
pnpm site:verify
```

Deploy **`apps/web/dist`** as one static site. It includes marketing, effects,
English and Spanish docs, search and discovery exports.

`build:site` uses `https://domfx.dev` and keeps indexing disabled. Enabling indexing
is a separate launch step tracked in #140.

## Cloudflare Worker setup

The `domfx` Worker builds from the repository root, with production branch `main`
and preview builds disabled. Set the build variable
`PNPM_VERSION=11.5.0`; `.nvmrc` selects Node 22.22.3. The dashboard uses this
composed build command:

```sh
pnpm install --frozen-lockfile && DOMFX_SITE_URL=https://domfx.dev DOMFX_SITE_PRODUCTION=true DOMFX_INDEXING=false pnpm build:web
```

Deploy command:

```sh
pnpm --allow-build=workerd dlx wrangler@4.151.3 deploy --assets apps/web/dist --name domfx --compatibility-date 2026-10-22 --no-autoconfig
```

Keep credentials in Cloudflare's build settings. Changes to token permissions
require maintainer approval.

Use `domfx.dev` as the production custom domain with verified HTTPS. Keep static
routing: directory URLs retain trailing slashes and unknown paths return 404.

## Verify the live deployment

```sh
pnpm site:verify https://domfx.dev
```

This checks the bilingual page inventory, internal links/assets, metadata, Frost
share card, robots policy, Markdown/llms exports and missing-page statuses. It does
not establish browser interaction or GPU rendering.

Also check the deployed site in a browser:

- Directly open `/`, `/es/`, `/effects/`, `/es/effects/`,
  `/docs/introduction/` and `/docs/es/introduction/`; reload a deep effect reference.
- Switch languages, open/close a preview and use its controls. Check docs search
  in each language, including a result requiring Pagefind's WASM, and a live effect lab.
- Check keyboard navigation, reduced motion, no JavaScript and unavailable WebGPU.
  The original content must remain usable. Follow the existing WCAG AA checks.
- Check a missing marketing and docs URL, slash redirects, fonts, JS/CSS, images,
  `/robots.txt`, `/llms.txt`, `/llms-full.txt` and a docs `.md` URL. Record failures.

Record the source commit, deployment version, results and remaining gaps in the
release issue. Package verification is covered in [RELEASING.md](../RELEASING.md).

## Roll back

In the Worker's **Deployments** tab, roll back to the last verified version.
Re-run the live checks and record its identifier. Preserve its source commit and
build settings so it can also be rebuilt and redeployed. Website rollback does
not change immutable npm versions. Rollback requires an earlier verified version.

References: [Workers static assets](https://developers.cloudflare.com/workers/static-assets/),
[build settings and token permissions](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/),
[build image](https://developers.cloudflare.com/workers/ci-cd/builds/build-image/),
[custom domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/),
[routing and 404s](https://developers.cloudflare.com/workers/static-assets/routing/static-site-generation/),
[rollback](https://developers.cloudflare.com/workers/configuration/versions-and-deployments/rollbacks/).
