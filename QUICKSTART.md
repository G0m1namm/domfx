# Consumer quickstart

Add animated flames to a real button. Its click handler keeps working even when
WebGPU is unavailable or reduced motion prevents the decoration. domfx is
experimental; the API may change.

Use Node 22.22.3, pnpm 11.5.0 and a [WebGPU-capable browser](https://domfx.dev/docs/support/).
For the same walkthrough in Spanish, see [Instalación](https://domfx.dev/docs/es/installation/)
and [Uso independiente](https://domfx.dev/docs/es/standalone/).

<span id="prompt-for-your-coding-assistant"></span>

## Start a separate preview app

Run `mkdir my-domfx-preview`, then `cd my-domfx-preview`. Save this as `package.json`:

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

Run `pnpm install --ignore-scripts`. These are independent, exact published
package versions; no repository checkout or TypeGPU plugin is needed.

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

The **target element** is the button whose visible shape receives the effect.
The **effect container** (`host`) contains the target and the decorative canvas.
Keep both connected to the same document, use separate elements, and position
the container with `position: relative`. Leave room for the flames.

## Standalone walkthrough

Save this complete module as `main.ts`:

```ts
import { attachFire } from '@domfx/browser';

const host = document.querySelector('#host');
const target = document.querySelector('#target');
const clicks = document.querySelector('#clicks');
if (!(host instanceof HTMLElement) || !target || !clicks) {
  throw new Error('Missing host, target or click counter');
}

let count = 0;
const onClick = () => { clicks.textContent = String(++count); };
target.addEventListener('click', onClick);

let disposed = false;
let fire: ReturnType<typeof attachFire> | undefined;

function cleanup() {
  disposed = true;
  window.removeEventListener('pagehide', cleanup);
  target?.removeEventListener('click', onClick);
  fire?.dispose();
}

// Also register cleanup on component unmount, before calling setup.
window.addEventListener('pagehide', cleanup, { once: true });

const setup = async () => {
  await document.fonts.ready;
  if (disposed) { return; }

  fire = attachFire(target, {
    host, clock: 'auto', motion: 'respect',
    intensity: 0.8, flameHeight: 32, seed: 314,
  });
  await fire.ready;
  if (!disposed && fire.lifecycle !== 'active') {
    console.info(fire.reason);
  }
};

void setup();
```

Run `pnpm dev` and open the printed loopback URL. Flames surround the button;
clicking it increases the counter. To check production, run `pnpm build`, then
`pnpm preview`.

Register `cleanup` synchronously in your framework’s unmount hook before calling
`setup`. The page event handles navigation only. Cleanup works while fonts or
effect setup are pending. On remount, create fresh variables and a new effect.

## Choose an effect

Replace `attachFire` with another [attachment function](https://domfx.dev/docs/api/#available-effects)
and omit the Fire-only `flameHeight`. Dispose the previous effect first.
Every effect shares time, intensity, refresh and disposal controls.

<span id="minimal-api-reference"></span>

## Control animation

`clock: 'auto'` advances time automatically. Use `fire.pause()` and
`fire.resume()` to control playback. For seeking, create the effect with
`clock: 'manual'` and set `fire.time` in absolute seconds; domfx then leaves
advancing time to your code. Set intensity between 0 and 1. See
[shared controls](https://domfx.dev/docs/api/shared/) for the full contract.

## GSAP walkthrough

Run `pnpm add -E gsap@3.15.0`, keep the same HTML, and replace `main.ts` with
the complete [GSAP example](https://domfx.dev/docs/gsap/). It fades in the
container and animates effect time and intensity with a timeline you own.
The guide includes seeking, reverse playback and cleanup during setup.

Native property tweens need only GSAP and `@domfx/browser`. Install
`@domfx/gsap@0.1.0-alpha.0` only if you need its
[optional snapshot helpers](https://domfx.dev/docs/api/gsap/#snapshot-bindings).
A borrowed timeline stays with its owner; remove only your own child tweens.

<span id="unavailable-output-and-reduced-motion"></span>
<span id="support-limits-and-troubleshooting"></span>
<span id="execution-record"></span>

## Refresh, retry and cleanup

After changing captured paint, await `fire.refresh()`. After correcting an
unavailable condition, await `fire.retry()` and inspect its state again.
`ready` resolves after an attempt, so it does not guarantee visible output.
Missing WebGPU and the default reduced-motion policy leave the original button
usable. Read the console reason and [troubleshooting](https://domfx.dev/docs/troubleshooting/).

Call `cleanup()` when the page or component goes away. Disposed instances cannot
be reused. See [browser support](https://domfx.dev/docs/support/) for measured
limits and [the API](https://domfx.dev/docs/api/) for placement and capture restrictions.
