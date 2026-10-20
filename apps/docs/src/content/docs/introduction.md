---
title: "Introduction"
description: "GPU effects for real HTML. Keep your content, add an edge."
---

domfx adds GPU edge effects to the visible shape of a DOM element. Your text
stays selectable, your buttons keep their handlers, and your links keep working.
The effect lives in a separate canvas alongside the original content.

> domfx is experimental. The @domfx package scope is selected and the packages are
> unpublished. Start with the [local installation workflow](/docs/installation).

## Start with your element

Choose the exact **target element**: text, an inline SVG, a transparent image, a
button or a card. Its captured appearance determines the **visible shape** (silhouette), including
holes and disconnected shapes. An opaque image produces a rectangle; transparency
defines the edge. Selecting a container captures its combined paint.

Choose an **effect container** (`host`) with CSS `position: relative` that contains your target. domfx appends its
decorative output there, without wrapping, moving or replacing your content.

## Start with GSAP

If you already use GSAP, follow the [complete GSAP recipe](/docs/gsap): attach an effect
to your own heading, animate it with a timeline you own, seek/reverse and register cleanup.
Your heading remains real, selectable HTML. [Install matching artifacts](/docs/installation)
first; the public npm route will be added after verified alpha publication.

## Control animation

- [Standalone](/docs/standalone): use automatic animation, or control effect time
  with your own code.
- [GSAP](/docs/gsap): animate an effect with your own timeline. Animate effect
  time and intensity alongside the rest of your sequence.

## Choose an effect

Choose from Electricity, Frost, Fire, Slime, Burned paper, Kinetic bloom and the
pattern effects in [the effects gallery](/effects/). Every attachment returns the
same `EffectHandle` with time, intensity, refresh and disposal controls. See
[available attachments](/docs/api#available-effects) for each import name.

The [Standalone guide](/docs/standalone#attach-fire) uses Fire for its interactive
example. Its intensity and playback controls apply to every effect. `flameHeight`
is specific to Fire; omit it when using another attachment function.

## Keep the original usable

The effect is optional decoration. Missing WebGPU, reduced motion or unsupported
capture conditions leave the original DOM available. Inspect the effect's
state and reason code, and release it when your page or component goes away.

See the [API reference](/docs/api) for the public contract, [browser support](/docs/support)
for measured limits, and [troubleshooting](/docs/troubleshooting) for unavailable output.
