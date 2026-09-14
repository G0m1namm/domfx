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
Runtime dependencies (`@domfx/core`, TypeGPU and SnapDOM) remain external and
must be installed with the package. CommonJS, SSR and other bundlers are not
verified by this path.

The SDF executor from pinned `@typegpu/sdf` 0.12.0 is bundled with its MIT notice.
The repository's pnpm patch adds `offsetUniform.buffer.destroy()` to executor cleanup;
bundling carries this fix into packed consumers without requiring their own pnpm patch.
No shader algorithm or dependency version upgrade is involved.

Prepared frames account for 36 bytes per pixel of textures, a 16-byte fire uniform,
and the observed 4-byte JFA offset buffer (`i32`, TypeGPU 0.12.4). Destroying a frame
releases all of these allocations; zero offset bytes remain per destroyed frame,
so the bound does not grow with refresh count. Destroying the service releases its
live frames and device; repeated frame/service cleanup is idempotent. Diagnostic
readback staging buffers are temporary and released after each read. This managed
allocation ledger excludes pipelines, browser/driver caches and canvas backing stores;
it is not a total VRAM measurement.

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

For caller-owned timelines, use the optional [`@domfx/gsap` binding](../gsap/README.md).
The browser package itself does not depend on GSAP.

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
`empty-mask`, `capture-budget`, `target-budget`, `aggregate-budget`, `missing-exterior`,
`canvas-webgpu-unavailable`, `renderer-failed`, and `reduced-motion`.
`reasonDetail` preserves the underlying message for diagnostics; branch on `reason`.
Failed setup releases its capture pixels, canvas backing store, listeners and GPU resources
before `ready` settles.
The original target remains visible and interactive. Attachments in the same Document
share one renderer/device and its fire pipeline, including concurrent initialization.
Each handle owns its prepared raster, parameters and a pointer-transparent, `aria-hidden`
canvas appended directly to its host, outside the captured subtree. Targets may share
a host or use separate hosts; their placement, controls and disposal remain independent.
GPU preparations run serially to keep validation scopes and the aggregate allocation
budget isolated; capture remains independent per target. SDF executors and their
preparation pipelines retain their existing per-frame lifetime.

Disposal removes that target's output immediately. Pending initialization, capture or
preparation retains a service reference until its late resources are released, before
`ready` resolves. Disposing one target preserves the others; the last reference releases
the device and removes the Document's service entry. A later attachment creates a fresh
service. Failed initialization also releases the entry; it does not retry automatically.
Devices and textures are never shared across Documents.

Device loss makes every affected attachment unavailable with `reason: 'device-lost'`
and the loss message in `reasonDetail`, including when the device reports `destroyed`.
Pending refresh promises reject immediately with that message. Loss removes the
decorative canvases, stops scheduling and retires the shared service immediately.
Queued preparation and work resuming after an async GPU wait cannot allocate or submit
more GPU work. Non-cancellable capture/preparation retains its reservation until it
settles and releases late resources; late results never restore output or replace the
loss reason. Original DOM and unrelated page animations remain usable.
There is no automatic recreation or retry. Explicitly attaching a new handle creates
a new service; cleanup of the lost generation cannot remove that replacement service.

Attachment admission reserves memory synchronously before capture starts. Limits are
1,000,000 padded capture pixels, 48,000,000 bytes steady per target, 88,000,000 bytes
per target during replacement, and 144,000,000 bytes per Document (decimal MB).
Reservations include other targets, pending captures/preparations and retained frames,
including work still completing after disposal. No quality reduction or coverage crop
is used to fit a budget. Pixel rejection reports `capture-budget`, per-target rejection
`target-budget`, and Document rejection `aggregate-budget`. Refresh budget failures
reject the promise and leave the attachment unavailable with stale, hidden output.

