# Website deployment

The maintainer deploys the static website to Cloudflare manually. Package publication
is separate; there is no deployment workflow or Cloudflare credential in this repository.
The intended production origin is `https://domfx.dev`. Record the actual deployment
identifier, source revision and live checks in #91 after deployment.

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

## Manual Cloudflare setup

For a dashboard upload, create a **Pages Direct Upload** project and upload the
composed directory. Choose the project name in your own Cloudflare account. For a
Git-connected Pages project instead, keep the repository root as the build root;
use `pnpm install --frozen-lockfile && pnpm build:site` and output `apps/web/dist`.
Set `NODE_VERSION=22.22.3` and `PNPM_VERSION=11.5.0`. Restrict production deployment
to reviewed `main` revisions; configure branch deployment controls as intended.
Neither path needs npm publishing credentials. A Direct Upload project cannot later
switch to Git integration, so choose that project type deliberately.

Add `domfx.dev` through the project's **Custom domains** settings. For an apex
domain on Pages, its zone must use Cloudflare nameservers; follow the dashboard's
DNS and certificate instructions. Wait for HTTPS to work before treating it as live.
Do not add a catch-all SPA rewrite. The build includes a root `404.html` so missing
paths return an actual 404 while existing directory routes retain trailing slashes.

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

In Pages **Deployments**, select the last verified production deployment and use
**Rollback to this deployment**. Re-run the live checks and record its identifier.
Retain the built output and source commit for each manual upload so it can also be
rebuilt and redeployed. Website rollback does not change immutable npm versions.

References: [Astro on Pages](https://developers.cloudflare.com/pages/framework-guides/deploy-an-astro-site/),
[Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/),
[build image](https://developers.cloudflare.com/pages/configuration/build-image/),
[custom domains](https://developers.cloudflare.com/pages/configuration/custom-domains/),
[routing and 404s](https://developers.cloudflare.com/pages/configuration/serving-pages/),
[rollback](https://developers.cloudflare.com/pages/configuration/rollbacks/).
