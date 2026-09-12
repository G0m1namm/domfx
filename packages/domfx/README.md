# @domfx/browser

Experimental DOM capture and internal TypeGPU renderer for domfx.

Private workspace package with a provisional name. The `/experimental` entry is
a feasibility-test interface, not a stable public API. There is no supported npm
installation command yet. Browser/GPU requirements and broader lifecycle support
are still being verified.

## Packed ESM consumption

The supported experimental build path is Node 22+ with pnpm, a package-side Vite
library build targeting ES2022, and an ESM Vite consumer. Import only
`@domfx/browser` or `@domfx/browser/experimental` through package exports.
The browser package runs `unplugin-typegpu` when building: its emitted JavaScript
includes TypeGPU callback metadata and inline fire WGSL. No separate shader files,
runtime asset copy, source aliases or consumer TypeGPU plugin are required.
Runtime dependencies (`@domfx/core`, TypeGPU, SDF and SnapDOM) remain external and
must be installed with the package. CommonJS, SSR and other bundlers are not
verified by this path.

From the repository, run `pnpm exec playwright install chromium` once, then
`pnpm test:packed` on a machine with a display and WebGPU. This packs both private
libraries and installs their tarballs in fresh temporary consumers outside the
workspace. A local pnpm override resolves the unpublished core dependency to its
tarball; it does not alias source. The consumers use plain Vite without a config.

The test copies the lab fixtures and test-only oracle, runs development and
production GPU distance/fire checks, exercises controls and disposal, and requires
an intentionally untransformed package to fail with TypeGPU's missing-metadata
error in both modes. A missing GPU is a failure, never a CPU fallback or skipped
pass. Chromium runs headed with reduced motion disabled at 1280 × 720 and DPR 2.
The printed temporary directory retains tarballs, consumers, JSON environment and
readback reports, and screenshots for inspection; remove it when finished.
This is a local hardware gate separate from `pnpm check`, not registry publication.

Local verification on 2026-09-08 passed both modes in Chromium 153 on Apple
Metal 3. Five numerical masks and seven DOM captures had maximum distance error
0.276917 raster px, zero wrong signs and zero contour-crossing error. Fixed-time
fire and GSAP seeking reproduced their hashes; disposal left zero managed GPU
bytes. Both untransformed consumers were rejected during shader resolution.
These results cover this machine and build path, not broad browser support.

See the [project README](https://github.com/G0m1namm/domfx#readme) for development
instructions. MIT licensed; dependencies retain their own licenses.

## Manual fire attachment

The root export provides an experimental, one-target attachment API:

```ts
import { attachFire } from '@domfx/browser';

const effect = attachFire(target, { host, clock: 'manual', seed: 314, time: 1.5, intensity: 0.85 });
await effect.ready;
if (effect.lifecycle === 'active') {
  effect.time = 2; // Absolute seconds. Seeking backwards is supported.
  effect.intensity = 0.5;
}
effect.dispose(); // Safe before ready, and safe to call twice.
```

`host` must be a connected, positioned HTML element and `target` a strict descendant
in the same document. Duplicate or nested target ownership throws synchronously,
as do invalid options, non-HTML hosts, invalid host geometry and nonfinite/out-of-float32-range
parameters. Rejected calls never claim ownership. Unavailable attachments release their
claim automatically; a later attachment can use the target without disposing the failed
handle first. Disposing that old handle cannot release the new attachment's claim.
Seed defaults to `0`,
time to `0`, and intensity to `1`. Seed is read-only; finite intensity clamps to
`[0, 1]`. Control writes update readable values immediately and coalesce into one
render commit per dirty target on the next animation frame, using one domfx scheduler
per document. The initial paint completes before `ready` resolves. Frames reuse the
prepared raster without capture. Writes after disposal update readable controls but
cannot render or recreate resources.

`clock` defaults to `'manual'`; the handle exposes its immutable mode. Manual time
never advances automatically, including after `resume()`. Choose `'ambient'` to advance
time in seconds with the document's animation frames after initialization:

```ts
const effect = attachFire(target, { host, clock: 'ambient', seed: 314 });
await effect.ready;
effect.pause(); // Freeze at the last committed time; seed is unchanged.
effect.time = 2; // Paint this time on the next frame while remaining paused.
effect.resume(); // Continue from 2, excluding the paused interval.
```

The returned `EffectHandle` extends the existing `ManualEffectHandle` control shape
with `clock`, `paused`, `pause()` and `resume()`. Pause/resume are idempotent, can be
called before `ready`, and do not recapture. Manual mode is always paused. An explicit
time write while ambient is running resets the time origin to that value; subsequent
frames add elapsed time from the write. Ambient time is the last committed time when
read. Clock pause is independent of lifecycle suspension: pausing keeps fresh output
visible, and seeking while paused does not resume the clock. Existing visibility/motion
suspension stops frame scheduling; resumption excludes the suspended interval. Stale,
unavailable and disposed attachments leave the scheduler, without a retry loop.

`ready` settles after initialization, including cleanup of cancelled initial work.
Environmental failures resolve with `lifecycle: 'unavailable'` and a typed `EffectReason`
code in `reason`. Initial failures include `no-webgpu`, `no-adapter`, `capture-failed`,
`empty-mask`, `capture-budget`, `aggregate-budget`, `missing-exterior`,
`canvas-webgpu-unavailable`, `renderer-failed`, and `reduced-motion`.
`reasonDetail` preserves the underlying message for diagnostics; branch on `reason`.
Failed setup releases its capture pixels, canvas backing store, listeners and GPU resources
before `ready` settles.
The original target remains visible and interactive. Each handle owns one renderer
and a pointer-transparent, `aria-hidden` canvas appended directly to its host,
outside the captured subtree. Disposal removes output immediately; pending initial
capture/preparation is allowed to settle and releases its late resources before
`ready` resolves. Renderer/device sharing is deferred.

Lifecycle is `suspended` during initialization, `active` while rendering,
`unavailable` after failure, or `disposed`. Raster health is independently
`refreshing` during the initial capture, `fresh` after preparation, or `stale` when
invalidated. Target subtree mutations, target asset load events and window resize
hide stale output; there is no refresh/retry loop. Reattach after disposal to capture
again. Reduced motion at startup avoids capture/GPU allocation; runtime reduced
motion or document hiding suspends existing output and resumes it when permitted.

Placement supports translation and positive axis-aligned scale, including a scaled
host. Rotation, skew, perspective and CSS zoom reject. Scrolling and control writes
update placement. This is a bounded snapshot API: stylesheet/font changes,
ancestor layout/paint changes, arbitrary clipping/stacking contexts, and continuous
layout tracking are not comprehensively detected or supported. Dispose before
changing those conditions. The caller must provide a host whose compositing lets
its decorative child overlap the target. The attachment does not change target styles.
The pinned SnapDOM adapter can temporarily change source styles when capturing a
focused borderless target with an outline; this is conservatively detected as stale
and suspends initialization. Attach before focusing such a target, or dispose and
reattach after focus moves away.

Run the lab and open `/manual.html` to exercise the root-export consumer with Seek,
Zero intensity and Dispose controls. The browser suite covers it in development
and production alongside the existing numerical capture/fire fixtures.
