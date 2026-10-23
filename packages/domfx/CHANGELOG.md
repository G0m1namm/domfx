# @domfx/browser

## 0.1.0-alpha.1

### Patch Changes

- 79e6d2b: Reduce repeated asset work during effect recapture. Skip fonts for shapes and images, reuse validated unchanged fonts, and retain fresh raster data within a bounded HTTP-aware cache. Preserve changed content and image reloads. Fix temporary image cleanup that retained detached fallback nodes in Chromium.

  Index font declarations once per capture and stop reuse discovery when a stylesheet requires fresh validation, avoiding repeated font matching without retaining stale styles.

- Updated dependencies
  - @domfx/core@0.1.0-alpha.1

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
- 9ec9ea5: Render soft, curling warm flames with a bright base and sparse rising embers.
  Add an optional `flameHeight` (8–64 target-local CSS pixels, default 24), reserving
  capture padding automatically within existing resource budgets. Preserve absolute
  time/seed determinism, reduced-motion behavior and the default 32-pixel padding.
- 75a374c: Expose a one-target manual fire attachment with readable time/intensity controls,
  immutable seed, lifecycle and raster health, and idempotent disposal including
  pending initialization. Keep the original target usable and own the decorative
  canvas inside an explicit positioned host.

### Patch Changes

- b31832a: Explain unsupported CSS in reasonDetail with the affected element, computed property and value, and a suggested correction. Typed reasons and lifecycle behavior are unchanged.
- 3465eec: Add explicit manual/ambient attachment clock modes and ambient pause/resume controls.
  Batch parameter writes into one render commit per dirty target per animation frame
  through a shared document scheduler, reusing captured rasters. Manual remains the
  default.

  Breaking change: control writes update readable values immediately but no longer
  render synchronously. Await the next animation frame before reading rendered output.

- 46d7396: Release the SDF executor's offset uniform with its prepared frame, preventing allocation growth across repeated preparations. Bundle the pinned, patched executor so packed consumers receive the same cleanup, and account for its observed 4-byte uniform in the frame ledger.
- c74bc3a: Add `clock: 'auto'` for automatic animation while preserving `'ambient'` and the
  existing default `'manual'`. The read-only clock reports the supplied spelling.
  Expose generic `bindEffect` / `bindEffectAsync` names and matching types alongside
  the compatible Fire-named snapshot bindings. Document native GSAP property tweens
  as the primary sequencing approach, with explicit effect cleanup.
- c74bc3a: Share compatible effect bindings and shader primitives without changing visual output.
  Report effect-labelled WGSL initialization errors, add bounded opt-in experimental
  diagnostics, and give shared attachment options neutral ownership while preserving
  existing named option types.
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
- 54f7e9d: Keep effect contours aligned on responsive targets by freezing the capture root's measured size when rendering its clone in a different containing block.
- 4272483: Use Floating UI for effect placement while retaining capture padding, clipping and positive axis-aligned scale. Position updates share the document scheduler, preserve paused/manual output, and ignore obsolete asynchronous coordinates after refresh, suspension or disposal. Initial output waits for valid hidden-layer geometry before presentation.
- 3bcf817: Keep manual and paused effect layers aligned through fractional layout shifts and positive axis-aligned target or ancestor scaling. Track placement using the shared Document scheduler without advancing time, recapturing, or redrawing unchanged output. Root transform-only inline style changes preserve fresh captured paint; descendant transforms and paint changes still require explicit refresh.
- a2d8fd9: Automatically refresh observed target size, paint, image and font changes using coalesced, generation-safe captures. Preserve placement-only raster reuse, cancel queued observation on disposal, and report capture failures without retries. Document explicit-refresh limits and reject source-mutating capture styles before they can create feedback loops.
- 66d1737: Refine GPU signed distances around disconnected overflow paint to satisfy the full-raster DPR 1/2 capture gate. Reuse existing GPU allocations and preserve alpha classification and target-local mapping. Document the verified padding and paint limits.
- dbad985: Reserve pending capture, GPU and output estimates before attachment allocations. Enforce per-target and Document budgets across concurrent initialization and refresh, reconcile actual frame sizes, and release reservations with their resources. Add the typed `target-budget` reason; budget failures preserve the original target and reject affected refresh promises.
- 4272483: Keep captured paint aligned with its target in Safari by applying exterior padding through HTML layout instead of an SVG viewport offset.
- 35ae9c9: Retire shared renderers immediately on device loss, invalidate all affected attachments
  and pending refreshes, and prevent queued or late GPU preparation from resuming work.
  Keep pending reservations until late cleanup finishes without disturbing a replacement
  service or unrelated page animation. No automatic device recreation is introduced.
- 92f274c: Suspend rendering and placement for hidden or offscreen targets. Freeze ambient time without catch-up, retain manual and paused time, and synchronize geometry before showing fresh output on re-entry. Invalidate pending refreshes on visibility loss and disconnect owned visibility observers on cleanup.
- 658bd51: Align decorative layers through bordered hosts and nested rectangular overflow clips
  while scrolling in manual or paused mode, reusing captured and rendered pixels. Reject
  unsupported clipping between target and host and document the host insertion constraints.
- 529a66e: Avoid capture, canvas and GPU allocation for initial reduced motion. Live reduced-motion
  changes release output and invalidate pending work without automatically restarting when
  the preference changes back. Add `motion: 'static'` for deterministic time-zero decoration
  with no ambient animation.
- 05a5f96: Wait for capture fonts and images, embed validated raster assets, and reject missing or unsupported paint with typed CaptureError diagnostics. Asset and font changes invalidate existing output; the observed-refresh policy controls recapture.
- ec9cac3: Share one GPU renderer service per Document across fire attachments. Targets retain
  independent canvases, rasters and controls, including when sharing a host. Deduplicate
  concurrent initialization, serialize GPU preparation, and release the service after the
  last attachment and its pending work finish cleanup.
- 5225781: Keep internal renderer declarations out of the browser root attachment API so strict
  TypeScript consumers do not need WebGPU ambient types. Preserve the existing public
  signatures and verify packed Node imports, declarations and dependency/export boundaries.
- ea21452: Permanently dispose attachments when their target or an ancestor is removed, including while suspended or waiting for capture/preparation. Reinsertion requires a new attachment; pending work releases resources without presenting. Verify zero-size suspension and exactly one fresh capture on visible nonzero recovery, including repeated transitions and late results.
- df819c0: Classify attachment failures by internal typed codes so diagnostic wording and lookalike external errors cannot change public reasons. Preserve stage fallbacks, refresh rejection values, and capture/GPU diagnostic causes.
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
