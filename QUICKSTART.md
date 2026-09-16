# Consumer quickstart

Attach decorative fire to one element's captured silhouette while keeping the original
DOM as the content and interaction surface. The API is experimental and the packages
are private. This guide uses **local release tarballs**, not a registry installation.
There is no supported `pnpm add @domfx/browser` registry command yet; names and the
first release version remain provisional.

## Run the verified consumers

Use Node 22.22.3 and pnpm 11.5.0. From a checkout of this repository:

```sh
pnpm install --frozen-lockfile
pnpm --filter @domfx/lab exec playwright install chromium
pnpm release:rehearse
```

Registry access is needed for dependencies. The rehearsal requires a desktop session
and WebGPU-capable Chromium; it opens a visible browser with reduced motion disabled
for the positive checks. `DOMFX_BROWSER_EXECUTABLE` can select an existing Chromium
executable. Missing browser/GPU support fails; it is never counted as a rendering pass.

The printed `domfx-release-…` directory is outside the workspace. It contains:

- `artifacts/`: the same core/browser/GSAP tarballs used by both consumers.
- `standalone/` and `gsap/`: independently installed Vite consumers. Their
  `quickstart.ts` is copied directly from the examples below; `main.ts` and
  `lifecycle.ts` execute and assert their lifecycle operations.
- `report.json`, command logs, built assets and per-stage PNGs: actual install paths,
  artifact hashes, browser/GPU identity, checks and results.

The standalone install excludes GSAP. Both examples compile under strict NodeNext
and Bundler resolution with declaration checking enabled, then run as production
builds with real capture and GPU output. The rehearsal tests forward/backward seek,
zero/restored intensity, changed-silhouette refresh, unavailable cleanup, explicit
retry, retained controls/binding, disposal, reattachment and original-button input.
The self-test intentionally disposes all effects when finished; inspect its PNGs or
use the page below to keep an effect visible.

## Start a separate preview app

Create an empty directory **outside the checkout**. Copy the tarballs from the printed
rehearsal's `artifacts/` into an `artifacts/` subdirectory. For the current `0.0.0`
artifacts, create these two files (use the actual filenames if versions change):

```json
{
  "name": "my-domfx-preview",
  "private": true,
  "type": "module",
  "scripts": { "dev": "vite --host 127.0.0.1", "build": "vite build", "preview": "vite preview --host 127.0.0.1" },
  "dependencies": {
    "@domfx/core": "file:./artifacts/domfx-core-0.0.0.tgz",
    "@domfx/browser": "file:./artifacts/domfx-browser-0.0.0.tgz"
  },
  "devDependencies": { "typescript": "5.9.3", "vite": "7.3.6" }
}
```

Save that as `package.json`, and this as `pnpm-workspace.yaml`:

```yaml
autoInstallPeers: false
strictPeerDependencies: true
overrides:
  '@domfx/core': file:./artifacts/domfx-core-0.0.0.tgz
```

The override resolves the browser package's unpublished core version to the local
tarball. Keep it even though core is also a direct dependency. It is not a source
alias. No repository lockfile, patch, ambient WebGPU types or TypeGPU plugin is needed.
Install with `pnpm install --ignore-scripts`.

Create `index.html`:

```html
<!doctype html>
<html lang="en">
  <meta charset="utf-8" />
  <title>domfx preview</title>
  <link rel="icon" href="data:," />
  <style>
    body { background: #18202c; color: white; font-family: sans-serif; }
    #host { position: relative; padding: 60px; width: 400px; }
    #target { width: 180px; height: 70px; border: 1px solid white; border-radius: 12px; }
  </style>
  <div id="host"><button id="target">Original content</button></div>
  <script type="module" src="/main.ts"></script>
</html>
```

The **effect host** must be connected, positioned and contain the target as a strict
descendant in the same document. Leave room for the decoration and choose a stacking
order in which the appended canvas can overlap the target. domfx does not insert a
wrapper, reparent content or change the target's styles.

The **effect target** is the exact selected element. An opaque button background
produces a button silhouette; transparent text produces letter shapes. Selecting a
card captures its combined paint, not separate effects for each child. Captured alpha
at or above 128/255 is inside; holes and disconnected shapes can remain. Attachment
capture has 32 CSS pixels of padding, so larger overflow/shadows can be clipped.

## Standalone walkthrough

