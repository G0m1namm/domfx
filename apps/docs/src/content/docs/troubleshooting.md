---
title: "Troubleshooting"
description: "Read the reported reason, correct the condition, then retry explicitly."
---

Wait for `effect.ready`, then inspect `lifecycle`, `raster` and the `reason` code.
Use `reasonDetail` for diagnostics, not program logic. Environmental unavailability
does not reject readiness; invalid options and target conflicts can throw synchronously.

## Missing or suppressed output

- `no-webgpu`, `no-adapter`, `canvas-webgpu-unavailable`: check the actual
  browser/device and use a secure context or loopback address. Keep original content
  usable. A build or typecheck cannot prove GPU availability.
- `reduced-motion`: respect the preference. Choose `motion: 'static'` at creation
  for a still decoration, or retry explicitly after the preference changes. There
  is no animated override.
- `empty-mask`, `missing-exterior`: the target needs classified opaque pixels and
  transparent exterior within capture padding. A fully transparent target has no
  silhouette.
- `capture-budget`, `target-budget`, `aggregate-budget`: reduce captured size,
  DPR or simultaneous attachments. Dispose unused effects.
- `renderer-failed`, `device-lost`: inspect GPU/shader diagnostics. Explicit retry
  can attempt recreation; recovery is not guaranteed.

## Misplaced or rejected output

Ensure the host is connected, positioned and contains the target. Leave room for
decoration and use compatible stacking. `unsupported-placement` reports geometry
or clipping outside the [current limits](/docs/support#capture-and-composition-limits).
Do not compensate with a guessed bounding box. `reasonDetail` identifies the rejected
element (tag and ID when present), computed CSS property/value and a suggested correction.
For example, a rotated `h1#title` reports its computed `transform` and requests
translation/positive axis-aligned scale. A filter reports the offending element
and suggests removing it or applying it to the shared host. Wording is diagnostic;
branch on the `reason` code instead.

For `unsupported-composition`, check target/intermediate opacity, filters (even
`blur(0px)`), backdrop filters and blending. Animate the host's opacity when native
content and its effect should fade together, as in the [GSAP example](/docs/gsap).
Correct the CSS before retrying.

## Failed or stale capture

`capture-failed` points to asset, CORS, font or decode diagnostics. Wait for fonts
and decoded assets. Observed target changes can refresh automatically; unobserved
ancestor/stylesheet paint, hover/focus and canvas drawing need explicit refresh.
This is snapshot capture, not continuous video capture.

`target-not-visible` and `stale-raster` can describe suspension rather than failure.
Up-to-date output can resume on visibility; out-of-date captured appearance needs refresh or retry when visible.
A borderless outlined target or `content-visibility: auto` subtree can reject to
prevent capture from mutating source content.

## Installation or shader errors

If installation tries the registry for core, retain the
[local tarball override](/docs/installation#create-your-preview-app) and check every
artifact path. Registry instructions must wait for package publication.

For a shader metadata error, rebuild and repack the browser package, then reinstall
its tarball. Its package build owns the TypeGPU transform. Import the public export;
do not import source files or private dist paths or add a consumer shader plugin.

For `renderer-failed` during GPU initialization, inspect `reasonDetail` for the
effect name and generated WGSL line/column when the native compiler supplies them.
Programs are prepared together for the shared renderer, so the named shader can
belong to a different effect from the one you attached. Retry does not repair
invalid shader source; correct the package build first.

## Trace an attachment

For local debugging, import `startEffectDiagnostics` from
`@domfx/browser/experimental`. Start the session before creating the attachment;
existing attachments are not instrumented retroactively. With a mounted `target`
and positioned `host`, use this JavaScript module in a local development build:

```js
import { attachFrost } from '@domfx/browser';
import { startEffectDiagnostics } from '@domfx/browser/experimental';

const trace = startEffectDiagnostics({ capacity: 128 });
try {
  const effect = attachFrost(target, { host, clock: 'manual' });
  window.addEventListener('pagehide', () => effect.dispose(), { once: true });
  // Also dispose the attachment on component unmount.
  await effect.ready;
  console.table(trace.records);
} finally {
  trace.dispose();
}
```

Each record contains the effect, an opaque session-local target number, capture
revision, stage, phase and CPU timestamp in milliseconds. Stages cover renderer
acquisition, capture, preparation, revision commit/drop and first presentation.
Presentation records submission of the decorative output, not GPU completion or
screen display. There are no per-frame records.

Only one session can run at a time. Capacity defaults to 128 records and accepts
integers from 1 to 4096; oldest records are discarded at the limit. `records`
returns a snapshot. Copy it before disposal if you need it later. Disposal clears
retained records and marks; it does not dispose attachments.

Pass `userTiming: true` to also create bounded `domfx:` marks in the browser's
Performance panel. Traces do not retain DOM text or selectors. Keep exported
traces local, and disable diagnostics for performance measurements. This is an
experimental debugging interface, not stable application telemetry.

The experimental entry also exposes internal GPU types and is outside the root
package's consumer TypeScript guarantees. For TypeScript tracing, use the
repository's GPU-fixture setup. Application integrations can use the root API's
`reason` and `reasonDetail` without that setup.

## Recover explicitly

After correcting the reported condition, an async user action can run the
following for any effect handle:

```ts
try {
  await effect.retry();
  console.info(effect.lifecycle, effect.raster, effect.reason, effect.reasonDetail);
} catch (error) {
  console.info(error);
}
```

Concurrent retries share one attempt and retain controls and GSAP bindings. Refresh
or control writes cannot recover an unavailable handle. Retry on a disposed handle
rejects; create a new attachment after remounting. `effect-target-owned` means another live
effect uses this target, an ancestor or a descendant. Dispose that effect first; arbitrary visual overlap is a different condition.
