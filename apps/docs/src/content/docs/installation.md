---
title: "Installation"
description: "Install the experimental alpha from npm."
---

Install the experimental `0.1.0-alpha.0` release from npm. Use Node 22.22.3
and pnpm 11.5.0 for the verified workflow.

<span id="build-verified-artifacts"></span>

## Install the alpha

```sh
pnpm add -E @domfx/browser@0.1.0-alpha.0
```

Core is installed automatically. GSAP is optional. Pin exact versions and keep
your lockfile; the API is experimental even when npm's `latest` tag points to it.

## Create your preview app

For a new preview app, create an empty directory and save this as `package.json`:

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
    "@domfx/core": "0.1.0-alpha.0",
    "@domfx/browser": "0.1.0-alpha.0"
  },
  "devDependencies": { "typescript": "5.9.3", "vite": "7.3.7" }
}
```

Save this as `pnpm-workspace.yaml`:

```yaml
autoInstallPeers: false
strictPeerDependencies: true
```

Run `pnpm install --ignore-scripts`. Import the public built package exports;
no source alias, shader copy or consumer TypeGPU plugin is required.

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
descendant in the same document. Leave space for the effect and choose a stacking order
that lets its appended canvas overlap the target.

Continue with [GSAP](/docs/gsap) for your own timeline, or [Standalone](/docs/standalone) to create `main.ts`.
Run `pnpm dev` for development; run `pnpm build` then `pnpm preview` for production.
Open the printed loopback URL in a measured WebGPU-capable browser.

## Add the optional GSAP binding

For native property tweens, add only `gsap` to your app. The `@domfx/gsap`
package is needed only for the optional lifecycle-aware snapshot helpers.

For the GSAP walkthrough, add this dependency to `package.json`:

```json
"gsap": "3.15.0"
```

If you choose the [optional snapshot helpers](/docs/api/gsap#snapshot-bindings),
also add the package:

```json
"@domfx/gsap": "0.1.0-alpha.0"
```

Run `pnpm install --ignore-scripts` again. GSAP is an explicit peer supplied by
your app; the standalone browser package does not install it.

The guides use Fire as a worked example. The API reference lists
[all attachment functions](/docs/api#available-effects) and their shared options.
`flameHeight` is a Fire-only creation option. Use compatible package versions for
the documented exports; do not mix older declarations with newer examples.