Copy [standalone.ts](examples/quickstart/standalone.ts) into your app as `quickstart.ts`.
It imports only `attachFire`, supplies the explicit host and uses a manual clock with
seed 314, time 0 and intensity 0.8. Create `main.ts`:

```ts
import { startFire } from './quickstart.js';

const host = document.querySelector('#host');
const target = document.querySelector('#target');
if (!(host instanceof HTMLElement) || !target) {
  throw new Error('Missing host or target');
}

const effect = startFire(target, host);
void effect.ready.then(() => {
  if (effect.lifecycle !== 'active') {
    console.info(effect.lifecycle, effect.reason, effect.reasonDetail);
  }
});
```

Run `pnpm dev` and open the printed loopback URL in the measured WebGPU-capable browser.
For production use `pnpm build` then `pnpm preview`. A manual effect is a still image
until your code changes time. In your own controls, use these operations:

```ts
effect.time = 2.5; // Absolute seconds, not milliseconds or a delta.
effect.time = 1.5; // Backward seek is supported with the same seed.
effect.intensity = 0; // Transparent output; finite values clamp to [0, 1].
effect.intensity = 0.8;
```

Writes update readable controls immediately and batch into a render on the next frame.
They reuse the raster; time changes do not recapture. If you want automatic time,
change the example's `clock` to `'ambient'`. `effect.pause()` freezes it;
`effect.resume()` continues without catching up the paused/hidden interval. Manual
mode is always paused and `resume()` does not advance it. Do not add your own frame
loop for ambient mode.

After changing captured paint, an async event handler can await a fresh silhouette:

```ts
target.style.borderRadius = '35px';
try {
  await effect.refresh();
} catch (error) {
  console.info(effect.reason, effect.reasonDetail, error);
}
```

Refresh hides stale output immediately and resolves when this revision or a newer one
commits. Observed target mutations, resize and asset signals can refresh automatically;
ancestor/stylesheet paint, hover/focus and canvas drawing still need explicit refresh
when no observed signal occurs. This is snapshot capture, not continuous video capture.

On page/component teardown, call `effect.dispose()` and remove your own event listeners.
Disposal is safe before `ready` and on repeated calls. Remove/reinsert of an observed
target/host is terminal; create a new attachment after remounting.

## GSAP walkthrough

In the same independent app, add `"@domfx/gsap": "file:./artifacts/domfx-gsap-0.0.0.tgz"`
and `"gsap": "3.15.0"` to `dependencies`, then run `pnpm install --ignore-scripts` again.
GSAP is an explicit peer; the browser package alone does not install it.

Replace `quickstart.ts` with [gsap.ts](examples/quickstart/gsap.ts). Keep the same HTML
and element lookup; replace `const effect = startFire(target, host)` in `main.ts` with:

```ts
const demo = startFire(target, host);
const { effect, timeline } = demo;
```

The example creates a caller-owned paused timeline and binds manual time 0 → 4 and
intensity 0.8 → 0.4 over four seconds. Binding before `ready` is supported. Call
`timeline.play()` to animate, `timeline.seek(2.5)` or `timeline.seek(1.5)` to seek in
either direction, and `timeline.reverse()` to reverse playback. Default
callback-suppressed seeks also update the controls. Use one owner for the controls
at a time: direct writes do not redefine the binding's captured starting values.

Refresh and unavailable handling use the same `effect` methods as standalone.
`await effect.retry()` retains the binding and controls; do not create another binding
after retry. On teardown call `demo.dispose()`: it disposes the binding, kills this
example's owned timeline and disposes the attachment. `binding.dispose()` alone only
removes its tween, preserving caller-owned siblings and the last control values.
For a borrowed timeline, leave timeline cleanup with its owner. For context ownership
and asynchronous setup see the [GSAP reference](packages/gsap/README.md).

## Unavailable output and reduced motion

`ready` and `retry()` resolve after an attempt, including environmental failure and
cleanup. Always inspect `lifecycle`, `raster`, and the typed `EffectReason` in `reason`;
use `reasonDetail` for diagnostics, not program logic. Invalid options, host relationships
and conflicting target ownership throw synchronously. An unavailable effect preserves
the original DOM; no visual fallback or automatic retry loop is installed.

After correcting the reported condition, a user-triggered async retry handler can use:

