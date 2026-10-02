---
layout: ../../layouts/Documentation.astro
---

This summary uses **support record v1, 2026-09-16 UTC**. A pass applies to its
named environment, fixtures and source snapshot. It does not establish a minimum
browser version, browser-family support or release approval.

## Measured environments

- **Chromium 153.0.8010.12**, macOS 26.6.2 on the measured Apple M5 Pro, native
  Apple Metal 3 WebGPU: 386 development/production cases passed without skips or
  retries. Viewport 1280 × 900, DPR 2; capture, gallery, placement and scrolling
  also have DPR 1 coverage. Positive rendering disabled reduced motion.
- **Chrome 152.0.7977.83** on that machine: a narrower production capture, SDF,
  deterministic Fire, original-button interaction and disposal run passed at
  1280 × 720, DPR 2. It is not the full Chromium suite.
- **Packed Vite consumers**: standalone and GSAP tarball consumers have recorded
  strict types, SSR imports, real GPU output and lifecycle results in the versioned
  record. These results do not establish other bundler support.

The browser-reported adapter is `apple / metal-3`; its device and description
fields were empty. No wider device identity is inferred from those fields.

## Untested coverage

Safari, Firefox, Edge, mobile, Windows/Linux native GPUs, other macOS GPUs,
fractional DPR, other bundlers and physical device loss lack qualifying coverage
beyond the record's explicit scope. UNTESTED means no qualifying observation,
not a pass or an incompatibility finding.

Accessibility lifecycle fixtures cover native input, focus, text selection and
decorative canvas semantics. They are not a VoiceOver, NVDA or other assistive
technology audit. Historical performance measurements have their own fixed
fixtures; they do not establish a frame-rate, total VRAM or long-session guarantee.

## Capture and composition limits

The captured target is a snapshot. PNG/JPEG/WebP, selected `currentSrc`, supported
CSS backgrounds and embeddable fonts still depend on asset readiness and CORS.
Measured asset fixtures are narrower than the accepted paths. SVG image documents
and references, video, iframe/object/embed, open shadow roots, `image-set()` and
other URL-bearing paint such as masks are rejected. Inline SVG paths within the
document are distinct from external SVG image assets.

Translation and positive axis-aligned scales have bounded verification. Rotation,
skew, perspective, zero/negative scale and CSS zoom reject. Positioned intermediate
HTML ancestors can have rectangular overflow clips; rounded clips, clip paths,
masks, paint containment, `overflow: clip` and fixed intermediates reject.
Arbitrary stacking, top-layer and shadow/slot composition are not established.

Target or intermediate opacity other than 1, filters, backdrop filters and blending
cannot be reproduced by the separate canvas. Host and outer group effects apply
natively to the shared subtree. Keep an explicit host and compatible stacking.
Larger overflow or shadows can exceed capture padding; do not infer unlimited paint
fidelity from the measured fixtures.

## When an effect is unavailable

The original DOM remains the content and interaction surface. Reduced motion
suppresses animated output by default. Check the typed reason and use
[explicit recovery](/docs/troubleshooting) after correcting the condition.

The [versioned browser/device record](https://github.com/G0m1namm/domfx/blob/5aa74b29636bdacb384c2f106e7b93f4b0c2ad91/engineering/browser-support.md)
retains full fixture, accessibility, performance and missing-coverage evidence.
Repository source links require access while the repository is private.

## Source and feedback access

The repository is currently private. GitHub source links require access until the
maintainer opens it for the alpha; the guides on this site remain readable locally.
After launch, report a small reproduction with versions, environment and the typed
reason through GitHub issues. Keep security reports in the private reporting channel.
