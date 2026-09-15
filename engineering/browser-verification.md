# Browser and GPU verification

The lab owns the Playwright suite and its pinned Chromium dependency. Tests consume
built package exports and exercise both Vite development and the production preview.
They run real capture and WebGPU code; no renderer mock supplies the successful result.

## Setup and commands

After `pnpm install --frozen-lockfile`, install the browser once, and again after a
Playwright version upgrade:

```sh
pnpm --filter @domfx/lab exec playwright install chromium
pnpm agent:verify
```

On Linux, use `playwright install --with-deps chromium` for browser prerequisites.
Software GPU execution also needs `libvulkan1` and `mesa-vulkan-drivers`.

| Command                                           | Result                                                                                                     |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `pnpm agent:verify`                               | Repository checks, production build, and both browser projects; isolated evidence for this source snapshot |
| `pnpm test:browser`                               | Rebuild packages/production lab and run both browser projects                                              |
| `pnpm test:browser:built`                         | Run both projects against existing builds; intended for the harness after its build gate                   |
| `DOMFX_GPU_BACKEND=swiftshader pnpm agent:verify` | Run the full harness with an explicitly selected software GPU                                              |

The default backend is `native`. Unsupported WebGPU or a missing adapter fails the
GPU scenario; it is not silently skipped. `swiftshader` runs real shaders on the CPU
and is the configured CI backend. The report identifies the requested backend and
the lab records the actual adapter. Neither mode establishes broad device support.

The runner owns loopback servers on ports 4173 and 4174 and shuts them down when
finished. Occupied ports fail explicitly; it never reuses an unrelated or stale lab.
Use the normal `pnpm demo` command for interactive development outside these runs.
Browser launch flags are restricted to the local test browser.

## Required scenarios

Each project runs the following scenarios at a 1280 × 900 viewport and device pixel ratio 2,
with the normal capture/GPU scenario additionally running at actual DPR 1:

