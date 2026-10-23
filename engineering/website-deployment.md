# Website deployment

The static website runs on Cloudflare Workers at `https://domfx.dev`. Production
deploys from `main` through its GitHub connection. Package publication is separate.

## Build

Use Node 22.22.3 and pnpm 11.5.0 from the repository root:

```sh
pnpm install --frozen-lockfile
pnpm build:site
pnpm site:verify apps/web/dist --indexable
```

Deploy **`apps/web/dist`** as one static site. It includes marketing, effects,
English and Spanish docs, search and discovery exports.

`build:site` is the production launch build: it sets `DOMFX_SITE_URL=https://domfx.dev`,
`DOMFX_SITE_PRODUCTION=true` and `DOMFX_INDEXING=true`. Default `build:web` and development
builds keep indexing disabled. For any preview, set `DOMFX_SITE_PREVIEW=true`; it overrides
the production entry point's indexing opt-in. A production build without an explicit
origin still fails. Build-time flags determine the static output; runtime variables
cannot change its indexing policy.

## Cloudflare Worker setup

The `domfx` Worker builds from the repository root, with production branch `main`
and preview builds disabled. Set the build variable
`PNPM_VERSION=11.5.0`; `.nvmrc` selects Node 22.22.3. The dashboard uses this
production build command after the launch change merges:

```sh
pnpm install --frozen-lockfile && pnpm build:site
```

Deploy command:

```sh
pnpm --allow-build=workerd dlx wrangler@4.151.3 deploy --config wrangler.jsonc --no-autoconfig
```

Keep credentials in Cloudflare's build settings. Changes to token permissions
require maintainer approval.

The previous dashboard command hardcodes `DOMFX_INDEXING=false` before `pnpm build:web`;
changing an environment variable alone cannot override that inline assignment. Replace
the dashboard command with the command above only for an authorized production deployment. Ensure production
does not set `DOMFX_SITE_PREVIEW=true`. Keep preview builds disabled; if enabled later,
set `DOMFX_SITE_PREVIEW=true` for every preview build and verify its output is unindexable.
Merging this change alone does not update the dashboard command or activate indexing.

Use `domfx.dev` as the production custom domain with verified HTTPS. Keep static
routing: directory URLs retain trailing slashes. `wrangler.jsonc` sets
`assets.not_found_handling` to `404-page` so unknown paths return the bilingual
recovery page with HTTP 404. Update the dashboard deploy command to the command
above when adopting this configuration.

Fingerprinted assets under `/_astro/` and `/docs/_astro/` use a one-year immutable
browser cache. Their URLs change with their contents. HTML and unversioned public
assets retain Cloudflare's revalidation policy. The shared `_headers` file supplies
these [static asset headers](https://developers.cloudflare.com/workers/static-assets/headers/).

## Verify the live deployment

```sh
pnpm site:verify https://domfx.dev --indexable
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

## Search-engine launch handoff

Complete #140 after the authorized production deployment and live checks pass. Confirm
HTTPS at `domfx.dev`, `index, follow` on EN/ES content, `Allow: /` in `/robots.txt`, and
HTTP 200 for `/sitemap-index.xml`, `/sitemap-0.xml` and `/docs/sitemap-0.xml`. Canonicals
and both child maps must use `https://domfx.dev`; `/share-card.png` must be the approved
1200×630 Frost card. Verify `/llms.txt`, `/llms-full.txt` and the linked docs `.md` URLs.
Use `pnpm site:verify https://domfx.dev` without `--indexable` for a prelaunch deployment.

Using the maintainer's existing accounts and separately authorized ownership changes:

1. In [Google Search Console](https://search.google.com/search-console), add the Domain
   property `domfx.dev` and publish the exact DNS verification record supplied by Google,
   then verify ownership. Alternatively, add the URL-prefix property `https://domfx.dev/`
   and use an offered verification method. Retain its verification record/file/tag.
   See [Google's ownership instructions](https://support.google.com/webmasters/answer/9008080).
2. After the live sitemap passes, submit `https://domfx.dev/sitemap-index.xml` in that
   property's Sitemaps report and confirm it can be fetched. Google accepts a single
   [sitemap index submission](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap).
3. In [Bing Webmaster Tools](https://www.bing.com/webmasters), import the verified Google
   property, or add `https://domfx.dev/` and complete its supplied DNS CNAME, XML file or
   meta-tag verification. See [Bing's ownership instructions](https://www.bing.com/webmasters/help/add-and-verify-site-12184f8b).
   Submit the same sitemap index in Sitemaps, or confirm the imported submission appears
   and is fetched successfully ([Bing sitemap guidance](https://www.bing.com/webmasters/help/sitemaps-3b5cf6ed)).

Record the verified properties, submitted sitemap URL, fetch outcomes and deployment
revision in #140. A prepared build or submitted sitemap does not prove search indexing;
leave the issue open while deployment or ownership/submission checks remain outstanding.

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
