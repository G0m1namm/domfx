---
title: "Browser support"
description: "Tested browsers and limits for capture, placement and effects."
---

domfx requires WebGPU in a secure context, such as HTTPS or localhost. When an
effect cannot render, the original content remains visible and interactive.

All [21 effects](/docs/api#available-effects) share the capture and placement
limits below. Browser checks do not establish equal visual or performance
coverage for every effect.

## Measured environments

The **support record v1, dated 2026-09-16 UTC**, covers Chromium 153.0.8010.12
and a narrower Chrome 152.0.7977.83 run on macOS 26.6.2, Apple M5 Pro, with
native Metal WebGPU. It includes capture, placement, Fire rendering, original
interaction and cleanup. Vite applications using packed standalone and GSAP
packages also have recorded type, SSR-import and GPU checks.

These are tested environments, not minimum supported browser versions. See the
[versioned support record](https://github.com/G0m1namm/domfx/blob/afcfd626eea273d7881048eb03b21973e10cce40/engineering/browser-support.md)
for exact cases and measurements.

## Untested coverage

Safari, Firefox, Edge, mobile devices, Windows/Linux GPUs, other macOS GPUs,
fractional device pixel ratios, other bundlers and physical device loss lack
qualifying coverage in that record. Untested does not mean incompatible.

Native input, focus, text selection and decorative canvas semantics have been
checked. This is not an assistive-technology audit or a guarantee of frame rate,
GPU memory use or long-session performance.

## Capture and composition limits

The effect uses a snapshot of the target element. PNG, JPEG, WebP, the selected
`currentSrc`, supported CSS backgrounds and embeddable fonts depend on asset
readiness and CORS. Accepted formats have broader scope than the tested assets.

- External SVG images and SVG image references, video, `iframe`, `object`, `embed`,
  open shadow roots, `image-set()` and URL-based paint such as masks are rejected.
  Inline SVG paths are distinct from external SVG images.
- Translation and positive axis-aligned scales have limited verification. Rotation,
  skew, perspective, zero or negative scale, and CSS zoom are rejected.
- Positioned HTML ancestors between the target and its effect container can have
  rectangular overflow clips. Rounded clips, `clip-path`, masks, paint containment,
  `overflow: clip` and fixed-position intermediates are rejected. Arbitrary stacking,
  top-layer content and shadow/slot composition are not established.
- Target or intermediate opacity other than 1, filters, backdrop filters and
  blending cannot be reproduced by the separate canvas. Apply group effects to
  the effect container or its ancestors so they affect the shared subtree.
- Large shadows or overflowing content can exceed the capture margin. Keep an
  explicit effect container and compatible stacking; capture fidelity is bounded.

## When an effect is unavailable

Check `effect.reason` and `effect.reasonDetail`, correct the condition, then
[retry explicitly](/docs/troubleshooting#recover-explicitly). Reduced motion
suppresses output by default; choose `motion: 'static'` at creation for a still
decoration. See [reduced motion](/docs/api/shared#reduced-motion).

## Source and feedback access

The [source repository](https://github.com/G0m1namm/domfx) is public.
[Report a problem](https://github.com/G0m1namm/domfx/issues) with a small
reproduction, package versions, browser/device details and the reported reason.
Use the repository's [security policy](https://github.com/G0m1namm/domfx/blob/main/SECURITY.md)
for security reports.