```ts
await effect.retry();
console.info(effect.lifecycle, effect.raster, effect.reason, effect.reasonDetail);
```

Concurrent retries share one attempt. `refresh()` and control writes cannot recover an
unavailable handle. Refresh rejects on failure/invalidation/disposal; retry on an already
disposed handle rejects. Keep handlers within the component's lifetime and handle rejected
promises. Retrying can still return unavailable if the underlying condition persists.

The default `motion: 'respect'` suppresses output under reduced motion. Startup avoids
GPU initialization; a runtime preference change hides output and releases resources.
Changing the preference back does not restart it: explicit `retry()` is required.
Opt into `motion: 'static'` at attachment creation for a decoration rendered at time zero
under either preference. It remains paused even with an ambient clock or GSAP time writes;
intensity and refresh still work. There is no animated override for reduced motion.

| Typed reason(s)                                        | What to check                                                                                                        |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| `no-webgpu`, `no-adapter`, `canvas-webgpu-unavailable` | WebGPU availability in a secure context/loopback and the actual browser/device. Keep original content usable.        |
| `capture-failed`                                       | Asset/CORS/font/decode diagnostics in `reasonDetail`; explicit refresh can reject with `CaptureError`.               |
| `capture-budget`, `target-budget`, `aggregate-budget`  | Reduce captured size/DPR or concurrent attachments. Dispose unused effects.                                          |
| `empty-mask`, `missing-exterior`                       | Target paint needs classified opaque pixels and transparent exterior within capture padding.                         |
| `unsupported-placement`, `unsupported-composition`     | Host, transforms, clipping and group effects below. Fix CSS before retry.                                            |
| `renderer-failed`, `device-lost`                       | Underlying GPU/shader diagnostics; explicit retry can attempt recreation but is not guaranteed recovery.             |
| `effect-target-owned`                                  | Another live attachment owns this target or an overlapping subtree when retry runs.                                  |
| `reduced-motion`                                       | Respect the preference; use static opt-in or retry only after the condition changes.                                 |
| `target-not-visible`, `stale-raster`                   | Inspect suspended/raster state. Fresh pixels can resume on visibility; stale paint needs refresh/retry when visible. |

## Minimal API reference

| Public surface                              | Contract                                                                                                                                                                                                               |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `attachFire(target, options): EffectHandle` | Required `host`; optional `clock` (`manual` default / `ambient`), `motion` (`respect` default / `static`), `seed` (0), `time` (0), `intensity` (1). Numeric inputs must be valid finite values; time must fit float32. |
| `ready: Promise<void>`                      | Original initialization/cleanup promise; does not reject for environmental unavailability.                                                                                                                             |
| `lifecycle`, `raster`                       | `active / suspended / unavailable / disposed`; `fresh / refreshing / stale`.                                                                                                                                           |
| `reason`, `reasonDetail`                    | `EffectReason \| undefined`; diagnostic string or undefined.                                                                                                                                                           |
| `time`, `intensity`, `seed`                 | Writable seconds and intensity; immutable seed.                                                                                                                                                                        |
| `clock`, `paused`, `pause()`, `resume()`    | Immutable clock; ambient pause control, independent of lifecycle suspension.                                                                                                                                           |
| `refresh()`, `retry()`                      | Capture new paint versus tear down/reinitialize with retained controls. Both return promises; see failure semantics above.                                                                                             |
| `dispose()`, `onDispose(callback)`          | Idempotent cleanup; callback runs once (immediately if already disposed), returns unsubscribe.                                                                                                                         |
| `bindFire(effect, timeline, options)`       | Manual handle only; required destination `time`, `intensity`, nonnegative `duration`; optional GSAP `position` and `disposeEffect` (false). Returns `{ dispose() }`.                                                   |
| `bindFireAsync(promise, timeline, options)` | Requires `disposeEffect: true`; immediately exposes `dispose()` and `ready`. Disposes late results after cancellation/context revert.                                                                                  |

Imports are SSR-safe, but attachment/capture calls require browser DOM elements.
Lower-level capture and its owned `CaptureFrame.release()` are documented in the
[browser reference](packages/domfx/README.md); `/experimental` is reserved for the lab.

## Support limits and troubleshooting

