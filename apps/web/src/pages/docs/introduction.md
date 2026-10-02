---
layout: ../../layouts/Documentation.astro
---

domfx adds decorative Fire to the visible silhouette of a DOM element. Your text
stays selectable, your buttons keep their handlers, and your links keep working.
The effect lives in a separate canvas alongside the original content.

> domfx is experimental. The @domfx package scope is selected and the packages are
> unpublished. Start with the [local installation workflow](/docs/installation).

## Start with your element

Choose the exact **effect target**: text, an inline SVG, a transparent image, a
button or a card. Its captured paint determines the **silhouette**, including
holes and disconnected shapes. An opaque image produces a rectangle; transparency
defines the contour. Selecting a container captures its combined paint.

Choose a positioned **effect host** that contains your target. domfx appends its
decorative output there, without wrapping, moving or replacing your content.

## Start with GSAP

If you already use GSAP, follow the [complete GSAP recipe](/docs/gsap): attach Fire
to your own heading, bind it to a timeline you own, seek/reverse and register cleanup.
Your heading remains real, selectable HTML. [Install matching artifacts](/docs/installation)
first; the public npm route will be added after verified alpha publication.

## Choose a clock

- [Standalone](/docs/standalone): use an ambient clock for automatic time, or a
  manual clock for explicit seeking and control.
- [GSAP](/docs/gsap): bind a manual attachment to your own timeline. Animate Fire's
  time and intensity alongside the rest of your sequence.

Fire is currently the only effect. [Try the image, SVG and live text examples](/#examples)
before attaching it to your own element.

## Keep the original usable

The effect is optional decoration. Missing WebGPU, reduced motion or unsupported
capture conditions leave the original DOM available. Inspect the attachment's
lifecycle and reason, and release it when your page or component goes away.

See [API essentials](/docs/api) for the public contract, [browser support](/docs/support)
for measured limits, and [troubleshooting](/docs/troubleshooting) for unavailable output.
