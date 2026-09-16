# @domfx/browser

Experimental DOM capture and internal TypeGPU renderer for domfx.

See the [consumer quickstart](https://github.com/G0m1namm/domfx/blob/main/QUICKSTART.md)
for local installation and a tested standalone/GSAP walkthrough.

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
must be installed with the package. CommonJS and other bundlers are not verified
by this path. Node import safety and root declarations have a separate gate below.

### Node imports and consumer types

Run `pnpm test:packed:contracts` for the hardware-independent gate, also included in
`pnpm check` and CI. It installs core/browser tarballs and TypeScript in a fresh
temporary consumer outside the workspace, initially without GSAP and with no source aliases
or repository development types. After standalone checks, it adds the packed GSAP adapter
and GSAP for semantic type acceptance/rejection cases. The printed directory retains the
consumer and tarballs for inspection.
Installation uses the declared dependency ranges and requires registry access.

Core, browser and the existing `/experimental` lab entry import in separate Node
processes with `window`, `document` and `navigator` absent. A second pass guards
browser globals and resource APIs against import-time DOM/GPU work or scheduling.
Core cannot load external modules; browser imports cannot load GSAP. This verifies
import safety for SSR, not server-side capture or rendering: call `attachFire` and
`captureElement` only with real browser elements.

Root declarations compile with TypeScript 5.9.3, strict checking and
`skipLibCheck: false` under NodeNext and Bundler resolution. Core needs only ES2022;
browser consumers add DOM/DOM.Iterable, without WebGPU or GSAP ambient types.
Export allowlists reject accidental public renderer/oracle exports and extra package
subpaths; private source/dist imports are rejected. `/experimental` retains its
explicit lab-only renderer and adapter exports and is outside this root declaration
contract. Its GPU types still require the lab's WebGPU type setup.

The SDF executor from pinned `@typegpu/sdf` 0.12.0 is bundled with its MIT notice.
The repository's pnpm patch adds `offsetUniform.buffer.destroy()` to executor cleanup;
bundling carries the patch into packed consumers without requiring their own pnpm patch.
The patch also adds offset-4 and offset-2 refinement passes before the executor's
existing offset-1 finalization. Disconnected overflow paint otherwise produced full-raster
distance errors above 1.5 px at DPR 1/2. Refinement reuses the two flood textures and
pipelines; formats, allocation accounting and alpha threshold remain unchanged.
Jump flooding remains approximate; the verified fixtures do not prove an error bound
for arbitrary paint. No dependency version upgrade is involved.

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

## Padded capture fidelity

`captureElement` returns untransformed target-local straight RGBA8. The content bounds
are the selected root's border box; padding is in CSS pixels. Raster pixel centers map
through `pixelToLocal`: `(a * (x + 0.5) + e, d * (y + 0.5) + f)`. Placement applies root
and ancestor translation/positive axis-aligned scale separately. Descendant transforms
remain part of captured paint.

The development and production gate runs at actual browser DPR 1 and 2. Each required
fixture compares a 48 CSS-pixel padded capture against an 80 CSS-pixel reference:
alpha differs by at most 1/255 in the overlap, no reference paint lies outside the
smaller raster, the smaller raster's outer 20 CSS-pixel band is transparent, and the
reference boundary is transparent. Padding expands the serialized SVG viewport before
rasterization; appending transparent pixels to an already clipped image is insufficient.
Independent sentinels require four 10 × 10 overflow squares extending 20 CSS pixels
on each side, a root shadow (`14px 9px 8px rgba(255,100,0,0.8)`), a root background,
and exclusion of the ancestor background. SVG/raster holes and disconnected islands
must survive. Two 8 × 8 root-local marks retain their area and map within 0.5 raster px
under combined root/ancestor translation and nonuniform positive scale.

Every captured raster pixel is compared with an independent Float64 distance oracle,
including padded exterior and inner contours. Classification stays at alpha 128/255;
maximum distance error must be ≤1.5 raster px, contour error ≤1 px, and signs must
agree. A missing required sentinel fails even when both captures agree and their
exteriors are transparent. Capture/reference/SDF PNGs and numerical JSON are retained
in browser test evidence.

These are bounded paint fixtures, not automatic paint-extent discovery. The manual
attachment still requests 32 CSS pixels of padding; this gate's 48/80 values do not
increase that default. Paint beyond requested padding can be clipped, and paint beyond
the reference extent is unverified. Unbounded overflow, larger shadows/filters,
universal CSS painting, rotation/skew/perspective/negative scale, fractional DPR and
arbitrary subpixel HTML paint are not established by this gate. See the placement and
asset limits below. A failed required fixture holds the gate; it must not be removed,
cropped, or padded with zeros to obtain a pass.

## Capture asset readiness

`captureElement(target)` waits for the selected HTML images to decode and loads the
font faces requested by visible subtree text (including `::before`/`::after` text
and form values). Required web fonts must also appear as valid embedded data in
SnapDOM's snapshot. System-font text continues to use the browser's installed fonts.
A rejected face or missing embedding fails capture even if the page displays fallback
text. Matching faces in declared font stacks are checked conservatively; this is not
an individual-glyph fallback resolver. Required font loading also waits for the
Document's current font loading cycle to settle before capture geometry is read.

PNG, JPEG and WebP assets are fetched using ordinary CORS and `same-origin`
credentials, decoded, and embedded into the clone. HTML images use `currentSrc`,
including the browser's selected `picture`/`srcset` source. CSS background URL layers
are embedded while preserving their background sizing/positioning and gradient layers.
Data/blob URLs are subject to the same MIME/decode checks. No proxy, credential retry,
external service, placeholder, or asset repair is used. Lazy image sources must already
be selected by the browser; capture does not rewrite `src`, loading attributes or styles.
Resource fetch/decode/font waits have a ten-second bound per wait. No automatic retry
or persistent domfx asset cache is created.

Capture rejects with exported `CaptureError`; branch on its `code`, inspect `asset`
and `cause` for diagnostics. Codes are `asset-timeout`, `image-load-failed`,
`asset-fetch-failed`, `font-load-failed`, `font-embed-failed`, `unsupported-asset`,
`capture-decode-failed`, and `capture-readback-failed`. Fetch failures include HTTP,
CORS and fetch timeouts. Attachment initialization preserves `reason: 'capture-failed'`
and places the typed error's message in `reasonDetail`; explicit refresh rejects with
the underlying error. Failed capture releases its temporary canvas storage and leaves
the original target usable. Returned frame release remains idempotent.

The verified asset fixtures cover a delayed PNG image, PNG background and static
TrueType font, broken image/background/font bytes, denied and permitted cross-origin
PNG embedding, unembeddable programmatic fonts, and snapshot decode/readback cleanup.
Development and production tests save live-target/frame PNGs and JSON checks. See the
[fixture definitions](../../apps/lab/public/asset-fixtures/README.md).

Explicitly unsupported asset cases include SVG image documents (which may themselves
omit external resources), SVG `image`/`use`/`feImage`, image inputs, iframe/object/embed/video elements, open
shadow roots, background `image-set()`, and other URL-bearing paint such as masks,
border/list images and generated image content. Programmatic fonts without an
embeddable source and fonts whose descriptors/embedding cannot be verified reject.
Animated raster frames, complex font fallback/shaping, closed shadow roots, and
broader CSS painting fidelity are not verified. Do not treat a successful capture as
a claim of universal asset or CSS support.

Font loading signals are conservatively Document-wide. Expected image/font events
while a capture establishes readiness are allowed; later signals invalidate pending
work or hide fresh output and schedule a fresh capture. Stylesheet edits that emit
no observed size/mutation/font event still require explicit `refresh()`.

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
as do invalid options, non-HTML or unpositioned hosts and nonfinite/out-of-float32-range
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
visible, and seeking while paused does not resume the clock. Document hiding and a target leaving the viewport (including rectangular ancestor
overflow clips) suspend rendering and placement frame scheduling. Ambient time freezes
at its last committed value; resumption excludes the suspended interval. An intersection
observer wakes offscreen targets, and re-entry synchronizes geometry before showing
fresh output, including manual and paused attachments. Control writes made while
suspended are retained for the next visible frame. Stale,
unavailable and disposed attachments leave the scheduler, without a retry loop.

`ready` settles after initialization, including cleanup of cancelled initial work.
Environmental failures resolve with `lifecycle: 'unavailable'` and a typed `EffectReason`
code in `reason`. Initial failures include `no-webgpu`, `no-adapter`, `capture-failed`,
`empty-mask`, `capture-budget`, `target-budget`, `aggregate-budget`, `missing-exterior`,
`canvas-webgpu-unavailable`, `renderer-failed`, `unsupported-placement`,
`unsupported-composition`, and `reduced-motion`.
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
There is no automatic recreation or retry. Calling `retry()` or explicitly attaching a new handle creates
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
invalidated. Target subtree paint mutations, target size changes, target asset load/error
events, document font loading events and window resize hide stale output immediately
and schedule a fresh capture. Signals before the next shared animation frame coalesce
into one refresh; an explicit `refresh()` absorbs already queued observer work.
Paint mutation observers cover only the selected target subtree, excluding the decorative canvas.
There is no per-frame capture or automatic retry after failure. Observer-triggered
failures update lifecycle, raster health and diagnostics through the same refresh
contract, without an unhandled promise rejection. Disposal removes observers/listeners
and cancels queued captures. Document hiding suspends existing output and resumes it
when visible; paint invalidated while hidden or offscreen needs explicit refresh once
visible. Initial attachment or explicit refresh while offscreen leaves stale output
suspended; call `refresh()` once the target is in view. Visibility changes invalidate
pending captures/preparations, whose late results are released without presentation.

Zero width or height suspends output with stale raster health. Initial zero size
does not capture or prepare a GPU frame; retained output stays hidden while zero-sized.
An observed return to nonzero, visible size coalesces into one current refresh before
showing output. Repeated size transitions invalidate obsolete work without a retry loop.

Observed removal of the target or an ancestor permanently disposes the attachment,
including while output is suspended or capture/preparation is pending. Removal stays
terminal if the caller reinserts before the observer callback. Disposal removes output,
releases the target claim, notifies `onDispose` listeners once, and rejects pending refreshes
with `effect-disposed`; late work only releases its resources. Reinsertion requires a new
`attachFire()` call. Live attachments observe child-list changes along the target's ancestry
so disconnect detection does not depend on animation frames or document visibility.

`motion` defaults to `'respect'`. Initial reduced motion resolves `ready` with
`lifecycle: 'unavailable'` and `reason: 'reduced-motion'` before capture, canvas creation
or GPU allocation. Enabling reduced motion later leaves the handle and target claim
intact with `lifecycle: 'suspended'`, `raster: 'stale'` and `reason: 'reduced-motion'`.
It immediately removes/zero-sizes the output canvas, releases retained allocations,
stops scheduling, and removes paint/geometry listeners and observers. Only ancestry
removal observation remains until disposal. Pending work is invalidated;
non-cancellable capture/preparation releases its late results and service reference
when it settles. Other attachments retain their own resources.

Changing the preference back does not restart the attachment. Control writes,
`resume()` and `refresh()` cannot recover it; refresh rejects with `reduced-motion`.
Call `await effect.retry()` to recheck the preference and recreate output when permitted.

Choose `motion: 'static'` to opt into a deterministic decoration that always paints
at time zero, regardless of the OS preference or requested clock:

```ts
const effect = attachFire(target, { host, motion: 'static', seed: 314 });
await effect.ready;
```

Static attachments remain paused, and `resume()` is a no-op even with `clock: 'ambient'`.
Time writes remain readable configuration, but rendering always uses zero; intensity
writes and explicit refresh still work. Preference changes never start animation or
invalidate a static capture. This opt-in permits static output under reduced motion;
there is no animated override.

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
do not reject newer requests. Refresh on an unavailable or disposed
handle rejects with `effect-unavailable` or `effect-disposed`. Mutation, asset load, resize,
or a visibility/motion invalidation during pending work rejects with `refresh-invalidated`.
Observed paint invalidations schedule a replacement automatically; visibility invalidations
allow an explicit refresh once conditions permit. Reduced-motion suspension requires the recovery policy described above. Disposal rejects pending promises immediately.
In all cases late capture/preparation completes only to release its resources exactly once;
it cannot resurrect an invalidated attachment. `ready` retains its nonrejecting initialization
contract, including cleanup after initial disposal; refresh promises are separate from it.

### Explicit retry

`retry(): Promise<void>` tears down the current output, waits for pending renderer,
capture and preparation work to release its resources, and starts one fresh initialization.
Concurrent calls return the same promise, including calls while teardown is pending.
It works during initialization, active output, suspension or unavailability. Time, intensity,
seed, clock, pause state and `onDispose` subscriptions stay on the same handle; retry does
not notify disposal listeners or create animation bindings.

```ts
await effect.retry();
if (effect.lifecycle === 'unavailable') {
  console.log(effect.reason); // Conditions still prevent output.
}
```

Like `ready`, the promise resolves after the attempt and any cleanup; inspect `lifecycle`,
`raster`, `reason` and `reasonDetail` for the result. `ready` remains the original initialization
promise. Calling retry on an already disposed handle rejects with `effect-disposed`;
disposal during an attempt prevents revival and lets the pending retry settle after cleanup.
Observed removal remains terminal, including for unavailable handles and remove/reinsert
within one task. Unavailable handles retain only ancestry removal observation until disposal.

Retry rechecks target/host connection, ownership, positioned host, supported composition,
reduced motion, visibility, asset readiness and allocation budgets. An unavailable handle
releases its target claim; if a replacement owns that target or an overlapping subtree,
retry reports `effect-target-owned` without disturbing the replacement. Offscreen retry
stays suspended with stale raster health; visibility alone does not commit stale paint.
Call `refresh()` or `retry()` when visible. Static motion continues to render at time zero.

Retry invalidates pending refresh promises with `refresh-invalidated`. Refresh during a
retry cannot start another generation and rejects (`effect-retrying`, or the current
unavailable/disposed/reduced-motion rejection). Late results only release old resources.
Failures retain typed reasons and never schedule another retry. Control writes and caller
animation bindings remain valid, but cannot trigger recovery themselves.

Placement supports fractional translation and positive axis-aligned scale, including
target, ancestor and host transforms. Fresh, visible attachments check geometry on the
shared Document animation frame even in manual mode or while paused. Pure placement
updates reuse the presented pixels without advancing time, recapturing or rendering
again. Unchanged placement does not write layer styles. Inline changes limited to the
selected root's `transform`, `transform-origin`, `translate`, `rotate` and `scale` do
not invalidate captured paint; unsupported transforms still make the effect unavailable.
Descendant transforms affect captured paint and automatically refresh, as do other
target style/class mutations. Stale, hidden, unavailable and disposed output stops tracking.

Marked SVG alpha landmarks are verified within one physical pixel at DPR 1 and 2
under nested nonuniform scales and fractional offsets. This is not a universal CSS
paint guarantee: Chromium's HTML background snapping in foreignObject capture can
lose subpixel edges before placement. Rotation, negative scale, skew, perspective and
CSS zoom remain unsupported. This is a bounded snapshot API. Resize observation catches
target border-box size changes, including those caused by ancestor layout or stylesheets.
Paint changes from ancestor styles, external stylesheets (including CSSOM edits),
pseudo-states such as hover/focus, and CSS animations require explicit `refresh()`
when they emit no observed signal. Canvas drawing also requires explicit refresh for
each desired snapshot; video elements remain unsupported even with explicit refresh.
There is no automatic video/canvas frame capture. Arbitrary clipping/stacking contexts
are not comprehensively supported. The caller must provide a host whose compositing lets
its decorative child overlap the target. The attachment does not change target styles.
The pinned SnapDOM adapter temporarily edits source styles for a borderless target
with an outline, or subtree `content-visibility:auto`. Capture rejects those cases
with `CaptureError` code `unsupported-asset` before source mutation can create a
refresh loop. Attach before focusing an outlined borderless target, or provide a border.

Bordered hosts support window, host and nested scrolling with the same placement-only
tracking while manual or paused. Rectangular `overflow: auto`, `scroll` and `hidden`
clips on positioned HTML ancestors between target and host are intersected and applied
to the canvas in host coordinates. A fully clipped target suspends its layer and geometry tracking while retaining fresh
pixels. It can reappear on scrolling back without capture or another GPU render when
controls are unchanged. The host and its ancestors
clip the appended canvas natively; their clipping is not copied into the capture.

Host insertion remains explicit: the host must contain the target, establish the
canvas's positioned containing block, and allow its decorative child to overlap the
target in the caller's stacking order. Intermediate clipping ancestors must themselves
be positioned HTML elements. Bypassed rounded overflow, `clip-path`, masks, legacy
`clip`, paint containment, `content-visibility`, and `overflow: clip` (including clip
margins) are held as unsupported. Fixed-position targets or intermediate ancestors are
also unsupported because they can escape the shared clipping chain. These cases resolve
initialization, or stop live tracking, with `lifecycle: 'unavailable'` and
`reason: 'unsupported-placement'`; output is removed and the original target remains
usable. No wrapper insertion, reparenting or cross-host/top-layer composition is performed.

The scrolling fixture checks two nested rectangular clips against native browser hit
testing, alongside landmark placement, saved screenshots, unchanged capture/render
counts and fully clipped/re-entry stages at DPR 1 and 2. These checks do not establish
support for arbitrary clipping shapes or stacking contexts.

### Composition detection and caller obligations

Detected unsupported CSS is an environmental no-effect result: `attachFire()` returns a handle,
`ready` resolves, and the handle reports `lifecycle: 'unavailable'`, `raster: 'stale'`
and one of the reasons below. Invalid options/host relationships and ownership conflicts
still throw synchronously. A detected runtime violation removes and zero-sizes output,
releases ownership and stops scheduling. It does not alter the original target's styles,
focus or event handlers. Native effects of the caller's CSS still apply to the target
(for example, zero scale makes it invisible).

| Scope inspected through computed styles                                 | Detected rejection                                                                                                                                                                                                                                                                                                            | Reason                    |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| Target and every `parentElement`, including host and ancestors above it | A transform matrix that is not 2D, has nonzero off-diagonal terms, or has zero/negative X/Y scale; non-`none` perspective; individual rotation other than `none`/`0deg`; individual scale with more than two components or nonpositive/nonfinite values; three-component individual translation; zoom other than `1`/`normal` | `unsupported-placement`   |
| Target through ancestors below the host (host excluded)                 | Opacity other than `1`, filter or backdrop-filter other than `none`, mix-blend-mode other than `normal`                                                                                                                                                                                                                       | `unsupported-composition` |
| Target through ancestors below the host                                 | Fixed positioning                                                                                                                                                                                                                                                                                                             | `unsupported-placement`   |
| Intermediate ancestors only (target and host excluded)                  | Clip paths, mask images, legacy clip, paint/strict/content containment, non-visible content-visibility; overflow clipping on non-HTML or static elements, rounded overflow or `overflow: clip`                                                                                                                                | `unsupported-placement`   |

These are conservative computed-value checks, not a general CSS capability detector.
Even visually neutral values such as `filter: blur(0px)` reject. The selected root's
opacity/filter/blending is rejected because capturing alpha cannot reproduce the original
and its separate fire layer as one compositing group. See the CSS
[group compositing model](https://www.w3.org/TR/compositing-1/#groups).
The target's own clipping and descendant paint remain capture responsibilities, subject
to the capture/asset limits above. They are not scanned by the intermediate-ancestor rules.
Host and outer ancestor opacity, filters and clipping apply natively to the shared subtree;
they are not rejected by these group/clip checks. This does not establish support for every
combination of native effects.

Checks run before initialization starts, at async capture/preparation boundaries, on
observed target mutations, and on shared animation frames while initialization/refresh
is pending or fresh output is tracked. A violation observed during pending work invalidates
that generation even if CSS becomes supported again before completion. Late resources
are released without presenting; `ready` waits for that cleanup. There is no automatic
retry: restore supported CSS and call `retry()` or attach a new handle. Refresh of an unavailable handle
rejects with `effect-unavailable`.

The caller must maintain a valid positioned host/containing block and compatible stacking
order. Detection does not prove arbitrary z-index/stacking isolation, occlusion by siblings,
top-layer/popover/dialog composition, motion paths, preserve-3d contexts, shadow/slot ancestry,
or arbitrary descendant CSS fidelity. No bounding-rectangle approximation establishes support
for rejected transforms. Computed-style sampling can miss changes that begin and end between
checks; hidden or stale output stops frame tracking, and background documents may not get
animation frames. Ancestor/stylesheet/pseudo-state paint changes still need explicit `refresh()`
when no observed paint signal is emitted. A successful handle reports only the bounded
checks and capture behavior, not universal CSS compatibility.

Run the lab and open `/manual.html` to exercise the root-export consumer with Seek,
Zero intensity and Dispose controls. The browser suite covers it in development
and production alongside the existing numerical capture/fire fixtures.
