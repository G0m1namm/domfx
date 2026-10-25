# @domfx/core

## 0.1.0-alpha.2

### Patch Changes

- Update packaged installation guidance to the verified alpha release. Core and GSAP runtime behavior is unchanged.

## 0.1.0-alpha.1

### Patch Changes

- Update the package guides to describe the published alpha and link to npm installation instructions.

## 0.1.0-alpha.0

### Minor Changes

- 7ba013e: Add experimental engraving, woven mesh, hexagon, interference, shard, circuit,
  star shimmer and brush fringe edge effects to the public attachment API and
  shared effect names. Support remains limited to the documented experimental contract.
- b31832a: Prepare the first experimental alpha of domfx. Add decorative Fire to real DOM
  silhouettes using a standalone attachment or a caller-owned GSAP timeline.
  Preserve native content/interaction, respect reduced motion and explicitly dispose
  attachments and bindings. Browser, placement and capture support remains limited
  to the documented experimental contract; consult support and migration guidance.
- 75a374c: Expose a one-target manual fire attachment with readable time/intensity controls,
  immutable seed, lifecycle and raster health, and idempotent disposal including
  pending initialization. Keep the original target usable and own the decorative
  canvas inside an explicit positioned host.

### Patch Changes

- 3465eec: Add explicit manual/ambient attachment clock modes and ambient pause/resume controls.
  Batch parameter writes into one render commit per dirty target per animation frame
  through a shared document scheduler, reusing captured rasters. Manual remains the
  default.

  Breaking change: control writes update readable values immediately but no longer
  render synchronously. Await the next animation frame before reading rendered output.

- c74bc3a: Add `clock: 'auto'` for automatic animation while preserving `'ambient'` and the
  existing default `'manual'`. The read-only clock reports the supplied spelling.
  Expose generic `bindEffect` / `bindEffectAsync` names and matching types alongside
  the compatible Fire-named snapshot bindings. Document native GSAP property tweens
  as the primary sequencing approach, with explicit effect cleanup.
- 7696598: Add explicit `refresh()` to effect handles. Refresh hides stale output immediately,
  coalesces pending revisions, and resolves after a requested-or-newer replacement commits.
  Failures and invalidation reject pending refreshes; late frames release their resources
  without painting. Existing `ready` behavior is preserved. Custom implementations of
  `ManualEffectHandle` or `EffectHandle` must now implement `refresh(): Promise<void>`.
- c5e6eac: Add explicit `retry()` to effect handles. Concurrent requests share one teardown and
  initialization attempt, recheck admission conditions, and preserve controls and disposal
  subscriptions. Old work releases resources before recovery; disposed or disconnected
  handles cannot revive, and replacement target ownership is preserved.

  Custom implementations of `ManualEffectHandle` or `EffectHandle` must now provide
  `retry(): Promise<void>`; callers using the built-in attachment receive it automatically.

- 20ab1e6: Report unsupported initial transforms through unavailable handles and add the
  `unsupported-composition` reason for target/intermediate opacity, filters and blending.
  Check pending initialization and refresh so detected invalid composition cannot be
  revived by late work. Document the bounded detection rules and caller obligations.
- df1dfb6: Expose typed effect reason codes and diagnostic details. Reject invalid attachment inputs before registration, release unavailable ownership automatically, and clean up devices when renderer construction fails.
- dbad985: Reserve pending capture, GPU and output estimates before attachment allocations. Enforce per-target and Document budgets across concurrent initialization and refresh, reconcile actual frame sizes, and release reservations with their resources. Add the typed `target-budget` reason; budget failures preserve the original target and reject affected refresh promises.
- 9a26626: Detach GSAP bindings when their attachment is disposed. Context cleanup disposes an
  attachment only with explicit `disposeEffect: true` ownership. Add `bindFireAsync()`
  to register cleanup before a pending attachment resolves, release late results, and
  prevent tween insertion after teardown while preserving caller timelines and siblings.

  Breaking change for custom handle implementations: `ManualEffectHandle` now requires
  `onDispose(callback)`, returning an unsubscribe function and notifying once on disposal
  (immediately for an already disposed handle). Browser-created handles implement it.
  Binding an already disposed handle now rejects synchronously.