The [versioned support record](engineering/browser-support.md) proposes only experimental
desktop Chromium 153.0.8010.12 on the measured macOS 26.6.2 / Apple M5 Pro with native
Apple Metal 3 WebGPU. Its 386 development/production cases use 1280 × 900, DPR 2, with
capture/gallery/placement/scroll coverage also at DPR 1. Chrome 152.0.7977.83 on that
machine has narrower production fixture evidence at 1280 × 720/DPR 2, not the full suite.
These are named observations, not minimum browser versions or browser-family promises.
Safari, Firefox, Edge, mobile, Windows/Linux native GPUs, fractional DPR, other bundlers,
physical device loss and assistive technology remain untested beyond the record's
explicit scope. See that record for separate accessibility and historical performance
evidence; quickstart passes do not establish frame-rate, total VRAM or long-session limits.

- **Misplaced or clipped fire:** ensure the host establishes the canvas containing block
  and shares compatible stacking with the target. Translation and positive axis-aligned
  scales are boundedly supported. Rotation, skew, perspective, zero/negative scale and
  CSS zoom reject. Positioned intermediate HTML ancestors can have rectangular overflow
  clips; rounded clips, clip-path/masks, paint containment, `overflow: clip` and fixed
  intermediates reject. Arbitrary stacking, top-layer and shadow/slot composition are
  not established. Do not compensate with a guessed bounding box.
- **Unexpected `unsupported-composition`:** target/intermediate opacity other than 1,
  filters (even `blur(0px)`), backdrop filters and blending cannot be reproduced by the
  separate layer. Host/outer group effects apply natively to the shared subtree but do
  not imply arbitrary CSS support.
- **Capture fails or looks stale:** supported asset paths include decoded PNG/JPEG/WebP,
  selected `currentSrc`, CSS background URLs/gradients and embeddable fonts, subject to
  normal CORS and readiness checks. The measured asset fixtures are narrower (PNG and
  static TrueType). SVG image documents/references, video/iframe/object/embed, open
  shadow roots, `image-set()` and other URL-bearing paint such as masks are rejected.
  Animated rasters and broad font/CSS fidelity are unverified. A borderless outlined
  target or subtree `content-visibility: auto` also rejects to prevent source mutation
  by the capture adapter. Use a border or attach before focusing an outlined target.
  Consult [asset limits](packages/domfx/README.md#capture-asset-readiness) for exact codes.
- **Shader metadata error:** build and repack the browser package, then reinstall its
  tarball. Its package build owns the TypeGPU transform and embeds WGSL/metadata. A
  consumer needs no shader copy or TypeGPU plugin. Do not import `src`, private `dist`
  paths or untransformed sources. The tested consumer is ESM Vite; CommonJS is unverified.
- **Install tries the registry for core:** retain the `pnpm-workspace.yaml` override
  and ensure all tarball paths exist. Future registry instructions must wait for approved
  package names and publication; local rehearsal does not grant release approval.

## Execution record

Run `pnpm release:rehearse` to reproduce this guide's two example modules and retain
the printed report directory. See [the artifact protocol](RELEASING.md#local-artifact-rehearsal)
for evidence fields and limits.

**2026-09-16 UTC — PASS**, runtime source `5aa74b2` plus this documentation/example
change (no library runtime edits): Node 22.22.3, pnpm 11.5.0, TypeScript 5.9.3,
Vite 7.3.6, GSAP 3.15.0, macOS arm64, visible Chromium 153.0.8010.12,
native adapter `apple / metal-3`, 1280 × 900, DPR 2. Both fresh tarball consumers
passed the production lifecycle checks listed above, strict NodeNext/Bundler compilation
and SSR imports. GPU device/description fields were empty; no broader device identity
is inferred. Positive rendering checks disabled reduced motion.

The guide's literal package/YAML/HTML/entry-point blocks were also copied into two
additional empty directories outside the checkout and installed from those same tarballs.
Both passed strict types, Vite development/production startup, visible fire and original
button input. A separate reduced-motion context in each mode reported
`unavailable / reduced-motion` with no canvas. These page smoke checks complement the
rehearsal's pixel/lifecycle assertions; they do not establish other bundler/browser support.

Local evidence locators (not public downloads): `domfx-release-XENOWP/report.json`
under the system temporary directory records artifact hashes, installs, production
pixels and GPU results. The separate guide smoke report is recorded alongside it in
`domfx-quickstart-SKc3HG/`; both directories retain logs and PNGs. Preserve them before
OS temporary-file cleanup when reviewing this run.
