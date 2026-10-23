---
title: "Introduction"
description: "GPU effects for real HTML. Keep your content, add an edge."
---

domfx adds GPU edge effects to the visible shape of a DOM element. Your text
stays selectable, your buttons keep their handlers, and your links keep working.
The effect lives in a separate canvas alongside the original content.

> domfx is experimental. Version `%DOMFX_BROWSER_VERSION%` is available on npm.
> Start with the [installation guide](/docs/installation).

## Start with your element

The **target element** is the text, button, image or card whose shape receives
the effect. The **effect container** (`host`) holds that element and the decorative
canvas; give it CSS `position: relative`. domfx keeps the original content in place.

Follow [Installation](/docs/installation) and [Standalone](/docs/standalone) to
build a complete app: a button with flames and a working click counter.

## Start with GSAP

If you already use GSAP, follow the [complete GSAP recipe](/docs/gsap): attach an effect
to the same button, animate it with your own timeline, seek, reverse and clean up. [Install the alpha](/docs/installation) first.

## Control animation

- [Standalone](/docs/standalone): use automatic animation, or control effect time
  with your own code.
- [GSAP](/docs/gsap): animate an effect with your own timeline. Animate effect
  time and intensity alongside the rest of your sequence.

## Choose an effect

Choose from Electricity, Frost, Fire, Slime, Burned paper, Kinetic bloom and the
pattern effects in [the effects gallery](/effects/). Every attachment returns an
effect instance (`EffectHandle`) with time, intensity, refresh and disposal controls. See
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
