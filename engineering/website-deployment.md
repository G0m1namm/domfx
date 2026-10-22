# Website deployment

The static website runs on Cloudflare Workers at `https://domfx.dev`. Its GitHub
connection is configured through the Cloudflare dashboard; production builds follow
`main`. Package publication is separate. No Cloudflare credential or GitHub deployment
workflow is stored in this repository. Record deployment identifiers, source revisions
and live checks in #91.

## Build

Use Node 22.22.3 and pnpm 11.5.0 from the repository root:

```sh
pnpm install --frozen-lockfile
pnpm build:site
pnpm site:verify
```

Upload **`apps/web/dist`** as one site. It contains marketing, effects, English and
Spanish docs, Pagefind and discovery exports. Neither `apps/docs/dist` alone nor the
repository root is the deployment artifact. No Astro SSR adapter or server is needed.

`build:site` fixes the canonical origin to `https://domfx.dev`, requires production
metadata and disables indexing even if the shell sets `DOMFX_INDEXING=true`.
Previews stay unindexed too. #140 owns enabling indexing later.

## Cloudflare Worker setup

The `domfx` Worker connects to `G0m1namm/domfx`, with repository root `/`, production
branch `main` and preview builds disabled. Set the build variable
`PNPM_VERSION=11.5.0`; `.nvmrc` selects Node 22.22.3. The dashboard uses this
composed build command:

```sh
pnpm install --frozen-lockfile && DOMFX_SITE_URL=https://domfx.dev DOMFX_SITE_PRODUCTION=true DOMFX_INDEXING=false pnpm build:web
```

Deploy command:

```sh
pnpm --allow-build=workerd dlx wrangler@4.151.3 deploy --assets apps/web/dist --name domfx --compatibility-date 2026-10-22 --no-autoconfig
```

This uploads the composed static assets without adding an SSR adapter or changing
the Astro applications. Keep the deployment token in Cloudflare's build settings.
Its automatic token has broad account permissions; creating or expanding that
access requires maintainer approval. Never copy its value into source or logs.

In the Worker's **Domains** tab, add `domfx.dev` as a production custom domain,
leaving the optional subdomain empty. Cloudflare manages the domain's DNS record
and certificate. Wait for verified HTTPS before treating it as live. Keep ordinary
static routing: directory URLs retain trailing slashes and unknown paths return
404, without a catch-all SPA rewrite. Verify the result on the deployed origin.

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
  The original content must remain usable. Use the existing WCAG AA scope; another
  VoiceOver campaign is not required.
- Check a missing marketing and docs URL, slash redirects, fonts, JS/CSS, images,
  `/robots.txt`, `/llms.txt`, `/llms-full.txt` and a docs `.md` URL. Record failures.

Record the verified HTTPS URL, Cloudflare deployment identifier, source commit,
build settings and observed browser versions in #91. Update the repository homepage
only after those checks pass. Registry installation instructions require the separate
registry-consumer proof in [RELEASING.md](../RELEASING.md).

## Roll back

In the Worker's **Deployments** tab, roll back to the last verified version.
Re-run the live checks and record its identifier. Preserve its source commit and
build settings so it can also be rebuilt and redeployed. Website rollback does
not change immutable npm versions. The first deployment has no earlier verified
version to restore.

References: [Workers static assets](https://developers.cloudflare.com/workers/static-assets/),
[build settings and token permissions](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/),
[build image](https://developers.cloudflare.com/workers/ci-cd/builds/build-image/),
[custom domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/),
[routing and 404s](https://developers.cloudflare.com/workers/static-assets/routing/static-site-generation/),
[rollback](https://developers.cloudflare.com/workers/configuration/versions-and-deployments/rollbacks/).