- **Normal rendering:** existing capture fixtures and GPU distance fields agree with
  the independent numerical oracle over every raster pixel. All seven capture fixtures
  run at both DPRs, comparing 48 CSS-pixel padding with an 80 CSS-pixel reference,
  requiring transparent exterior bands and independent paint/coordinate sentinels.
  See [the exact paint extent and limits](../packages/domfx/README.md#padded-capture-fidelity).
  Capture/reference/SDF PNGs accompany the JSON report. Injected loss of required cyan
  overflow in both rasters must fail even when reference overlap and transparency agree;
  fire reproduces at fixed time and changes with
  time; zero intensity is transparent; GSAP cleanup preserves its caller-owned sibling.
  Exercise Play, Seek, Reverse, pointer/keyboard interaction, overlay attributes, and
  Dispose. Disposal must remove the overlay and release accounted GPU allocations.
  The preparation regression also runs 1,000 real small-mask prepare/readback/destroy
  cycles, alternating 7 × 5 and 9 × 5 masks with alpha values around the threshold.
  Every readback is compared to the Float64 oracle (0.002 raster-pixel tolerance).
  `preparationResources` records allocation samples at cycles 1, 10, 100 and 1,000;
  both the managed ledger and observed live GPUBuffer bytes must return to zero.
  It also checks failure after GPU submission, independently live frames, and repeated
  frame/service cleanup. Device-call observations count explicit buffer destruction;
  they do not measure garbage collection, driver allocation or total VRAM.
- **Reduced motion at startup:** complete without accessing the GPU, keep effect
  controls disabled, and preserve original DOM interaction.
- **Missing WebGPU:** inject the missing capability and require the lab's explicit
  unavailable report while preserving original DOM interaction. This negative test does
  not replace the successful real-GPU scenario.
- **Injected assertion failure:** finish the GPU fixtures, then require an explicit FAIL
  with the injected assertion message and verify that cleanup removes the overlay.

The `/manual.html` root-export consumer also checks deterministic control writes,
intensity bounds, ownership and numeric rejection, stale-paint hiding, scaled-host
placement, disposal before a late adapter result or during GPU preparation, repeated
disposal/reattachment, missing GPU, and startup/runtime reduced motion. Initial failure
checks inject missing adapters, capture decode failures, sub-threshold alpha and renderer
construction failures; an oversized target exercises the real capture budget. They require
canvas/device cleanup, preserved pointer/keyboard interaction, and successful reattachment
without disposing the failed handle. Invalid runtime options/hosts and both directions of
nested ownership also reject without leaving claims.

Refresh checks use controlled capture/preparation delays and failures with the real GPU
renderer. They verify revision coalescing, promise settlement, atomic replacement order,
exactly-once frame release, and invalidation/disposal during both stages. A changed DOM
silhouette is refreshed on the same canvas and compared with a fresh attachment at the
same time/seed; runtime reduced motion and simulated document hiding invalidate pending
capture. Reduced-motion checks reject canvas creation and GPU access at startup,
verify retained and late allocation release during initialization/capture/preparation,
and require suspension to survive preference reversal and control writes. Static opt-in
checks use real capture/GPU output to verify time-zero pixels, no ambient rendering,
preference changes during capture/preparation, and disposal before late completion.
These checks run in both development and production.

Fake animation-frame tests use the real attachment, capture and GPU renderer to verify
one shared frame request, one commit per dirty target, manual time ownership, ambient
pause/seek/resume, immutable seed, no per-frame capture, and cancellation on disposal.
Manual and paused attachments retain geometry frame participation without extra GPU
commits. Fractional placement fixtures run at DPR 1 and 2 in both projects. Three colored
SVG alpha islands are captured through the real adapter; their coverage-weighted raster
pixel centers map through the actual effect layer into viewport coordinates and are
compared with independently measured live landmark centers (one physical pixel maximum
per axis). Cases include target/ancestor/host nonuniform scales, transform origins,
individual transform properties, sibling layout shifts and a sampled Web Animation.
Each stage saves geometry JSON and a screenshot, with browser/GPU, viewport, DPR,
visibility and reduced-motion details. Time, capture count, render count and output
pixels must remain unchanged. Mixed paint changes, descendant transforms and unsupported
rotation verify that the placement exception cannot bypass stale/unavailable behavior.
The landmarks use SVG to avoid Chromium's local HTML background edge snapping during
foreignObject capture; these checks do not establish arbitrary CSS subpixel paint fidelity.

Bordered scrolling fixtures use the same landmarks at DPR 1 and 2 with window, host
and inner scroll offsets under nonuniform scales. Two nested positioned rectangular
overflow clips are compared to native clipping of an independently placed child through
browser hit testing. The fixture verifies fully clipped output and scrolling back into
view, unchanged time, capture/render counts and canvas pixels, and saves geometry JSON
and screenshots at every stage. Rounded overflow, clip paths, masks, paint containment,
overflow clip margins, static clipping ancestors and fixed-position ancestors must
become unavailable both during live tracking and initial attachment, removing the canvas
while preserving the target. This bounded fixture does not establish arbitrary clipping
or stacking support.

Shared-service checks concurrently attach a ring and disconnected islands in separate
hosts and one shared host. Both captured SDFs are compared with the numerical oracle;
canvas readbacks verify independent time/intensity and reproducible surviving output
after disposing either target. Service/fire-pipeline creation counts, managed bytes and
observed live GPUBuffer bytes verify sharing and the surviving-target allocation baseline.
Controlled initialization/preparation delays cover disposal, reattachment, late cleanup,
shared initialization failure and isolated preparation failure. A same-origin iframe
checks Document/device isolation and owning-Document capability detection. A simulated
device-loss notification checks cleanup of both owners. Controlled loss also covers
pending service initialization, initial and refresh capture, asynchronous pipeline
creation, submitted preparation, final validation, and late prepared results. Checks
require immediate refresh rejection with loss details, removal/zero sizing of canvases,
no further GPU allocation/submission, pending reservation cleanup, and continued page
animation and DOM interaction. Explicit new attachments use a fresh service while old
work drains; late cleanup must preserve that replacement entry. Both `unknown` and
`destroyed` loss notifications invalidate live owners. Successful rendering always uses
real GPU work; these are simulated notifications, not physical hardware-loss evidence.

Memory admission checks hold three one-million-pixel captures pending and require a
fourth to reject before capture. Concurrent replacements verify retained-frame and
pending-output accounting, rejected refresh promises, stale-output hiding and zero
reservations after cleanup. Disposal and simulated device loss during capture keep
bytes reserved until late completion. Existing refresh/supersession and shared-loss
scenarios also check reservation cleanup. Pure ledger tests cover exact decimal target
and Document boundaries, atomic failed reconciliation, dimension changes and idempotent
release. These are bounded accounting checks, not process-memory or total-VRAM measurements.

The `/gsap.html` optional-package consumer verifies starting control snapshots,
callback-suppressed host seeking, reverse and fixed-time GPU output, one scheduled
commit for multiple writes, and no per-frame capture. It checks ambient rejection,
numeric options, insertion positions, zero duration, context revert, sibling preservation,
idempotent binding disposal and attachment disposal, plus the interactive controls.

Unexpected page/console errors fail the tests. There are no automatic retries.
Each test has a three-minute deadline; the browser suite has a ten-minute deadline.
The harness also requires report evidence from both projects, with no skipped tests,
expected failures, retries, or reporter errors. A command exit code alone is insufficient.

The `/assets.html` consumer verifies delayed font/image/background readiness by
comparing the visible target with the returned frame and saving both PNGs. It checks
broken assets, an unembeddable programmatic font, explicit SVG-image rejection, actual
cross-origin PNGs with CORS denied/permitted, and injected snapshot decode/readback
failures with zero-sized temporary canvases. Failure cases preserve the target and
pointer/keyboard interaction. An attachment waits through initial asset loading;
subsequent font/load/error signals hide stale output and automatically refresh.
Cross-origin fetches must send no cookies. Controlled network delays and injected
readback errors are identified as such; they do not claim physical network/GPU failure.

## Evidence and interpretation

The harness writes browser evidence alongside its summary in
`.scratch/agent/run-*/browser/`. Standalone browser runs use `.scratch/browser/` and
replace that standalone result on the next run. `DOMFX_BROWSER_OUTPUT_DIR` selects
another directory; the harness always supplies its own unique run directory.

The Playwright JSON report contains per-case results, durations, browser version,
and attached lab reports/console errors. The normal-rendering case attaches a viewport
screenshot; failed cases retain screenshots and traces. Inspect a failed trace with
`pnpm --filter @domfx/lab exec playwright show-trace /absolute/path/to/trace.zip`.
CI uploads `.scratch/agent/` as `browser-gpu-evidence` for seven days, including failures.

Pixel readbacks establish shader output; screenshot attachments help diagnosis but
are not visual-diff assertions. Accounted bytes are not a driver-memory leak detector.
Performance observations, especially SwiftShader timings, are not release thresholds.
Other browsers, fractional DPR, expanded geometry, physical device loss, and
additional runtime motion-preference changes need their own scenarios when relevant to a change.

The implementation follows Playwright's [web-server lifecycle](https://playwright.dev/docs/test-webserver)
and [Chromium channel guidance](https://playwright.dev/docs/browsers), with the Linux
software backend based on [Vercel's verified WebGPU preset](https://github.com/vercel-labs/agent-browser/blob/main/skill-data/core/references/webgpu.md).
See also Chromium's [SwiftShader documentation](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/docs/gpu/swiftshader.md).

Automatic invalidation fixtures verify one capture per paint burst, replacement pixels
matching a fresh attachment, stylesheet-driven target resizing, placement reuse,
descendant paint refresh, explicit-refresh coalescing and disposal of queued work.
Real snapshot readback hashes record changed text, image, background and delayed-font
paint; no capture or renderer mock supplies those pixels. Stylesheet hide/show verifies
size-triggered recovery without a hidden-target retry loop. Injected decode failure verifies stale/unavailable diagnostics
without unhandled rejections or retries. Source-mutating SnapDOM styles reject before
creating capture feedback loops. These run in both browser projects.

## Five-class live gallery

The main lab attaches fire through `attachFire` to the headline with counters, rounded
button with children, stroked/holed SVG, transparent raster and composite card. SVG and
raster share a bordered rectangular scrolling host; the other three have separate hosts.
Each target has independent time, intensity, refresh, move/scale and disposal controls.
The headline uses the manual clock with GSAP controls; the others start paused with
ambient Play / pause controls. Change content updates the button and calls public refresh.

The normal-rendering checks require all five live layers at DPR 1 and 2 in development
and production. Canvas pixel readbacks verify nonempty fire, independent controls,
zero intensity, deterministic restoration, changed-content refresh and surviving output
after shared/separate-host disposal. Manual and paused targets retain their time and
reproduce their pixels through translation, positive axis-aligned scale and host scrolling.
`gallery-checks.json` saves numerical viewport bounds, pixel hashes and control snapshots;
final disposal requires zero attachment reservations and no live layers. Existing
placement/shared-service fixtures additionally gate raster reuse and GPU resource cleanup.

For each class, `capture-`, `mask-`, `sdf-` and `fire-<target>-dpr<N>.png` record the
initial diagnostic capture with **48 CSS-pixel padding**, a threshold of 128, the full-raster
SDF oracle check, and fire at time 1.5/seed 314/intensity 0.85. Separate
`live-fire-<target>-dpr<N>.png` files record actual public attachment canvases with their
**32 CSS-pixel padding** and the controls in `report.gallery`. The diagnostics describe
the initial paint; live files describe the last saved active output, with disposed targets'
last images retained. They are not interchangeable pixel baselines. The development
Save experiment evidence button and automated browser runner save both sets.

An injected SVG canvas-context failure must report FAIL even though its diagnostic capture
and numerical checks passed. Required targets and completed diagnostic images remain;
partial attachments are disposed. This prevents capture-only coverage from passing the
live gallery gate. Existing overflow/paint failure fixtures remain required, and supported
geometry stays within the documented capture and rectangular clipping limits.
