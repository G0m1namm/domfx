# Effect program preparation and diagnostics

## Decision

Keep eager preparation of the 21 accepted effects at renderer initialization.
`EffectPrograms` privately owns shader selection, compilation diagnostics, pipelines
and the explicit compatible binding layout. Every prepared target creates one bind
group shared across these pipelines. Rendering and effect switching perform no
compilation. Device ownership, frame allocations and disposal stay with the renderer.

Binding 0 is an unfilterable float 2D SDF texture, visible to the fragment stage.
Binding 1 is a 16-byte uniform (`vec4f`, alignment 16): time at offset 0, seed at 4,
intensity at 8, raster pixels per effect unit at 12. Fire retains its existing
flame-height scaling. Output remains premultiplied RGBA8. The managed reservation
ledger is unchanged; fewer bind groups does not establish lower GPU memory use.

Only byte-identical WGSL helpers are shared. Raster-coordinate sampling and
CSS-coordinate distance/gradient sampling remain distinct, as do gradient/value
noise and scalar/vector hash variants. Pattern source contains only the requested
body. No formula, seed, threshold or captured silhouette is changed.

## Evidence and tradeoff

See #121 and its implementation PR for the source identities and verification runs.
Local comparison on 2026-10-19 used Chromium 153.0.8010.12, macOS/Apple Metal 3,
1280×900 viewport, DPR 2, a 688×256 padded headline raster, seed 314, time 2.4,
intensity 0.7. Five fresh visible Chromium profiles per variant used production
builds and no diagnostic tracing. Driver/filesystem caches were not cleared;
power mode and refresh rate were not controlled.

The bounded lazy prototype moved module/pipeline creation into the first render;
it was measured locally and removed. It omitted the readiness, concurrent-request,
compilation-failure and device-loss handling that a production lazy implementation
would require. Eager service initialization measured 26.2–194.5 ms (median 29.7);
the prototype measured 2.0–23.5 ms (median 15.7). First-render submit-to-queue-completion
measured 0.6–0.8 ms (median 0.7) eager versus 2.2–3.5 ms (median 2.3) lazy.
These wall-clock boundaries are not GPU timestamp measurements or broad performance
claims. Ordering/cache effects limit comparison, especially the first eager profile.
A second five-profile eager batch measured a 29.2 ms initialization median and
0.6–0.8 ms first-render queue completion, consistent with the first eager batch.

Retain predictable synchronous rendering and one initialization failure path rather
than add a second readiness/cache lifecycle for this local startup difference.
Revisit requested-effect caching if #86 demonstrates that preparation is material
on production paths. This decision does not claim #86 or broader device evidence
in #87 complete. Smaller generated sources do not imply faster shader execution.

The local fixed-time RGBA references for all effects on text/thin strokes, an SVG
with a hole/disconnected regions and a transparent image at DPR 1/2 remain ignored.
Exact same-device comparisons are required for this mechanical refactor; do not
replace baselines automatically to hide a visual difference.

## Opt-in diagnosis

Before attaching the targets to investigate:

```ts
import { startEffectDiagnostics } from '@domfx/browser/experimental';

const trace = startEffectDiagnostics({ capacity: 128, userTiming: true });
// Attach targets and refresh as usual, then inspect trace.records.
// Dispose after copying the snapshot; this clears records and User Timing marks.
trace.dispose();
```

This is the existing experimental debugging surface, not stable consumer telemetry.
One session retains at most 1–4096 records (128 by default). Records carry effect,
opaque session-local target identity, capture revision, stage, phase and CPU monotonic
time. No DOM text/selectors or per-frame records are retained. Start before attachment;
existing attachments are not retroactively instrumented. Disabling/disposal gates
recording and clears the session's User Timing marks. Snapshot records can be exported
locally; do not commit traces or captured content.

Renderer records cover acquisition/initialization wait (including an existing shared
service), capture and SDF preparation have start/end records, and revision records
identify commit/drop. Presentation means the first submitted canvas copy for that
revision, not completed GPU execution or compositor display. Initialization failures
retain existing unavailable reasons; shader errors additionally identify the effect
and generated WGSL line/column where the native compiler provides it. Retained device
errors are limited to 32 truncated messages. Measurements should run without tracing;
enable User Timing separately for the existing CDP trace tooling.

`DOMFX_MEASURE_EFFECT=frost pnpm measure:performance` and `pnpm measure:steady`
select an effect through the existing fixtures (Fire by default). Initialization,
first-render CPU submission and queue completion are separate measurements. Steady
GPU timestamps remain separate from CPU submission and presentation costs.
