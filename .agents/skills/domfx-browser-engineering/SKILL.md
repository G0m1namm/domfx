---
name: domfx-browser-engineering
description: Implement, debug, and review domfx browser capture, SnapDOM integration, DOM geometry, effect layers, CSS compositing, observers, resize/scroll/DPR handling, animation lifecycle, and reduced-motion behavior. Use for misaligned effects, stale captures, hidden/detached targets, resource leaks, accessibility regressions, or browser verification. Pair with GPU guidance for rendering changes and GSAP skills for timeline APIs.
---

# domfx browser engineering

Follow the root contributor guidance, domain vocabulary, and development harness.
Read `packages/domfx/src/browser.ts`, the affected lab fixture, and the installed
SnapDOM/GSAP APIs. Current code is experimental; distinguish its limitations from
the contract requested by the issue or user.

## Preserve content and ownership

- Keep the original effect target as the source of content, focus, and interaction.
  Decorative layers must not duplicate accessible content or intercept pointer input.
  Do not hide or replace the target to make an effect look correct.
- Use the target's owning document/window where relevant. Keep browser globals out of
  module initialization and the independent core; access them at the browser boundary.
- Create only the nodes/styles/listeners the effect owns. Dispose or restore those
  changes without removing caller-owned elements or unrelated inline styles.
- Treat missing capabilities or failed captures as unavailable effects with a usable
  original target. Do not silently report capture success when an asset was omitted.

## Capture and geometry

- Name every coordinate space: untransformed target-local CSS pixels, capture raster,
  viewport, and effect-host coordinates. `getBoundingClientRect()` is viewport-relative
  geometry, not the complete painted silhouette or an untransformed local box.
- Handle transforms, scrolling, padding, overflow, and clipping according to the agreed
  capture/compositing contract. Do not invent support for complex 3D transforms or
  stacking contexts by approximating them with one bounding rectangle.
- Preserve the selected root's capture policy separately from descendant paint. Confirm
  SnapDOM options and metadata against the pinned implementation before relying on them.
- Bound raster dimensions using DPR and the resource budget before allocation. Account
  for zero-size, detached, hidden, and newly visible targets without busy retry loops.
- Define which changes invalidate captured paint versus only moving the effect layer.
  Observe only relevant sources; a ResizeObserver alone does not detect every position,
  transform, font, image, or appearance change.
- Establish font/image readiness for the required fidelity. Handle cross-origin image
  restrictions and canvas readback failures honestly. Revoke owned object URLs and
  close owned image bitmaps when their lifetimes end.

## Scheduling and animation

- Batch related layout reads before style writes. Coalesce invalidations and prevent
  observer feedback loops; use explicit dirty state instead of unconditional recapture.
- Give every observer, event listener, scheduled callback, and in-flight capture an
  owner. Disconnect/cancel on disposal, and reject or release stale async results.
- Respect reduced motion at startup and on preference changes. Decide whether a hidden
  page pauses or catches up on return; frame callbacks are not a reliable background clock.
- Use one agreed animation clock. For deterministic effects, identical absolute time,
  seed, and parameters should reproduce the same result within the established tolerance.
- For GSAP APIs, read `gsap-core` and, when sequencing, `gsap-timeline`. Animate the
  effect's controls rather than changing global GSAP defaults/ticker policy. Do not kill
  caller-owned timelines. Local cleanup must cover callbacks and resources created later.
- Scope selectors and cleanup to the owning target/host. Avoid broad `clearProps`,
  `autoAlpha`, or global timeline operations that alter the original target's behavior.

## Verify browser behavior

- Reproduce in the lab with the real capture adapter. Use unit tests for pure mapping
  logic; DOM mocks cannot prove painting, layout, stacking, or GPU output.
- Pick relevant cases: nested scroll, transformed host/target, fractional sizes/DPR,
  overflow and holes, delayed images/fonts, hide/show, removal, repeated attachment,
  refresh racing disposal, seek/reverse, and reduced-motion changes.
- Verify pointer and keyboard interaction still reach the original target. Check for
  stale overlays and retained listeners/resources after disposal.
- Run `pnpm agent:verify` plus the required development and production browser checks
  for capture/GPU changes. Record browser, page visibility, viewport, DPR, motion setting,
  observed results, and remaining unsupported cases. Screenshots alone cannot prove cleanup.

## Primary references

- [getBoundingClientRect](https://developer.mozilla.org/en-US/docs/Web/API/Element/getBoundingClientRect)
  and [ResizeObserver](https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver).
- [requestAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame)
  and [canvas images](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Using_images).
- [SnapDOM source](https://github.com/zumerlab/snapdom): verify against the installed version.
- [GSAP documentation](https://gsap.com/docs/v3/): API semantics and scoped cleanup.
