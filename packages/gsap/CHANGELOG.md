# @domfx/gsap

## 0.1.0-alpha.1

### Patch Changes

- Update the package guides to describe the published alpha and link to npm installation instructions.
- Updated dependencies
  - @domfx/core@0.1.0-alpha.1

## 0.1.0-alpha.0

### Minor Changes

- b31832a: Prepare the first experimental alpha of domfx. Add decorative Fire to real DOM
  silhouettes using a standalone attachment or a caller-owned GSAP timeline.
  Preserve native content/interaction, respect reduced motion and explicitly dispose
  attachments and bindings. Browser, placement and capture support remains limited
  to the documented experimental contract; consult support and migration guidance.

### Patch Changes

- c74bc3a: Add `clock: 'auto'` for automatic animation while preserving `'ambient'` and the
  existing default `'manual'`. The read-only clock reports the supplied spelling.
  Expose generic `bindEffect` / `bindEffectAsync` names and matching types alongside
  the compatible Fire-named snapshot bindings. Document native GSAP property tweens
  as the primary sequencing approach, with explicit effect cleanup.
- 19f9eec: Add the optional GSAP binding for manual attachments. Caller-owned timelines
  drive absolute time and intensity through the attachment scheduler, including seek
  and reverse. Disposing a binding removes only its owned tween. Ambient clocks reject;
  standalone core and browser consumers do not acquire a GSAP dependency.
- 9a26626: Detach GSAP bindings when their attachment is disposed. Context cleanup disposes an
  attachment only with explicit `disposeEffect: true` ownership. Add `bindFireAsync()`
  to register cleanup before a pending attachment resolves, release late results, and
  prevent tween insertion after teardown while preserving caller timelines and siblings.

  Breaking change for custom handle implementations: `ManualEffectHandle` now requires
  `onDispose(callback)`, returning an unsubscribe function and notifying once on disposal
  (immediately for an already disposed handle). Browser-created handles implement it.
  Binding an already disposed handle now rejects synchronously.

- Updated dependencies [3465eec]
- Updated dependencies [c74bc3a]
- Updated dependencies [7696598]
- Updated dependencies [c5e6eac]
- Updated dependencies [20ab1e6]
- Updated dependencies [7ba013e]
- Updated dependencies [df1dfb6]
- Updated dependencies [b31832a]
- Updated dependencies [75a374c]
- Updated dependencies [dbad985]
- Updated dependencies [9a26626]
  - @domfx/core@0.1.0-alpha.0
