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
- `empty-mask`, `missing-exterior`: the captured shape needs opaque pixels and
  transparent space around them. A fully transparent target has no visible shape.
- `capture-budget`, `target-budget`, `aggregate-budget`: reduce the captured size,
  device pixel ratio (DPR) or number of simultaneous effects. Dispose unused effects.
- `renderer-failed`, `device-lost`: inspect GPU/shader diagnostics. Explicit retry
  can attempt recreation; recovery is not guaranteed.

## Misplaced or rejected output

Check that `host` is connected, has CSS `position` other than `static`, and
contains the target element. Leave room for decoration and use compatible stacking.
For `unsupported-placement`, read `reasonDetail`: it identifies the element,
unsupported CSS and a suggested correction. Compare it with the
[current limits](/docs/support#capture-and-composition-limits), then correct the
CSS before retrying.

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
Up-to-date output can resume on visibility, and observed visibility re-entry refreshes a
stale capture. This does not retry an unavailable or failed effect; correct its condition
and call `retry()` explicitly.
A borderless outlined target or `content-visibility: auto` subtree can reject to
prevent capture from mutating source content.

## Installation or shader errors

Install the published packages using the exact versions in the
[installation guide](/docs/installation). Check your lockfile for incompatible
versions or leftover local tarball overrides.

Import from `@domfx/browser`, not source files or private `dist` paths. The package
already includes the TypeGPU shader transform; your app needs no shader plugin.
For shader metadata errors, reinstall the published package and report the error
if it persists.

For `renderer-failed`, `reasonDetail` can include an effect name and generated
WGSL line/column. The named shader may belong to another effect because the
renderer prepares programs together. Retry does not repair invalid shader source;
include the diagnostic and package version in your report.

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

Records describe setup and capture stages with CPU timestamps in milliseconds.
A presentation record means output was submitted, not that GPU execution or screen
display finished. There are no per-frame records, DOM text or selectors.

Only one session can run at a time. `capacity` defaults to 128 and accepts integers
from 1 to 4096; the oldest records are discarded when full. `records` returns a
snapshot. Copy it before `trace.dispose()`, which clears records and marks but
does not dispose effects. `userTiming: true` also adds bounded `domfx:` marks to
the browser's Performance panel.

Keep exported traces local and disable tracing when measuring performance. This
experimental JavaScript entry exposes internal GPU types and is outside the root
package's consumer TypeScript guarantees. Use `reason` and `reasonDetail` from the
root API for application diagnostics.

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

A resolved retry means the attempt finished; check state to see whether it worked.
Concurrent retries share one attempt and retain controls and GSAP bindings.
`refresh()` updates a capture; it cannot recover an unavailable effect. See
[effect methods](/docs/api/effect-handle#refresh-retry-and-dispose) for both contracts.

Retry on a disposed instance rejects. Create a new effect after remounting.
`effect-target-owned` means another effect owns this target, an ancestor or a
descendant. Dispose that effect first; this restriction concerns the DOM tree,
not visual overlap.
