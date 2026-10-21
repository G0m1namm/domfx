# Browser and device support record

The packages remain experimental. A pass applies to the named scenario, environment
and source revision; it establishes neither a minimum browser version nor support
for an entire browser family. The original DOM must remain usable when an effect is
unavailable. [Release gates](../RELEASING.md#held-publication-approval)
remain in force.

## Keyboard and A/AA review — 2026-10-21 UTC

The [bounded accessibility review](accessibility-verification.md#keyboard-and-aaa-review--2026-10-21-utc)
records current keyboard/focus, visible code/table scrolling, contrast, resize/reflow,
pointer alternatives and playback findings on the five #87 routes. It fixes selected
state boundaries, label/name mismatches, drag-only panning and the automatic-effects
pause gap, and verifies outside-click preview dismissal. Source/build identities,
methods and explicit holds are in that record. New observations use bundled
Playwright Chromium, not a new installed-Safari or screen-reader cohort; no full
WCAG conformance or additional browser support is claimed.

The earlier #143 default-font and #144 playback-control defects were resolved by
[PR #153](https://github.com/G0m1namm/domfx/pull/153) (`f168bb4`) and
[PR #151](https://github.com/G0m1namm/domfx/pull/151) (`1fc7baa`). Their failures in
the October 20 cohort below remain historical results. Missing devices/engines and
Linux/SwiftShader holds remain unchanged; they are outside #87's narrowed review.

## Native Safari placement — 2026-10-21 UTC

**PASS:** Fire output on text, SVG and image targets stayed aligned through nested
scrolling, positive axis-aligned scale/translation, paused movement, refresh and
disposal/reattachment. All five steps passed at both native zoom levels; movement
kept the capture count at three, refresh raised it to six and reattachment to nine.
Disposal removed every effect canvas.

Environment: installed Safari **26.6.2 (21624.5.1.11.3)**, WebKit UA **605.1.15**,
macOS **26.6.2 (25G83)**, Apple M5 Pro. Both runs remained visible, with reduced
motion off and visual viewport scale 1. A separate default-adapter query returned
`apple` for vendor, architecture, device and description; renderer-device identity
was not measured.

| Native page zoom | CSS viewport | DPR | Maximum geometry error, physical pixels |
| ---------------- | ------------ | --: | --------------------------------------: |
| 100%             | 1324×851     |   2 |                                 0.02969 |
| 200%             | 662×425      |   4 |                                 0.02970 |

Paint was visually inspected and explicitly confirmed at every step. Geometry,
paused time, active/fresh state, capture counts and cleanup were checked by the
fixture. Canvas snapshots returned transparent pixels despite visible output in
this Safari run; automated canvas pixel readback remains unqualified here.

Source: [b84d118](https://github.com/G0m1namm/domfx/commit/b84d118), with unchanged
browser runtime from [3bd6ebb](https://github.com/G0m1namm/domfx/commit/3bd6ebb).
GPU fixture build SHA-256: `00fecafbf8fd19510b0f138fec140ad8fda3b738abe965ad4ad0bc3c5931eb57`;
lockfile SHA-256: `0fbf0fdbe9db80994088f9123380e1c0ed3158f60f810a702fabee2577a62514`.
The build digest hashes compact JSON mapping sorted relative `tests/gpu/dist` file
paths to their content SHA-256 values.

To repeat, run `pnpm build`, `pnpm build:gpu:built`, then
`pnpm browser:run pnpm --filter @domfx/gpu-tests exec vite preview --host 127.0.0.1 --port 4197`.
Open `/placement-native.html` in installed Safari, select “Confirm painted output
visually”, set native zoom to 100% or 200%, and inspect all three targets before
each confirmation. These results cover this fixture and environment; broader
keyboard, accessibility, full-site zoom and physical-device checks remain separate.

## Current-site verification — 2026-10-20 UTC

Verified October 20–21 for [#87](https://github.com/G0m1namm/domfx/issues/87):
the marketing site, gallery and Starlight docs on unchanged runtime
[fcf7532](https://github.com/G0m1namm/domfx/commit/fcf753206814a77d16f3709e3eacd13165c765ea).

**Environment:** macOS 26.6.2 (25G83), arm64, Apple M5 Pro, 24 GB RAM;
Node 22.22.3, Playwright 1.63.0. Installed Chrome **155.0.8059.85**, Safari
**26.6.2**, bundled Chromium **153.0.8010.12**. Installed Chrome's rendering fixture
and fresh-profile visibility checks reported adapter `apple` / `metal-3`, with empty
device/description fields. Routine website/docs reports did not measure adapter
identity; Safari's adapter was unmeasured. Power mode and display refresh were unknown.

### Automated results

| Environment and scope                                   | Result                                                                                                                 | Boundary                                                                                                                                                                                                                                                              |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bundled Chromium, website development/production        | **Intermittent failure:** initially 58 passed, 1 failed, 3 expected metadata skips; later 59 passed, 3 expected skips. | The development reduced-motion check saw zero canvases but an enabled artwork playback button. Ten focused repetitions did not resolve it; the later correction is [PR #151](https://github.com/G0m1namm/domfx/pull/151).                                             |
| Bundled Chromium, composed docs production              | **PASS: 30/30.**                                                                                                       | Navigation with/without JavaScript, code/table keyboard scrolling, search, real lab output, unavailable output, motion recovery and actual BFCache restoration.                                                                                                       |
| Bundled Chromium, GPU production smoke                  | **PASS: 13/13.**                                                                                                       | Rendering/readbacks, refresh, disposal, reduced motion, unavailable inputs and responsive capture. Smoke subset only; the full GPU suite was not rerun.                                                                                                               |
| Installed headed Chrome, website development/production | **PASS: 59**, 3 expected metadata skips.                                                                               | No extra WebGPU launch flag; BFCache enabled. Default configured viewport 1440×1000, DPR 1; responsive/DPR cases use declared overrides.                                                                                                                              |
| Installed headed Chrome, composed docs production       | **PASS: 30/30.**                                                                                                       | Navigation, search, live labs, cleanup, motion recovery and actual BFCache restoration.                                                                                                                                                                               |
| Installed headed Chrome, production rendering fixture   | **PASS.**                                                                                                              | Capture/SDF/Fire pixels, GSAP controls, original-button activation and disposal. 1280×720 CSS px, DPR 2, visible, motion off; no extra WebGPU flag or uncaught errors. Separate from website results.                                                                 |
| Installed Chrome, browser-generated tab hide/return     | **PASS: 12 cycles**, three each on home, gallery, standalone docs and Frost reference.                                 | Fresh default profile over CDP; 1200×863 CSS px, DPR 2, motion off. Trusted hidden/visible events, zero canvases after 500ms hidden and output restored. Explicit pause persisted in both docs labs. Canvas removal does not establish internal GPU-resource release. |

### Native UI and assistive technology

| Environment and scope                                          | Result                                                                                                                                                                                                                  | Boundary                                                                                                                                                                                                                                   |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Installed Chrome, native 200% zoom                             | **PASS, sampled controls/reflow:** gallery preview and docs controls remained reachable; preview close returned focus. Image capture-budget fallback retained original content.                                         | 836×473 CSS px, DPR 4. Complete native keyboard order remains untested.                                                                                                                                                                    |
| Installed Chrome, original text selection                      | **PASS:** pointer drag selected and visibly highlighted original `domfx` through an active standalone Fire effect.                                                                                                      | Native 100%, 1672×947 CSS px, DPR 2, visible, motion off. Touch selection remains untested.                                                                                                                                                |
| Installed Chrome, default fonts 16px/24px                      | **FAIL: body text preference response.** All 24 sampled route/width/settings reflow checks fit, but paragraphs retained fixed sizes despite root growth.                                                                | 360/768/1440×900, DPR 2. [#143](https://github.com/G0m1namm/domfx/issues/143) tracks text resizing.                                                                                                                                        |
| Installed Safari, Frost preview                                | **PASS, sampled UI:** visible Frost edges on Text/SVG/Image; intensity, Pause/Resume, preview zoom, reference navigation and Escape focus return.                                                                       | Native 100%; viewport/DPR, adapter, motion and visibility were unmeasured for these observations. Full rendering/placement/lifecycle coverage remains open.                                                                                |
| Installed Safari, native 200% docs                             | **PASS, sampled navigation:** drawer, table of contents and shared search/results/focus return.                                                                                                                         | Complete zoomed lab usability and visible foreground code/table scrolling remain untested.                                                                                                                                                 |
| VoiceOver 10 with installed Safari                             | **PASS, named speech/navigation scenarios:** headings, links, filters, preview controls, both docs labs, API-table reading, search, drawer focus return, native reduced motion/restart and injected unavailable status. | Actual speech was read during automated AT navigation. This is not a complete human accessibility audit. See the [accessibility results](accessibility-verification.md#voiceover-with-safari--2026-10-21-utc) for per-scenario conditions. |
| Installed Safari, paused minimize/restore and BFCache recovery | **PASS, separately observed:** paused UI survived native window minimize/restore; a measured BFCache return allowed explicit Start to recover the Live state.                                                           | Minimize/restore did not measure resource cleanup. BFCache used an instrumented build and did not establish paused-state preservation or AT history.                                                                                       |

Native Safari code/table scroll offsets increased with VoiceOver off, but the
instrumented page reported `hidden`. Foreground and VoiceOver scrolling remain
untested. The [accessibility record](accessibility-verification.md) states the
instrumentation and observation limits. Earlier fallback-only or inconclusive
Safari attempts do not establish incompatibility.

### Source and build identity

- Runtime source: `fcf753206814a77d16f3709e3eacd13165c765ea`.
- Lockfile SHA-256: `c52ead1ee72369986e624127d6f8c0a14dd0dfaf47b4498f9e3932f8b734eb1b`.
- Composed build SHA-256: `7b5028bc28a81fe4f5d8fa380f4512fbb4abd5527d928a331b66ed09a713dbf8`.
  Hash the JSON object mapping sorted relative output paths to file-content SHA-256 values.
- Rendering fixture build SHA-256: `d7fcaaadac5c038735e7ef9e1ec88d7129eb0b861b5a70563fb1b84b68ba65e1`;
  the evidence runner records its build-digest method.

## Missing coverage

| Scope                                                                                                  | Current status                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Safari complete keyboard order, full zoomed labs and AT history                                        | **UNTESTED.** Existing automated Chromium results do not fill these Safari/native rows.                                                                                                                                                                                                                                                                                    |
| Other browser/AT pairings, Firefox, Edge, other browser versions and other desktop GPU/OS combinations | **UNTESTED.** A fresh run on each named environment is needed. Shared engines or vendors are insufficient.                                                                                                                                                                                                                                                                 |
| Physical iOS/Android devices and a second OS/GPU                                                       | **UNAVAILABLE in this cohort.** Real hardware/session access is required; desktop emulation does not establish touch, selection, rendering or lifecycle behavior on those devices.                                                                                                                                                                                         |
| Linux Chromium/SwiftShader                                                                             | **HELD.** [Failed run 36828639144](https://github.com/G0m1namm/domfx/actions/runs/36828639144) had initialization and no-adapter failures. No new rendering pass is claimed; [#41](https://github.com/G0m1namm/domfx/issues/41) and [#91](https://github.com/G0m1namm/domfx/issues/91) own release reliance. No-GPU smoke success does not resolve software-GPU rendering. |
| Fractional DPR, physical device loss, long sessions, broader geometry/assets and bundlers              | **UNTESTED beyond named fixtures.** Controlled failures and bounded Vite consumers do not establish these capabilities.                                                                                                                                                                                                                                                    |
| Physical 60 Hz responsiveness fallback                                                                 | **UNTESTED.** Requires an observed 60 Hz display and the prescribed measurement trials.                                                                                                                                                                                                                                                                                    |

The [capture](../packages/domfx/README.md#padded-capture-fidelity) and
[composition](../packages/domfx/README.md#composition-detection-and-caller-obligations)
limits still apply. These passes do not add rotation, skew, perspective, negative
scale, arbitrary stacking/clipping, video capture or automatic refresh of unobserved
paint changes.

## Reproduce

Follow [CONTRIBUTING.md](../CONTRIBUTING.md#verification) and serialize browser
sessions with `pnpm browser:run` when running browser commands directly.

- `pnpm test:web`: website development/production scenarios.
- `pnpm test:docs`: composed documentation, navigation, search and labs.
- `pnpm test:gpu`: GPU smoke; `pnpm test:browser` for the broader fixture suite.
- `DOMFX_BROWSER_EXECUTABLE='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' pnpm test:browser:evidence`:
  installed-Chrome production rendering fixture.
- [Native and VoiceOver protocol](accessibility-verification.md#verify-the-current-site):
  original content, keyboard/focus, native zoom, motion, history and actual speech.

For installed-engine website/docs checks, use temporary Playwright configs with
`channel: 'chrome'`, `headless: false`, no extra WebGPU launch flag, BFCache enabled
(`ignoreDefaultArgs: ['--disable-back-forward-cache']`), absolute test/output paths
and the original app directory as `webServer.cwd`. These are separate from the
checked-in default cohort.

For default-font checks, use fresh Chrome profiles with actual browser defaults
16px and 24px at native 100% zoom. Compare home, gallery, standalone docs and Frost
reference at all three recorded widths; confirm computed root growth before judging
paragraph growth. Changing authored root CSS tests a different condition.

For visibility checks, use the fresh-process/default-context CDP method in
[`measure-homepage.mjs`](../scripts/measure-homepage.mjs). Register trusted
`visibilitychange` observations before switching tabs. On each of the four routes,
run three hide/return cycles; require zero canvases after 500ms hidden and output
on return. Pause active docs labs before switching and verify they remain paused
after return. Record actual viewport/DPR, motion and adapter.

Preserve failed runs before rerunning. Publish scenario outcomes, environment and
limits; raw logs, recordings and screenshots remain local.

## Historical fixture coverage — September 2026

These results apply to runtime
[6d5b28e](https://github.com/G0m1namm/domfx/commit/6d5b28e42e1a5d89493fae96ace639d0ca4b40ec)
and earlier referenced measurements. They were not rerun as a full suite for the
current site. Host: macOS 26.6.2 / Apple M5 Pro, Node 22.22.3, Playwright 1.63.0;
power mode and display refresh unknown.

| Environment                                                 | Recorded result                                                                           | Scope                                                                                                                                                                                                                                                        |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Chromium 153.0.8010.12, native adapter `apple` / `metal-3`  | **PASS: 386 development/production cases**, no failures, skips or retries.                | 1280×900 CSS px, DPR 2; some capture/gallery/placement/scroll cases also DPR 1. Headless, `--enable-unsafe-webgpu`, visible, motion off except preference tests. Capture/SDF, Fire, placement, scrolling, GSAP, accessibility lifecycle and stress fixtures. |
| Installed Chrome 152.0.7977.83, adapter `apple` / `metal-3` | **PASS:** production capture/SDF, deterministic Fire, original-button input and disposal. | 1280×720 CSS px, DPR 2, visible, motion off, no extra WebGPU flag. Narrower than the Chromium suite; negative/lifecycle suite untested in this version.                                                                                                      |
| Packed standalone/GSAP Vite consumers                       | **PASS** in [#76](https://github.com/G0m1namm/domfx/pull/76).                             | Chromium 153 / native Apple Metal 3, 1280×900, DPR 2, visible, motion off. Strict types, SSR imports, GPU pixels, seek/reverse, refresh/retry and reattachment. OS product version/device model were unspecified in that summary.                            |

Controlled missing WebGPU/no-adapter, reduced motion, composition/capture budgets
and device loss verified usable original input and cleanup. These were injected
negative inputs, not physical hardware failures. Accessibility fixture comparisons
verified original focus, input, names/roles and canvas exclusion; they were not
spoken-output tests. See the [fixture protocol](browser-verification.md),
[accessibility fixture](accessibility-verification.md#reproduce) and
[packed-consumer rehearsal](../RELEASING.md#local-artifact-rehearsal).

Earlier website layouts were checked in
[#101](https://github.com/G0m1namm/domfx/pull/101),
[#107](https://github.com/G0m1namm/domfx/pull/107) and
[#110](https://github.com/G0m1namm/domfx/pull/110). Those results retain their
original revisions and are not passes for the current layout.

## Performance outcomes — prior measured evidence

The completed prerequisite measurements below are retained from their original runs;
they were not rerun for this documentation change. Their source/build identities
are in the linked PRs. These are historical fixture measurements, not current-site
or cross-device performance guarantees.

Both protocols measured Chromium 153.0.8010.12, Darwin 25.6.0 arm64, Apple M5 Pro,
native Apple Metal 3, 1280 × 900, DPR 2, visible, reduced motion disabled. OS product
version, power mode and physical refresh rate were not recorded in those summaries.

| Measurement                                                     | One target        | Two targets       | Candidate and evidence                                                                            |
| --------------------------------------------------------------- | ----------------- | ----------------- | ------------------------------------------------------------------------------------------------- |
| Initialization maximum, five clean-profile starts per condition | 85.2 ms, PASS     | 95.6 ms, PASS     | ≤2000 ms; [PR #73](https://github.com/G0m1namm/domfx/pull/73), completed in `b0ae347`             |
| Warm capture-to-SDF rebuild P95, three warmups then 30 batches  | 9.8 ms, PASS      | 19.1 ms, PASS     | ≤300 ms; same #73 collection                                                                      |
| Steady fire-pass GPU worst trial P95, latest run                | 2.362006 ms, PASS | 0.123624 ms, PASS | ≤6 ms in every trial; [PR #74](https://github.com/G0m1namm/domfx/pull/74), completed in `2f5c3f5` |
| Steady fire-pass GPU worst trial P95, earlier run               | 2.374006 ms, PASS | 3.3282 ms, PASS   | Same unchanged candidate; retain both runs                                                        |
| Physical 60 Hz responsiveness fallback                          | UNTESTED          | UNTESTED          | Observed 60 Hz display setting required; unknown here                                             |

The latest steady run had pooled rAF P95 34.0 ms without effects and 34.1 ms with
either effect condition, CPU submission P95 increases of 0.3/0.4 ms, and no observed
main-thread long tasks. Those rAF values exceed the fallback's ≤20 ms candidate,
but unknown physical refresh makes this an ineligible fallback run, not a fallback
pass. No-effect submits no fire pass and has no GPU timestamp sample.

See the [measurement protocol](performance-measurements.md) for the exact boundaries:
initialization starts after initial assets are ready; rebuild ends after GPU completion;
steady timestamps cover fire passes only, excluding presentation copies, compositor
work, queue gaps and SDF preparation. The fixed-placement one/two-target fixture does
not measure public attachment observer/placement costs, all five gallery classes,
end-to-end frame time, long-session performance or cross-device guarantees.
Missing or failed candidate evidence remains held; this record changes no thresholds.
