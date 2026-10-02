---
layout: ../../layouts/Documentation.astro
---

Import from `@domfx/browser` and the optional `@domfx/gsap` export. Imports are
SSR-safe; attachment and capture calls require browser DOM elements.

## Create an attachment

`attachFire(target, options)` returns an `EffectHandle` immediately. The required
`host` must be positioned and contain the target. Optional creation values:

- `clock`: `'manual'` by default, or `'ambient'` for automatic time.
- `motion`: `'respect'` by default, or `'static'` for a still decoration.
- `seed`: immutable after creation; defaults to 0.
- `time`: absolute seconds; defaults to 0. Must be finite and float32-representable.
- `intensity`: defaults to 1. Finite values clamp to the range 0–1.
- `flameHeight`: defaults to 24 CSS pixels; valid range 8–64. Requires compatible
  current experimental artifacts.

Invalid options, host relationships and overlapping target ownership throw
synchronously. The browser package owns capture and GPU rendering; consumers need
no shader transform or private renderer imports.

## Read state

- `ready: Promise<void>` settles after original initialization and cleanup. It
  does not reject for environmental unavailability.
- `lifecycle`: `active`, `suspended`, `unavailable` or `disposed`.
- `raster`: `fresh`, `refreshing` or `stale`.
- `reason`: a typed `EffectReason`, or undefined.
- `reasonDetail`: a diagnostic string, or undefined. Do not branch on this text.

Playback, lifecycle and raster freshness are independent. A paused attachment can
still have a fresh raster and visible output.

## Control playback

Write `time` and `intensity`. Values are immediately readable and rendering batches
on the next frame without recapturing. `seed` and `clock` are immutable.
`paused`, `pause()` and `resume()` control ambient playback. A manual clock never
advances through `resume()`.

## Refresh, retry and dispose

- `refresh(): Promise<void>` requests fresh captured paint and hides stale output.
  It resolves when this or a newer revision commits, and rejects on failure,
  invalidation or disposal.
- `retry(): Promise<void>` tears down and reinitializes with retained controls.
  Concurrent retries share one attempt. Inspect the lifecycle after it settles:
  the underlying condition can still make output unavailable.
- `dispose()` releases the attachment. It is idempotent and safe before readiness.
- `onDispose(callback)` registers a callback that runs once, immediately if
  already disposed. It returns an unsubscribe function.

Refresh and control writes cannot recover an unavailable handle. Retry on a
disposed handle rejects. Keep asynchronous handlers inside the component's lifetime
and handle rejected promises.

## Bind GSAP

`bindFire(effect, timeline, options)` accepts a live manual attachment. Required
options are destination `time`, `intensity` and nonnegative `duration`. Optional
`position` accepts GSAP insertion syntax; `disposeEffect` defaults to false.
It snapshots starting controls and interpolates them linearly. The returned
`dispose()` removes only its tween unless effect ownership was explicitly transferred.

`bindFireAsync(promise, timeline, options)` requires `disposeEffect: true` and
immediately exposes `dispose()` and `ready`. It releases late results after
cancellation or context revert. Use `context.revert()` for context cleanup.

See the [complete GSAP example](/docs/gsap) for a sequence and its owned teardown.
