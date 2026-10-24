---
name: domfx
description: Add or troubleshoot domfx effects in an application, including effect choice, automatic animation, GSAP sequences, teardown, capture refresh and unavailable output. Use for consuming @domfx/browser and the optional @domfx/gsap helpers, not for developing domfx internals.
license: MIT
---

# domfx

Decorate a live element while keeping its original content, focus and interaction.
Write explanations and code comments in the user's language; keep API names unchanged.

## Check the installed contract

Inspect the app's manifest, lockfile and installed versions of `@domfx/browser`,
`@domfx/core` and, when used, `gsap` and `@domfx/gsap` before choosing APIs.
The published quickstart currently pins `0.1.0-alpha.1`; this repository also
documents additive relative options awaiting release. Check the installed public
declarations and matching documentation before using those options;
explain a mismatch rather than inventing exports or upgrading dependencies silently.

For a new installation, use the exact package versions in the public
[installation guide](https://domfx.dev/docs/installation/).
Import from `@domfx/browser`; the published build already includes its shader transform.
No repository checkout, private imports or consumer TypeGPU plugin is needed.

Choose an attachment from the [effect catalog](https://domfx.dev/docs/api/effects/).
`attachFire`, `attachFrost` and `attachDither` share controls, but effect-specific
options differ: remove the previous effect's geometry options when switching effects.
Read that effect's public options instead of deriving an export name from its label.

## Choose strength and extent

When installed declarations expose relative options, choose the effect-owned fields:

| Effect                          | Creation options and reference dimension                                    |
| ------------------------------- | --------------------------------------------------------------------------- |
| Fire                            | `flameReach`: physical height; mutually exclusive with legacy `flameHeight` |
| Frost                           | `coatingDepth`: shorter side; `mistReach`: height                           |
| Slime                           | `coatingDepth`: shorter side; `dripReach`: height                           |
| Burned paper                    | `scorchDepth`: shorter side; `ashReach`: height                             |
| Electricity                     | `contourSpread`: shorter side                                               |
| Kinetic bloom                   | `fragmentTravel`: shorter side                                              |
| Dither and shared-flow patterns | `plumeReach`: height; `bandDepth`: shorter side                             |
| Contour echoes                  | `echoReach`: shorter side                                                   |
| Brush fringe                    | `fringeReach`: shorter side                                                 |

Slime also accepts creation-only `dripDensity` (0–1, default 0.56): the fraction
of candidate drip locations, independent of size, travel and timing. Zero disables
drips; one enables all eligible locations. It works in legacy and relative modes
and does not opt into relative geometry by itself.

These are finite nonnegative numeric fractions of the untransformed target border
box, excluding capture padding; transparent image margins count. `0.1` means 10%,
not 10 pixels. Resolve again after resize. All omitted retains legacy behavior;
with paired options, supplying either enables relative mode and the missing partner
is zero. All-zero extents produce transparent output.

In relative mode, `intensity` scales final premultiplied strength without changing
configured geometry or local fine detail. Animate intensity normally, including
with GSAP. Extents are creation-only: dispose and recreate to change them; there
are no geometry setters. Reach is an envelope, not a guaranteed visible tip, and
fixed marks can extend beyond their sampling envelope within reserved support.

Relative capture requires contained descendant boxes and paint inside the border
box plus 2 CSS pixels, without shadows, filters, outlines or generated pseudo-elements.
Existing pixel/memory/device limits still apply; oversized support is unavailable,
never silently clipped or downsampled. Use the matching per-effect reference for
exact support limits. If the installed release lacks these fields, use its legacy
options and explain the version requirement instead of claiming npm support.

## Attach and own the lifetime

Use the complete [standalone walkthrough](https://domfx.dev/docs/standalone/)
with the [HTML setup](https://domfx.dev/docs/installation/#provide-the-target-and-host).
For Spanish requests, link the equivalent guides under `https://domfx.dev/docs/es/`.

- The target is the element whose visible shape receives the effect. The effect
  container is `host`: a separate, positioned HTML element (`position: relative`
  is sufficient). Both must be connected to the same document, with the target a
  **strict descendant** of the host. Leave room for the decoration.
- Keep the original DOM visible and interactive. The canvas is decoration, not a
  replacement, screenshot UI or accessibility tree. Fade the host to fade both
  together; target/intermediate opacity, filters and blending have composition limits.
- One effect owns a target tree: another attachment on that target, an ancestor or
  a descendant conflicts. Dispose the existing effect before replacing it.
- Register cleanup synchronously on component unmount **before any await**, including
  `document.fonts.ready`, imports or other setup waits. A `pagehide` listener alone
  does not handle component unmount. Keep a disposed flag and check it after waits,
  before creating effects or starting animations. If an async operation returns an
  effect after teardown, dispose that late result immediately.
- Cleanup stops owned animations, unsubscribes owned listeners and calls
  `effect.dispose()`, including while `effect.ready` is pending. On remount, use
  fresh elements, state and an effect; disposal is terminal and safe to repeat.

## Choose the time owner

For automatic animation, pass `clock: 'auto'` and `motion: 'respect'`.
Use `pause()` and `resume()`; resuming does not catch up hidden or paused time.

For seeking or GSAP, pass `clock: 'manual'` at attachment. Write `effect.time`
in absolute seconds, forward or backward; `resume()` does not advance manual time.
Manual `paused` stays true even while setters change. Use one driver per property.
Time and intensity must be finite and float32-representable; accepted intensity clamps to 0–1.
Control writes are batched for the next frame and do not recapture the target.

For a caller-owned GSAP sequence, read [GSAP ownership](references/gsap.md).
Native property tweens are the ordinary path; snapshot helpers are optional.

## Refresh or recover

`ready` resolves when an initialization attempt finishes, including unavailability;
it does not prove visible output. Inspect `lifecycle`, `raster`, `reason` and
`reasonDetail`. Use the reason code for branching and the detail for diagnostics.

After changing captured paint, await `refresh()`. It hides stale output and resolves
when this or a newer requested capture is accepted; it can reject. Observed target
mutations and resize can refresh automatically. Unobserved stylesheet, ancestor,
hover/focus or canvas paint changes need explicit refresh.

For an unavailable effect, correct the condition, then explicitly await `retry()`
and inspect state again. Retry retains controls and bindings; it is not an automatic
loop and cannot repair invalid shaders. Refresh cannot recover an unavailable effect.
Retry rejects after disposal; create a new effect on remount.

For missing, stale or misplaced output, read [diagnosis](references/diagnosis.md).
Check original interaction, early teardown/remount and the requested animation in
the consumer app. A successful build does not establish visible GPU output or broad
browser support; report what was actually observed.
