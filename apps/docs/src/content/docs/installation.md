---
title: "Installation"
description: "Install the experimental alpha from npm."
---

Use Node 22.22.3, pnpm 11.5.0 and a [WebGPU-capable browser](/docs/support).
This walkthrough creates a small Vite app with the experimental
`%DOMFX_BROWSER_VERSION%` release. The API may change.

<span id="build-verified-artifacts"></span>

## Install the alpha

In an existing app:

```sh
%DOMFX_BROWSER_INSTALL%
```

Core is installed automatically. GSAP is optional. Pin exact versions and keep
your lockfile; the API is experimental even when npm's `latest` tag points to it.

## Create your preview app

For a new app, run `mkdir my-domfx-preview`, then `cd my-domfx-preview`.
Save this as `package.json`:

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
    "@domfx/core": "%DOMFX_CORE_VERSION%",
    "@domfx/browser": "%DOMFX_BROWSER_VERSION%"
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
  <meta name="viewport" content="width=device-width" />
  <link rel="icon" href="data:," />
  <title>domfx preview</title>
  <style>
    body { background: #14151B; color: #E8EAF3; font-family: sans-serif; }
    #host { position: relative; padding: 3rem; width: fit-content; }
    #target { min-width: 10rem; min-height: 3rem; font: inherit; }
  </style>
  <div id="host"><button id="target">Original content</button></div>
  <p>Clicks: <output id="clicks">0</output></p>
  <script type="module" src="/main.ts"></script>
</html>
```

The **target element** (`target`) is the button whose shape receives the effect.
The **effect container** (`host`) holds the target and the decorative canvas.
Use separate elements in the same document, with `position: relative` on the
container and room for the flames. Keep both in the document while the effect runs.

Continue with [Standalone](/docs/standalone#attach-fire) to create `main.ts` and see
the result. If you already use GSAP, follow the [GSAP guide](/docs/gsap).

## Add the optional GSAP binding

For native property tweens, add only `gsap` to your app. The `@domfx/gsap`
package is needed only for the optional lifecycle-aware snapshot helpers.

For the GSAP walkthrough:

```sh
pnpm add -E gsap@3.15.0
```

If you need the [optional helpers](/docs/api/gsap#snapshot-bindings):

```sh
pnpm add -E @domfx/gsap@%DOMFX_GSAP_VERSION%
```

Your app supplies GSAP; `@domfx/browser` does not install it.
