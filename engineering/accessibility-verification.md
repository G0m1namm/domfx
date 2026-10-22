# Underlying interaction and accessibility

The original DOM remains the source of content and input. These checks cover named
fixtures and site scenarios; they do not certify a host application's accessibility
or establish universal assistive-technology support.

## Keyboard and A/AA review — 2026-10-21 UTC

The bounded [#87](https://github.com/G0m1namm/domfx/issues/87) review covers `/`,
`/effects/`, `/docs/` (redirecting to Introduction), `/docs/standalone/` and
`/docs/api/effects/frost/`. Keyboard navigation, visible scrolling, narrow layouts
and the named controls worked in the conditions below after the scoped fixes.
**This is not a full WCAG conformance claim.** Flashing thresholds remain held;
additional screen-reader, physical-device and broad engine/lifecycle checks are
excluded from this issue's narrowed completion gate, not recorded as passes.

### Findings and dispositions

| Finding                                                                                                            | Disposition and verification                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Selected category/subject borders were too faint: marketing 1.55:1 and docs 2.29:1 against the selected fill.      | **FIXED:** use DESIGN's `#8E91A8` control border; 4.58:1 against `#292A35`. The contrasting perimeter distinguishes selection without relying on text color alone. Computed-color regressions cover filters, preview subjects and docs radios.                                                                                                                                    |
| Zoomed touch previews required dragging to pan; keyboard arrows alone did not provide a pointer alternative.       | **FIXED:** four labeled 44×44 CSS-pixel pan buttons appear above 100% preview zoom. Click and Enter move the original target and decorative layer together; Fit resets. This is preview magnification, not browser zoom.                                                                                                                                                          |
| Copy commands, Fit, repository stars and artwork playback overrode visible labels with different accessible names. | **FIXED:** names contain the visible command/label, including dynamic star counts and playback states. Verified through browser-computed accessible names; no new speech run.                                                                                                                                                                                                     |
| Footer Pause froze header/artwork but automatic card/story effects kept moving, including recreated cards.         | **FIXED:** the existing footer control pauses/resumes all automatic marketing effects and applies the pause when a slot becomes ready. A real Fire output regression first establishes changing frames, then stable frames after pause/offscreen recreation, independent moving dialog output, and changing frames after Resume. Attachment lifetimes and clocks remain separate. |
| Outside-click preview dismissal was added to the issue.                                                            | **PASS:** both routes close only when a primary-button gesture starts and ends on the backdrop. Interior/control clicks and inside-to-outside or outside-to-inside gestures keep it open; Escape, close-button cleanup and trigger focus return remain available.                                                                                                                 |
| Earlier default-font and reduced-motion control failures.                                                          | **RESOLVED before this review:** [#143 / PR #153](https://github.com/G0m1namm/domfx/pull/153), `f168bb4`, and [#144 / PR #151](https://github.com/G0m1namm/domfx/pull/151), `1fc7baa`. Their original failures below remain historical observations.                                                                                                                              |

### Applicable criteria

Results are scenario dispositions under the [WCAG 2.2 A/AA quick reference](https://www.w3.org/WAI/WCAG22/quickref/),
not automatic whole-criterion passes from a clean scan.

| Criteria                                                                      | Result, method and boundary                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.1.1; 1.3.1–1.3.3                                                            | **PASS, sampled DOM/content review:** one main heading and header/main/footer per route; meaningful heading, list and table structure; labeled controls and regions; original content carries meaning. Decorative icons/artwork/canvases are excluded from reading and input. Sensory effect examples have nearby effect names; instructions do not depend solely on shape, position or color.                                                                                                                                                                                                                               |
| 1.3.4                                                                         | **PASS, bounded layouts:** no authored orientation restriction; narrow, wide and the existing short landscape preview cases retain actions. This is desktop viewport testing, not a physical-device orientation result.                                                                                                                                                                                                                                                                                                                                                                                                      |
| 1.4.1; 1.4.11                                                                 | **PASS, sampled states after fixes:** selection has a contrasting border, tabs an underline, status words accompany dots, controls have names/icons and visible focus. Selected borders measure 4.58:1; accent/silver focus indicators are visible against the adjacent dark surfaces. Decorative hairlines and disabled controls are not used as evidence of necessary control boundaries.                                                                                                                                                                                                                                  |
| 1.4.3                                                                         | **PASS, sampled solid text:** computed foreground/background checks, including alpha-composed solid ancestors, found a minimum 6.68:1 among the sampled enabled text runs. Code, muted labels and silver-button text were included. **UNTESTED:** exhaustive gradient/pseudo-element and animated-canvas pixel contrast across every effect/time/intensity; solid-background calculations do not establish those results.                                                                                                                                                                                                    |
| 1.4.4                                                                         | **PASS, bounded resizing:** actual Chromium profile defaults of 16/24/32px exercise body, control and code growth plus preview/navigation containment in the existing regression. Native 200% page zoom is reused only from [PR #153](https://github.com/G0m1namm/domfx/pull/153) on `f168bb4`; this review did not change native zoom. Text-only browser zoom remains untested.                                                                                                                                                                                                                                             |
| 1.4.10; 1.4.12                                                                | **PASS, sampled reflow/spacing:** all five routes at 320/360/768/1440 CSS px fit without page-wide horizontal overflow. Overrides use line-height 1.5, paragraph spacing 2em, letter spacing .12em and word spacing .16em. Search/preview and docs navigation, labs, code and tables remain available; intrinsically wide code/tables scroll within their own regions. Changed pan controls were also inspected with spacing overrides at 320/700/1000px; the longer footer playback label fits at 320px with actual 16/32px font preferences. A 320px viewport is the reduced-viewport reflow method, not native 400% zoom. |
| 1.4.13                                                                        | **PASS, reviewed interactions:** native title tooltips are browser-controlled; authored card illumination adds no content. Preview hover magnifies the existing subject, ends on pointer exit, and has explicit zoom/Fit alternatives; Escape closes the preview. No hover-only action is required.                                                                                                                                                                                                                                                                                                                          |
| 2.1.1–2.1.2; 2.1.4; 2.4.1; 2.4.3; 2.4.7; 2.4.11                               | **PASS, bounded keyboard review:** forward/reverse Tab, skip navigation, Enter/Space, subject radios and range arrows, tabs, search arrows/Enter/Escape, preview zoom/pan, drawer Escape and trigger return. Focused centers were visible/unobscured in the route traversal; large scrolling regions need not have their entire outline onscreen. Native modal focus containment has an Escape exit. Character zoom/pan keys act only on the focused preview; global search requires Cmd/Ctrl. No complete installed-Safari keyboard pass is inferred.                                                                       |
| 2.4.2; 2.4.4–2.4.6; 3.1.1; 3.2.1–3.2.4; 3.2.6                                 | **PASS, sampled navigation/content:** descriptive page titles, English document language, named links/headings, consistent header/footer/docs navigation and docs feedback order, and links plus search to find pages. Focus/input changes do not unexpectedly navigate; activating a result/link does.                                                                                                                                                                                                                                                                                                                      |
| 2.2.2; project reduced motion                                                 | **PASS, named controls after page-pause fix:** automatic marketing effects have a persistent Pause/Resume choice; dialogs/labs have separate playback controls. Existing recovery tests establish stopped output under reduced motion and explicit restart afterward. Controlled WebGPU absence retains original content and understandable disabled/status states; it is not a physical GPU-loss result.                                                                                                                                                                                                                    |
| 2.5.1–2.5.3; 2.5.7–2.5.8                                                      | **PASS, sampled pointer/name review after fixes:** no multipoint/path gesture is required; sliders accept track clicks and previews offer zoom/pan/Fit buttons. Activation occurs on release/click and backdrop cancellation is covered. New pan controls are 44×44; other sampled controls meet the 24px minimum or spacing exception, and inline prose links use the inline exception. This does not establish physical touch behavior.                                                                                                                                                                                    |
| 3.3.2; 4.1.2–4.1.3                                                            | **PASS, DOM/control checks:** input labels, group names, selected/pressed/expanded states, values and disabled states are exposed. Copy success/failure, search counts/failure and lab availability use text/status/live regions. Actual announcement timing is not inferred; the dated speech evidence below retains its own scope.                                                                                                                                                                                                                                                                                         |
| 2.3.1                                                                         | **UNTESTED / HELD:** no formal temporal luminance, red-flash, area or frequency assessment was performed across the effects. Appearance, Pause and reduced-motion support do not establish a flashing-threshold pass.                                                                                                                                                                                                                                                                                                                                                                                                        |
| 1.2.1–1.2.5; 1.3.5; 1.4.2; 2.2.1; 2.5.4; 3.1.2; 3.3.1/3.3.3–3.3.4/3.3.7–3.3.8 | **NOT APPLICABLE to these surfaces:** no audio/video media, personal-data input, authored time limit, motion-actuation control, language passage needing a different language tag, submitted validation/legal/financial transaction, redundant data entry or authentication. Search no-match/network and clipboard failure messages were still reviewed.                                                                                                                                                                                                                                                                     |
| 1.4.5                                                                         | **NOT APPLICABLE beyond exemptions:** informational prose/code remains text; logos and sensory effect specimens are not replacements for ordinary text content.                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

### Source, methods and reuse

Reviewed baseline: `63599d0ace42fe291339f8df89f690373d0f1eec`, plus this review's
scoped UI fixes. Final UI source SHA-256: `b7f72443fe9f42166ca2169ff7be4b6c8b3a8941b0a3f18e193c54c2b05de18a`;
composed production build SHA-256: `81352993ca44b7fdee46d7cbed7104c5dcff0790428db5512f8ccd3eeb05ac26`;
lockfile SHA-256: `0fbf0fdbe9db80994088f9123380e1c0ed3158f60f810a702fabee2577a62514`.
UI/build digests hash compact JSON mapping sorted relative file paths to content
SHA-256 values; UI paths are tracked files under `apps/web/src`, `apps/docs/src`
and `packages/site/src`, and build paths are under `apps/web/dist`.

New checks used Playwright 1.63.0 bundled Chromium **153.0.8010.12**, headless on
macOS **26.6.2 (25G83)**, arm64 / Apple M5 Pro, 24 GB RAM; Node 22.22.3,
pnpm 11.5.0. Route probes used DPR 1, 100% default page zoom, visible pages,
320/360/768/1440×900 CSS px and reduced motion emulated on to inspect stable
content. Baseline route/spacing probes ran on `63599d0`; changed-control regressions and visual checks ran on the UI/build digests above. Focus/scroll probes recorded actual key events and scroll offsets:
standalone code, Frost usage and its options table each moved horizontally by
40px with ArrowRight while focused and visible. Search arrows traversed actual
results; drawer Escape restored the invoker. These are browser automation results,
not installed-browser manual, spoken-output or physical-device observations.

To reproduce, run `pnpm agent:verify`, `pnpm test:web` and `pnpm test:docs`.
The focused regressions are in `apps/web/browser-tests/accessibility.spec.ts`;
the existing smoke suite uses fresh browser profiles for actual font preferences.
For gap checks, build/serve the composed site, apply the spacing values above,
walk both Tab directions, open/close search/preview/drawer, and focus code/table
regions before pressing horizontal arrows. Inspect both controls and text; a
page-width measurement alone cannot prove usable reflow.

Earlier source-specific navigation, no-JavaScript, reduced-motion, unavailable-output,
speech and lifecycle observations below are reused only for their stated scenarios.
The #141/#142 lifecycle cohorts and #153 font/zoom cohort were not repeated as a
new broad matrix. Final verification: website **85 passed / 3 expected metadata skips** (development and production); docs **30 passed** (production).

## Current-site observations — 2026-10-20 UTC

This source-specific cohort is historical; later fixes and the bounded review are
recorded above.

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

### Historical defects and broader coverage limits

- [#143](https://github.com/G0m1namm/domfx/issues/143): the historical default-font failure was resolved by PR #153 (`f168bb4`).
- [#144](https://github.com/G0m1namm/domfx/issues/144): the historical reduced-motion control failure was resolved by PR #151 (`1fc7baa`); unrelated later passes were not the resolution evidence.
- **Untested in installed Safari:** complete native keyboard order, visible foreground code/table scrolling,
  complete zoomed lab usability, Safari public-API refresh/disposal/reattachment,
  AT history, other browser/screen-reader pairings, braille, switch and voice control.
- **Unavailable in this cohort:** physical mobile and a second OS/GPU. Real-device
  access is needed for touch, pan and selection checks; desktop emulation is insufficient.
- **Held:** Linux/SwiftShader; see the [support limits](browser-support.md#missing-coverage).

These broader environment/AT gaps remain coverage limits, outside #87's narrowed
remaining review. The current review's explicit holds are listed above.

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
