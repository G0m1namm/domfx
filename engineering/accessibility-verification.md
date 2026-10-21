# Underlying interaction and accessibility

The original DOM remains the source of content and input. These checks cover named
fixtures and site scenarios; they do not certify a host application's accessibility
or establish universal assistive-technology support.

## Current-site observations — 2026-10-20 UTC

Verified October 20–21 for [#87](https://github.com/G0m1namm/domfx/issues/87) on
runtime [fcf7532](https://github.com/G0m1namm/domfx/commit/fcf753206814a77d16f3709e3eacd13165c765ea).
The [browser support record](browser-support.md#current-site-verification--2026-10-20-utc)
identifies the environment and automated results. All passes below apply only to
the named scenario.

### Original content, zoom and lifecycle

| Scenario                                  | Result                                                                                                                                                                                                              | Limit                                                                                                                                                               |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Original text under an active Fire effect | **PASS:** native pointer selection in installed Chrome 155 selected and visibly highlighted the standalone lab's original `domfx` text.                                                                             | Native 100% zoom, 1672×947 CSS px, DPR 2, visible, reduced motion off. Touch selection was not tested.                                                              |
| Chrome native 200% zoom                   | **PASS, sampled controls/reflow:** gallery preview and docs controls remained reachable; closing the preview returned focus to Try Frost. The Image target's capture-budget fallback retained its original content. | 836×473 CSS px, DPR 4. This does not establish complete native keyboard order.                                                                                      |
| Larger browser default fonts              | **FAIL:** roots changed from 16px to 24px, but sampled body paragraphs retained fixed sizes. Sampled layouts and controls fit at 360/768/1440×900, DPR 2.                                                           | Reflow is not text resizing. [#143](https://github.com/G0m1namm/domfx/issues/143) tracks the defect.                                                                |
| Chrome docs tab hide/return               | **PASS:** three browser-generated cycles on each of the standalone and Frost labs; trusted hidden/visible events, zero canvases while hidden, active output on return and explicit pause preserved.                 | Fresh default profile over CDP, 1200×863 CSS px, DPR 2, motion off. This does not measure internal GPU-resource release or OS minimization.                         |
| Safari native Frost preview               | **PASS, sampled UI:** visible Frost edges on Text/SVG/Image, intensity, Pause/Resume, preview zoom, reference link and Escape focus return.                                                                         | Safari 26.6.2; viewport/DPR, adapter, motion and visibility were unmeasured in this scenario. Full placement and lifecycle coverage remains open.                   |
| Safari native 200% docs zoom              | **PASS, sampled navigation:** docs drawer, table of contents, search/results and search focus return were usable.                                                                                                   | Complete zoomed lab usability and foreground code/table scrolling remain untested.                                                                                  |
| Safari paused minimize/restore            | **PASS:** after explicitly pausing Fire, minimizing and restoring its window retained the paused UI; VoiceOver read “Resume effect selected toggle button”.                                                         | Visibility events, canvas cleanup and internal resource release were not measured.                                                                                  |
| Safari BFCache return                     | **PASS, recovery after explicit Start:** standalone → GSAP → native Back reported trusted `pageshow.persisted: true`; Start produced Live/Pause effect.                                                             | Instrumented build, native 200%, 662×444 CSS px, DPR 4, motion off; trusted visible transition observed. Paused-state preservation and AT history were not tested.  |
| Safari native horizontal scrolling        | Scroll offsets increased for an API table and code block with VoiceOver off at native 200%, 432×471 CSS px, DPR 4.                                                                                                  | Both measurements reported `hidden`. **Visible foreground and VoiceOver scrolling remain untested**; no application failure is assigned from inconclusive attempts. |

### VoiceOver with Safari — 2026-10-21 UTC

**VoiceOver 10 / Safari 26.6.2 / macOS 26.6.2.** Automated VoiceOver navigation
read the actual last spoken phrase separately from cursor text. These are observed
speech results, not a human listening audit or deductions from an accessibility tree.
Viewport/DPR, adapter, motion and visibility were unmeasured for the initial reading
checks; the instrumented cases below record their own conditions.

| Scenario                            | Observed result                                                                                                                                                                                                                                                                                                                                             |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Home reading and gallery            | **PASS, sampled sequence:** headings, links and five Try buttons were spoken. Filters announced their selected state; the heading rotor reached Effects. No decorative-canvas stop appeared in the sampled card sequence.                                                                                                                                   |
| Frost preview                       | **PASS:** dialog announcement, Text/SVG/Image selected states, intensity 70→71, Pause/Resume and Escape returning the VO cursor to Try Frost. Image selection also announced “Live preview · WebGPU”.                                                                                                                                                       |
| Shared search                       | **PASS, reading/navigation:** the dialog, field, ten results and result links were read; Escape returned to the trigger. Automatic result-count announcement was not established.                                                                                                                                                                           |
| Standalone Fire and Frost docs labs | **PASS:** subject selected states, intensity 80→81, preparing/live/paused status and Pause/Resume were spoken. Original Frost `domfx` text was read once without a decorative-canvas stop in that sequence.                                                                                                                                                 |
| Frost API table                     | **PASS:** “3 columns, 7 rows”, column headings and host-row position were spoken.                                                                                                                                                                                                                                                                           |
| Native 200% docs navigation         | **PASS, sampled sequence:** Docs expanded state, navigation links, table of contents and heading links were spoken.                                                                                                                                                                                                                                         |
| Drawer Escape focus return          | **PASS:** keyboard focus moved from Docs into the drawer; Escape returned to Docs and spoke “Docs collapsed button”. Moving the VO cursor to keyboard focus confirmed the invoker. Instrumented build, native 200%, 662×444 CSS px, DPR 4, visible, motion off. Full drawer focus order remains untested.                                                   |
| Native reduced motion and recovery  | **PASS:** the macOS preference produced “Reduced motion keeps this preview still.” and a disabled playback control in both labs. Turning it off left the preview stopped and announced “Choose Start effect to restart this preview.” Explicit Start spoke “Live”. No media emulation was used.                                                             |
| Controlled WebGPU unavailability    | **PASS:** with `navigator.gpu` masked before startup, original Frost text remained readable; speech included “Effects are unavailable in this browser. The original content stays visible.” and the disabled control. Instrumented build, native 100%, 1324×888 CSS px, DPR 2, visible, motion off. This is injected API absence, not physical GPU failure. |

The instrumented cases used the same built application with a separate nonfocusable
diagnostic panel. It recorded viewport/DPR, motion, visibility, trusted events and
scroll offsets without cancelling input. The panel was excluded from application
reading/focus judgments. GPU API presence was recorded, not adapter identity.

### Known failures and remaining checks

- [#143](https://github.com/G0m1namm/domfx/issues/143): body text ignores larger browser default fonts.
- [#144](https://github.com/G0m1namm/domfx/issues/144): an intermittent bundled-Chromium development check left the artwork playback control enabled under reduced motion despite zero canvases. Later passes do not resolve it.
- **Untested:** complete native keyboard order, visible foreground code/table scrolling,
  complete zoomed lab usability, Safari public-API refresh/disposal/reattachment,
  AT history, other browser/screen-reader pairings, braille, switch and voice control.
- **Unavailable in this cohort:** physical mobile and a second OS/GPU. Real-device
  access is needed for touch, pan and selection checks; desktop emulation is insufficient.
- **Held:** Linux/SwiftShader; see the [support limits](browser-support.md#missing-coverage).

[#87](https://github.com/G0m1namm/domfx/issues/87) remains open for these gaps.

## Verify the current site

Build with `pnpm build:web` and serve with `pnpm preview:web`. Record source/build,
OS, browser/AT versions, viewport/DPR, native zoom, motion preference and visibility.
Assign results per scenario, leaving unmeasured conditions explicit.

1. On `/` and `/effects/`, read headings, links and filters. Open a preview; change
   Text/SVG/Image, intensity and Pause/Resume; close and check focus return.
   Confirm decorative canvases add no duplicate reading or focus stop.
2. On `/docs/standalone/` and `/docs/api/effects/frost/`, check navigation, drawer
   focus/Escape, table of contents, code/table scrolling, search and live-lab controls.
3. Change the native reduced-motion preference; read the stopped status, turn it
   off and verify explicit Start/Resume recovery. For unavailable output, mask
   `navigator.gpu` before startup and record this as injected API absence.
4. Check native tab hide/return, paused minimize/restore and history restoration.
   Observe `pageshow.persisted` before claiming BFCache. Use rendered examples or
   the fixture below for public refresh/disposal/reattachment operations.
5. Check native 200% zoom, larger browser default fonts and narrow reflow under the
   [UI conventions](ui-conventions.md). Preview zoom is a separate feature.

For AT checks, record actual spoken or captioned announcements. The October 21
method used VoiceOver's AppleScript interface to read `content of last phrase`;
`text under cursor of vo cursor` alone is not speech evidence. Native VoiceOver
navigation with observed audio or captions can also verify these scenarios.

## Reproduce

Run `pnpm --filter @domfx/gpu-tests exec vite --host 127.0.0.1` and open
`/accessibility.html`; build with `pnpm build:gpu`, then use `vite preview` for production. The page starts with **no attachment**. A
single composite target contains a button with both an `onclick` handler and an
event listener, a described button, a native link, a labeled input and selectable
text. Before/after buttons bracket its natural tab order. The effect uses the
public `attachFire` and `bindFire` exports, real capture and WebGPU.

1. Start at **Before target**. Tab through Activate original → Original link →
   Original input → After target, then reverse with Shift+Tab. Check visible focus.
2. Activate the button with pointer, Enter and Space. Both counters must advance
   once per activation. Open the link with pointer and Enter; edit and select text
   in the input. Drag across “Select this original text.”
3. Choose **Attach effect** and repeat. Inspect the browser accessibility tree:
   the original names, roles and button description remain; the canvas has no
   accessible content or tab stop.
4. Repeat after **Revert borrowed context** (effect remains active), **Revert owned
   context** (effect is disposed), and explicit **Dispose effect**. Reload/attach
   between independent cases.
5. With an active attachment, emulate `prefers-reduced-motion: reduce` in browser
   developer tools and repeat. The state must become suspended and the layer must
   disappear. The automated unavailable case removes `navigator.gpu` before page
   startup; it is controlled missing-capability input, not a physical GPU failure.

## Automated evidence

`pnpm test:gpu:full` includes
[`accessibility.spec.ts`](../tests/gpu/browser-tests/accessibility.spec.ts) in both
development and production. A focused run against current builds is:

```sh
pnpm --filter @domfx/gpu-tests exec playwright test accessibility.spec.ts
```

Each of five lifecycle cases first records its own no-effect baseline, repeats
under an active layer (except initial unavailability), and repeats after the
transition. Assertions cover native pointer/keyboard activation, link navigation,
forward/reverse Tab order, retained focus through transitions, input editing and
keyboard selection, pointer-drag selection anchored in the original text nodes,
accessible snapshots, unique accessible controls, the button description, original
element/handler identity, and unchanged target markup. Empty `style=""` attributes
left on form controls by capture are ignored; nonempty styles and all other
attributes/content are compared. Focus outline styles must match the baseline.

Active canvases must be visible, outside the target subtree, `aria-hidden="true"`,
pointer-transparent, empty and outside the tab order. Lifecycle assertions prevent
an unavailable renderer from passing an active-overlay test. Existing website,
manual and GSAP tests continue to verify their real GPU output and interactions;
this fixture adds the baseline and lifecycle comparisons without replacing them.

The fixture report records browser, viewport, DPR, visibility, motion preference,
adapter and lifecycle state. Its accessibility snapshots describe browser semantics;
actual screen-reader speech is recorded separately above.

## Recorded manual observations — 2026-09-15

The original [#28](https://github.com/G0m1namm/domfx/issues/28) fixture audit used
visible Chrome on macOS. Keyboard activation, visible focus, original text selection
and retained input after borrowed/owned GSAP context reversion were observed. The
native accessibility tree contained original controls without duplicated canvas
content. Actual screen-reader speech was not tested in that audit.

Earlier October checks used retired website layouts. Their source-specific results
remain in [#101](https://github.com/G0m1namm/domfx/pull/101),
[#107](https://github.com/G0m1namm/domfx/pull/107) and
[#110](https://github.com/G0m1namm/domfx/pull/110); they are not current-site passes.
