---
layout: ../../layouts/Documentation.astro
---

Wait for `fire.ready`, then inspect `lifecycle`, `raster` and the typed `reason`.
Use `reasonDetail` for diagnostics, not program logic. Environmental unavailability
does not reject readiness; invalid options and ownership can throw synchronously.

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

## Misplaced or rejected Fire

Ensure the host is connected, positioned and contains the target. Leave room for
decoration and use compatible stacking. `unsupported-placement` reports geometry
or clipping outside the [current limits](/docs/support#capture-and-composition-limits).
Do not compensate with a guessed bounding box. `reasonDetail` identifies the rejected
element (tag and ID when present), computed CSS property/value and a suggested correction.
For example, a rotated `h1#title` reports its computed `transform` and requests
translation/positive axis-aligned scale. A filter reports the offending element
and suggests removing it or applying it to the shared host. Wording is diagnostic;
branch on the typed `reason` instead.

For `unsupported-composition`, check target/intermediate opacity, filters (even
`blur(0px)`), backdrop filters and blending. Animate the host's opacity when native
content and Fire should fade together, as in the [GSAP example](/docs/gsap).
Correct the CSS before retrying.

## Failed or stale capture

`capture-failed` points to asset, CORS, font or decode diagnostics. Wait for fonts
and decoded assets. Observed target changes can refresh automatically; unobserved
ancestor/stylesheet paint, hover/focus and canvas drawing need explicit refresh.
This is snapshot capture, not continuous video capture.

`target-not-visible` and `stale-raster` can describe suspension rather than failure.
Fresh output can resume on visibility; stale paint needs refresh or retry when visible.
A borderless outlined target or `content-visibility: auto` subtree can reject to
prevent capture from mutating source content.

## Installation or shader errors

If installation tries the registry for core, retain the
[local tarball override](/docs/installation#create-your-preview-app) and check every
artifact path. Registry instructions must wait for package publication.

For a shader metadata error, rebuild and repack the browser package, then reinstall
its tarball. Its package build owns the TypeGPU transform. Import the public export;
do not import source files or private dist paths or add a consumer shader plugin.

## Recover explicitly

After correcting the reported condition, an async user action can run:

```ts
try {
  await fire.retry();
  console.info(fire.lifecycle, fire.raster, fire.reason, fire.reasonDetail);
} catch (error) {
  console.info(error);
}
```

Concurrent retries share one attempt and retain controls and GSAP bindings. Refresh
or control writes cannot recover an unavailable handle. Retry on a disposed handle
rejects; create a new attachment after remounting. `effect-target-owned` means a live
attachment owns this target or an overlapping subtree; release that owner first.