For a raster of P pixels, known managed GPU allocations are 36P + 20 bytes (source,
SDF/JFA, fire texture and uniforms). Admission additionally estimates 4P bytes for one
RGBA output surface and reserves 4P CPU capture bytes until the capture frame is
released: 44P + 20 pending, then 40P + 20 retained. Actual SnapDOM dimensions are
checked before rasterization; returned capture dimensions and prepared-frame bytes
are reconciled before presentation. Reconciliation replaces an entry, so estimates
and their actual resources are never added twice. The previous frame remains charged
until replacement presentation finishes and destroys it.

The output surface is an estimate, not a known GPU allocation. This budget excludes
browser-owned capture canvases, image decoding, temporary pixel copies, DOM/SVG and
font caches, additional compositor/swapchain surfaces, pipelines, driver overhead and
experimental diagnostic readbacks. It is neither total process memory nor total VRAM.
The experimental renderer's `managedBytes` remains the separate known GPU-frame
allocation count. Reservations are released after success transfers ownership or after
failure, supersession, disposal or device-loss cleanup finishes; non-cancellable work
retains its reservation until its late result is released.

`onDispose(callback)` subscribes to disposal and returns an idempotent unsubscribe
function. Disposal removes output and runs immediate cleanup before notifying each listener
once; pending initialization still releases late resources before `ready` settles.
Subscribing after disposal calls the listener immediately. Listener failures are collected
and thrown as an `AggregateError` after all listeners run. The optional GSAP adapter uses
this notification to detach bindings without replacing the handle's `dispose()` method.

Lifecycle is `suspended` during initialization, `active` while rendering,
`unavailable` after failure, or `disposed`. Raster health is independently
`refreshing` during capture or replacement, `fresh` after preparation, or `stale` when
invalidated. Target subtree mutations, target asset load events and window resize
hide stale output; call `refresh()` to capture again. There is no automatic refresh/retry
loop. Reduced motion at startup avoids capture/GPU allocation; runtime reduced
motion or document hiding suspends existing output and resumes it when permitted.

Explicit refresh hides output synchronously, retains the same decorative canvas, and
serializes capture/preparation per attachment. A reattached target also waits for any
previous attachment's pending capture before starting another. Calls made while work is pending coalesce
to the newest requested capture revision; superseded results never paint. A promise
resolves when its requested revision or a newer one commits. The replacement presents
before previous GPU resources are released; capture pixels are released after preparation.
Time, intensity, seed and clock pause remain unchanged.

```ts
target.textContent = 'Updated content';
try {
  await effect.refresh(); // Also allowed before ready or after stale-paint suspension.
} catch (error) {
  // Inspect effect.lifecycle, effect.reason and effect.reasonDetail.
}
```

A newest capture/preparation failure rejects affected refresh promises with the underlying
error and makes the attachment unavailable with stale, hidden output. Superseded failures
do not reject newer requests. There is no retry: refresh on an unavailable or disposed
handle rejects with `effect-unavailable` or `effect-disposed`. Mutation, asset load, resize,
or a visibility/motion invalidation during pending work rejects with `refresh-invalidated`;
call refresh explicitly once conditions permit. Disposal rejects pending promises immediately.
In all cases late capture/preparation completes only to release its resources exactly once;
it cannot resurrect an invalidated attachment. `ready` retains its nonrejecting initialization
contract, including cleanup after initial disposal; refresh promises are separate from it.

Placement supports translation and positive axis-aligned scale, including a scaled
host. Rotation, skew, perspective and CSS zoom reject. Scrolling and control writes
update placement. This is a bounded snapshot API: stylesheet/font changes,
ancestor layout/paint changes, arbitrary clipping/stacking contexts, and continuous
layout tracking are not comprehensively detected or supported. Dispose before
changing those conditions. The caller must provide a host whose compositing lets
its decorative child overlap the target. The attachment does not change target styles.
The pinned SnapDOM adapter can temporarily change source styles when capturing a
focused borderless target with an outline; this is conservatively detected as stale
and invalidates capture. Attach before focusing such a target, or refresh after focus
moves away.

Run the lab and open `/manual.html` to exercise the root-export consumer with Seek,
Zero intensity and Dispose controls. The browser suite covers it in development
and production alongside the existing numerical capture/fire fixtures.
