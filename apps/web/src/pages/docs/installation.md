---
layout: ../../layouts/Documentation.astro
---

There is no supported registry installation command yet. You need access to a
compatible local checkout or its core, browser and optional GSAP tarballs.
Use Node 22.22.3 and pnpm 11.5.0 for the verified workflow.

## Build verified artifacts

From the repository checkout:

```sh
pnpm install --frozen-lockfile
pnpm --filter @domfx/lab exec playwright install chromium
pnpm release:rehearse
```

The rehearsal needs registry access for dependencies, a desktop session and
WebGPU-capable Chromium. It prints a directory outside the checkout containing
`artifacts/`, fresh standalone/GSAP consumers, command logs, GPU results and PNGs.
Missing browser or GPU access is a failed verification, not a rendering pass.

## Create your preview app

Create an empty directory outside the checkout. Copy the rehearsal's tarballs into
an `artifacts/` subdirectory. For the current `0.0.0` artifacts, save this as
`package.json`; use the actual filenames if the versions change:

```json
{
  "name": "my-domfx-preview",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --host 127.0.0.1",
    "build": "vite build",
    "preview": "vite preview --host 127.0.0.1"
  },
  "dependencies": {
    "@domfx/core": "file:./artifacts/domfx-core-0.0.0.tgz",
    "@domfx/browser": "file:./artifacts/domfx-browser-0.0.0.tgz"
  },
  "devDependencies": { "typescript": "5.9.3", "vite": "7.3.6" }
}
```

Save this as `pnpm-workspace.yaml`:

```yaml
autoInstallPeers: false
strictPeerDependencies: true
overrides:
  '@domfx/core': file:./artifacts/domfx-core-0.0.0.tgz
```

Keep the override even though core is a direct dependency: it resolves the browser
package's unpublished core version to your local artifact. Run
`pnpm install --ignore-scripts`. No source alias, shader copy or consumer TypeGPU
plugin is required; import the public built package exports.

## Provide the target and host

Create `index.html`:

```html
<!doctype html>
<html lang="en">
  <meta charset="utf-8" />
  <title>domfx preview</title>
  <style>
    body { background: #14151B; color: #E8EAF3; font-family: sans-serif; }
    #host { position: relative; padding: 60px; width: 280px; }
    #target { width: 160px; height: 48px; }
  </style>
  <div id="host"><button id="target">Original content</button></div>
  <script type="module" src="/main.ts"></script>
</html>
```

The host must be connected, positioned, and contain the target as a strict
descendant in the same document. Leave space for Fire and choose a stacking order
that lets its appended canvas overlap the target.

Continue with [GSAP](/docs/gsap) for your own timeline, or [Standalone](/docs/standalone) to create `main.ts`.
Run `pnpm dev` for development; run `pnpm build` then `pnpm preview` for production.
Open the printed loopback URL in a measured WebGPU-capable browser.

## Add the optional GSAP binding

For the GSAP walkthrough, also add these dependencies to `package.json`:

```json
"@domfx/gsap": "file:./artifacts/domfx-gsap-0.0.0.tgz",
"gsap": "3.15.0"
```

Run `pnpm install --ignore-scripts` again. GSAP is an explicit peer supplied by
your app; the standalone browser package does not install it.

The examples use `flameHeight`, which requires compatible current experimental
artifacts. Older pinned quickstart sources can lack that option. Do not mix their
declarations with a newer example; obtain matching artifacts first.
