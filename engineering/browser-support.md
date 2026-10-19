# Browser and device support record

Record v1, 2026-09-16 UTC, for [issue #32](https://github.com/G0m1namm/domfx/issues/32).
This is evidence for human release review, not a release approval. Packages remain
private and experimental. A pass applies only to the named environment, fixtures and
source snapshot; it does not establish a minimum browser version or an entire browser family.

**Proposed scope:** experimental desktop Chromium 153.0.8010.12 on the measured Apple M5 Pro,
with native WebGPU available, within the existing
[capture, placement and composition contract](../packages/domfx/README.md#manual-fire-attachment).
Keep other environments and unmeasured capabilities outside the supported claim.
The original DOM must remain usable when the decorative effect is unavailable.
Human review must still decide whether this narrow scope is sufficient for a prerelease;
the [release gates](../RELEASING.md#enable-later-through-a-reviewed-change) remain in force.

## Feature correctness by environment

`PASS` means observed fixture assertions passed. `UNAVAILABLE` describes the effect's
runtime result, which can be the expected result of a passing negative check.
`UNTESTED` means no qualifying observation; it is neither a pass nor an incompatibility finding.

Current runs use runtime source
[`6d5b28e42e1a5d89493fae96ace639d0ca4b40ec`](https://github.com/G0m1namm/domfx/commit/6d5b28e42e1a5d89493fae96ace639d0ca4b40ec),
Node 22.22.3 and Playwright 1.63.0. This change adds documentation only.
The local machine is macOS 26.6.2 (25G83), Darwin 25.6.0 arm64, MacBook Pro
Mac17,8, Apple M5 Pro, 24 GB RAM. GPU identity below is the browser-reported adapter,
not an inference from the CPU or macOS Metal capability. Power mode and display
refresh rate are unknown. Chromium reports vendor `apple`, architecture `metal-3`,
with empty device/description fields; those identifiers remain unknown. Its reduced
user agent reports `MacIntel`/macOS 10.15.7, so OS identity above comes from the host,
not that compatibility string.

| Environment                                                                                                                  | Feature correctness and fixture scope                                                                                                                                                                                                                                     | Unavailable behavior                                                                                                                                                                                                           | Evidence |
| ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| Chromium 153.0.8010.12; local macOS/M5 Pro above; native Apple Metal 3                                                       | **PASS: 386 development/production cases**, no failures, skips or retries; 1280 × 900, DPR 2, with capture/gallery/placement/scroll cases also at DPR 1. Headless full Chromium, `--enable-unsafe-webgpu`; page visible, reduced motion disabled except preference tests. | Explicit missing WebGPU, no adapter, reduced motion, capture/composition/budget failures and controlled device loss; original target and cleanup assertions. These are injected negative inputs, not absent physical hardware. | E1       |
| Google Chrome 152.0.7977.83; local macOS/M5 Pro above                                                                        | **PASS: production capture/SDF, deterministic fire, original-button input and disposal**; visible browser, 1280 × 720, DPR 2, reduced motion disabled, no extra WebGPU launch flag. This is a narrower fixture run than E1.                                               | Offscreen suspension observed; dedicated no-GPU/negative/lifecycle suite untested in this version.                                                                                                                             | E2       |
| Chromium 153.0.8010.12; macOS arm64, Apple Metal 3 adapter; OS release/device model unspecified in the published #76 summary | Prior packed standalone/GSAP Vite consumers passed outside the repository, including strict types, SSR imports, actual GPU pixels, seek/reverse, refresh, retry and reattachment. 1280 × 900, DPR 2, visible, reduced motion disabled.                                    | Controlled unsupported composition and explicit recovery passed; physical device loss untested.                                                                                                                                | E3       |

E1 covers the seven padded capture fixtures and independent full-raster SDF oracle,
the five-class public gallery (headline, button, SVG, transparent raster and card),
deterministic time/intensity, refresh/retry, translation/positive axis-aligned scale,
rectangular nested scrolling, assets/CORS, shared services, GSAP ownership and disposal.
The [browser verification protocol](browser-verification.md) specifies exact assertions
and injected conditions. Seeds 29 and 24301 each exercise 660 operations across
28 two-target cycles in each build; the public soak uses 24 two-target cycles.
Managed allocation and explicit destruction counters are not process heap or total VRAM.

In E1, removing `navigator.gpu` produces `UNAVAILABLE: no GPU` in the lab and
`lifecycle: 'unavailable'`, `reason: 'no-webgpu'` through the public attachment.
Returning no adapter produces `no-adapter`. Tests require no surviving effect canvas
and usable original input; startup reduced motion also forbids GPU access. These are
explicit controlled unavailable checks alongside independent native-GPU success cases,
not evidence from a machine without a physical GPU.

The [capture extent](../packages/domfx/README.md#padded-capture-fidelity) remains bounded:
48/80 CSS-pixel diagnostic padding does not change the public 32-pixel default.
Rotation, skew, perspective, negative scale, arbitrary stacking/clipping, video capture,
and automatic refresh of unobserved paint changes are not supported by these passes.
The [composition rejection rules](../packages/domfx/README.md#composition-detection-and-caller-obligations)
and caller obligations still apply. Fractional coordinates at DPR 1/2 do not establish
fractional-DPR or universal CSS paint fidelity.

## Accessibility observations

Keep these observations separate from feature and performance status:

- E1 runs all five accessibility lifecycle cases in development and production.
  No-effect comparisons cover pointer/keyboard activation, forward/reverse focus order,
  focus retention and outline styles, input editing, text selection, names/roles and
  descriptions. Decorative canvases are pointer-transparent, hidden from accessibility,
  empty and outside the tab order. Active-layer checks require a real active attachment.
- [The #28 record](accessibility-verification.md#recorded-manual-observations--2026-09-15)
  preserves earlier agent-driven visible Chrome observations of focus, activation,
  selection and the native accessibility tree. These are historical observations,
  not a new manual session or a human assistive-technology audit.
- E2's original-button interaction check is not an accessibility audit. VoiceOver
  speech/rotor, NVDA, JAWS, TalkBack, braille, switch/voice control and touch selection
  remain untested. Browser accessibility snapshots do not establish spoken output.

## Performance outcomes — prior measured evidence

The completed prerequisite measurements below are retained from their original runs;
they were not rerun for this documentation change. Their source/build identities live
in the linked PRs and reports. They must not be relabeled as measurements of E1/E2 or
as results for Chrome 152, another GPU, or another viewport.

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

## Missing coverage and required access

| Environment or capability                                                                 | Status                         | Access or observation needed                                                                                                                                                                                                                                        |
| ----------------------------------------------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Safari 26.6.2 on this Mac                                                                 | UNTESTED                       | Safari is installed, but WebDriver session creation rejected because Settings → Developer → Allow remote automation is disabled. A permitted Safari automation session or a manual fixture session is needed; no WebGPU conclusion follows from the access failure. |
| Firefox on macOS                                                                          | UNTESTED                       | No local Firefox installation/test browser was found. An actual Firefox installation and native-adapter fixture run are needed.                                                                                                                                     |
| Edge, other Chrome/Chromium versions, other macOS/Apple GPUs or Intel Macs                | UNTESTED                       | Access to each named browser/device/OS combination and a fresh run; shared engine or vendor is insufficient.                                                                                                                                                        |
| Windows with Intel/AMD/NVIDIA GPUs; Linux with native GPUs                                | UNTESTED                       | Existing hardware or an authorized real-GPU session, browser/driver versions and the same fixtures. No hardware acquisition is part of this task.                                                                                                                   |
| iPhone/iPad Safari or other iOS browsers; Android Chrome/Firefox and mobile GPUs          | UNTESTED                       | Real devices, OS/browser/GPU records, touch/lifecycle checks and native rendering evidence. Desktop viewport emulation is insufficient.                                                                                                                             |
| Linux Chromium/SwiftShader CI                                                             | No current pass claimed        | A completed workflow report with browser/OS/software-adapter identity. The [configured CI backend](../.github/workflows/check.yml) is software GPU execution, not native-device support or hardware performance.                                                    |
| Fractional DPR, physical device loss, long sessions, broader geometry/assets and bundlers | UNTESTED beyond named fixtures | Actual settings/failure conditions and targeted reproducible scenarios; injected ordering/loss and bounded Vite consumers cannot establish these.                                                                                                                   |
| Assistive technology and physical 60 Hz fallback                                          | UNTESTED                       | Named OS/browser/AT versions and observed announcements/input; for fallback, an observed 60 Hz display, supported long-task observer and the prescribed trials.                                                                                                     |

## Evidence and reproduction

Raw JSON, PNGs and logs remain local/ignored. The tracked summaries and linked protocols
are readable in a public clone; local paths below are evidence locators, not published
downloads. Preserve the full run directories when handing evidence to a reviewer.
Do not replace an older row with a new pass without its browser/adapter identity,
source/build/lockfile hashes, fixture scope, negative results and separate timing status.

- **E1 — current native Chromium suite:** `pnpm test:browser`; detailed report at
  `.scratch/browser/report.json` (started `2026-09-16T05:33:33.128Z`, 386 passed, 0 skipped/failed/flaky, 456.6 s). Final `pnpm agent:verify` writes an immutable-per-run
  source digest, command results and browser attachments under `.scratch/agent/run-*/`.
  The suite includes actual shader readbacks; missing-WebGPU/no-adapter tests inject
  capability absence only in their negative cases. No mocked GPU output supplies a pass.
- **E2 — installed Chrome production fixtures:**
  `DOMFX_BROWSER_EXECUTABLE='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' pnpm test:browser:evidence`.
  The runner builds production, uses a fresh visible browser and saves `report.json`,
  bundle/lockfile hashes, actual browser/adapter identity, capture/mask/SDF/fire PNGs,
  target interaction and disposal checks. This run passed without browser errors, saved
  47 artifacts and reported zero managed/reserved bytes with the overlay removed.
  Raw report: `.scratch/browser-regression/2026-09-16T05-41-10-682Z/report.json`.
  Production SHA-256: `37ea9e8dbc3e88768fd2130a49cc99586eb81e20f1cb0602d30fca75353bf35c`;
  lockfile SHA-256: `1ee167840d7b50b1894866ffe2aeb172b8ae8d159fe65b7715a57476b454eeba`.
  The report marks the worktree dirty because the support documentation was in progress.
  Adapter fields match E1; the smaller viewport left some gallery targets suspended
  offscreen. This does not claim the full gallery interaction matrix passed in Chrome.
- **E3 — prior packed consumers:** [PR #76](https://github.com/G0m1namm/domfx/pull/76)
  at `6d5b28e`; reproduce with `pnpm release:rehearse` as described in the
  [artifact protocol](../RELEASING.md#local-artifact-rehearsal). This is historical
  packed-consumer evidence, not a fresh rehearsal in this task.
- **Earlier correctness/accessibility/stress:** [PR #72](https://github.com/G0m1namm/domfx/pull/72)
  at `1093c06` and [PR #75](https://github.com/G0m1namm/domfx/pull/75) at `7346993`.
  E1 reruns their automated fixtures; their manual observations retain their original dates.
- **Historical performance:** #73 records
  `.scratch/performance/2026-09-16T00-17-51-319Z/report.json`; #74 records
  `.scratch/steady-performance/2026-09-16T01-15-34-731Z/report.json` and
  `.scratch/steady-performance/2026-09-16T01-22-11-629Z/report.json`.
  These files were not available in this fresh worktree; the linked PR summaries
  supply the recorded results. Reproduce with `pnpm measure:performance` and
  `pnpm measure:steady`, preserving all samples and held outcomes.
- **Safari access attempt:** `/usr/bin/safaridriver --port 4446`, then WebDriver
  `POST /session` requesting `browserName: safari`, returned `session not created`
  with the remote-automation setting requirement. Local response:
  `.scratch/support-matrix/safari-session.json`. No Safari fixture executed.

## 2026-10-18 homepage and accessibility follow-up — issue #87

This follow-up evaluates source `eb97f5d3f8726de66b9c77946c3e0272e7970ef9`
on the available Mac. It does not change the historical results above. The selected
cohort is native Playwright Chromium for a repeatable reference and installed Safari
26.6.2 for an additional engine when it can be operated. The host is macOS 26.6.2
(25G83), MacBook Pro Mac17,8, Apple M5 Pro GPU. Google Chrome 155.0.8059.80 is
installed, but is not a separate engine. No real mobile device or second desktop
GPU/OS was available for this run. Playwright WebKit, if used for a diagnostic,
would be recorded separately from installed Safari; viewport emulation would not
count as mobile evidence.
The lockfile SHA-256 is
`0b7f551f3d596b3110054b88c410cb0cb0e187c34772f494c4d5a89bfeea64da`;
the production `apps/web/dist/index.html` served to Safari has SHA-256
`799dc75cfde3ff6d4b5e5f7b410f0835c60271f2840905c93ab7adc81c11c693`.

For a new environment, record browser and adapter identity from the running browser,
viewport, DPR, page visibility, motion preference, source and build identity before
assigning a result. Use the homepage image, inline SVG, selectable text and scrolling
installation action for Fire; the GSAP player for still-frame seek and playback;
and the optional Prism folds background for its static and reduced-motion states.
Observe rendered pixels separately from canvas presence. Exercise shared Pause/Resume,
refresh or replacement, navigation, visibility return, and teardown/re-attachment.
For unavailable Fire, verify original content, links, input and selection and the
actionable status. Record unsupported composition and reduced motion separately.
At native browser 200% zoom, inspect the editorial page, expanded toolbar panels,
keyboard focus/operation, scrolling and GSAP seek. On a real touch device, repeat
interaction and selection. For VoiceOver, identify the browser pairing and record
actual spoken or captioned announcements for headings, links, panels, sliders,
Pause/Resume and status changes, plus navigation past decorative canvases. An
accessibility tree is only structural evidence, never a VoiceOver result.

Use `pnpm test:web` for development and production website checks and
`pnpm agent:verify` for repository and no-WebGPU smoke checks. Keep raw reports,
screenshots and transcripts in `.scratch/`; publish the observed result and exact
scope here. `PASS` applies only to the stated scenario. `FAIL` requires a reproducible
observation. `UNAVAILABLE` means a capability or environment could not be exercised;
`UNTESTED` means the scenario was not run.

| Environment and condition                                                                                                                                                 | Result and bounded observation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Evidence / next step                                                                                                                                                                                                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Playwright Chromium 153.0.8010.12, headless native Apple adapter reported as vendor `apple`, architecture `metal-3` (device and description empty); macOS/M5 Pro above    | **PASS: 120/120** website cases across development and production, including rendered GPU pixels for image/SVG/text, grouped Pause/Resume and scrolling, GSAP seek/playback, Prism folds, lifecycle, keyboard and controlled fallback. Main suite viewport 1440 × 1000, DPR 1; grouped GPU cases separately use DPR 1 and 2. Page visible and `no-preference` except explicit motion cases. **PASS: 10/10** no-WebGPU smoke cases through `pnpm agent:verify`. These injected unavailability checks are fallback passes, not rendering passes.                                                                                                                                                                     | `.scratch/web/report.json` (started 2026-10-18T21:33:24Z, no failures/skips/retries); `.scratch/agent/run-89cTbM/verification.json` and its browser report.                                                                                                                                                                       |
| Installed Safari 26.6.2, visible production page on this Mac, native 100% then exact 200% page zoom; viewport, DPR, Safari GPU adapter and motion preference not measured | **PASS, limited interaction scope:** original image/SVG/text and link remained visible; original link navigated to `#integration`; Fire Pause/Resume toggled; the GSAP player initialized on approach and pointer seek showed a distinct still frame at 2.0/4.0 s; Prism folds toggled from still to playing. At 200%, Safari's Page Menu confirmed `200 %`; the editorial content and expanded Effect panel were available, and the page reported “Some effects are unavailable. The original elements still work.” Fire pixels were not visibly identified in the inspected native Safari view at 100%; **UNTESTED rendering correctness**, with backend and cause unresolved. Zoom was returned to Actual Size. | Local visible UI inspection of this task's production build on `127.0.0.1:4323`, built from the source above. Repeat with a diagnostic Safari session before assigning a rendering outcome. `/usr/bin/safaridriver` rejected session creation because Safari's “Allow remote automation” setting is disabled; it was not changed. |
| Native Safari 26.6.2 + macOS VoiceOver                                                                                                                                    | **UNAVAILABLE:** no spoken or captioned announcements were captured for headings, links, panels, sliders, status changes or decorative canvases. The Safari accessibility tree showed semantic controls, but that is not VoiceOver output.                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | A person or permitted AT capture session must record actual announcements and navigation.                                                                                                                                                                                                                                         |
| Real iOS/Android touch device and another desktop GPU/OS                                                                                                                  | **UNAVAILABLE:** no such device was accessible on this machine; USB inventory was empty and only Command Line Tools were installed. Desktop viewport cases above are not real-device checks.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Obtain named hardware and repeat touch, text selection, visibility, rendering and fallback scenarios.                                                                                                                                                                                                                             |
| Linux Chromium/SwiftShader                                                                                                                                                | **UNTESTED in this follow-up.** The original [run 36828639144](https://github.com/G0m1namm/domfx/actions/runs/36828639144) website initialization and `no-adapter` failures remain unresolved.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Requires a reproducible software-adapter session with actual rendering/fallback observations; the no-GPU smoke pass above does not settle it.                                                                                                                                                                                     |

The earlier Safari visible-UI observations above were recorded before this
continuation: native Fire pixels and Chromium native 200% zoom were then not
established. Safari text selection, physical visibility return and
unsupported-composition behavior remain untested. No result here implies support
for all Safari or Chromium versions.

### Available-Mac continuation — 2026-10-18

This continuation uses source `8d7eeecbf4faa1ea4609de19147b23abd09770d4`,
lockfile SHA-256 `9fd9ab1136ae32a42690f0ef80763d4a47cf468cc8f2343cab20991d2b1f8b89`,
and production `apps/web/dist/index.html` SHA-256
`799dc75cfde3ff6d4b5e5f7b410f0835c60271f2840905c93ab7adc81c11c693`.
The host is the macOS 26.6.2 / MacBook Pro Mac17,8 / Apple M5 Pro above. These
checks extend the preceding record; they do not rerun its full website suite.

| Environment and scenario                                                                                                                                 | Result and observation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Limit                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Installed Chrome 155.0.8059.80, native browser zoom 200%, visible production page; CSS viewport 836 × 473, DPR 4, `prefers-reduced-motion: reduce` false | **UNTESTED environment-level acceptance; bounded fallback and interaction observed:** the page reported “Some effects are unavailable. The original elements still work.” Original content remained visible and `document.body.scrollWidth` equaled the 836 px viewport width. Effect settings, Motion and Prompt panels fit in that width. Keyboard Enter opened panels and focused their controls; Motion speed slider changed with arrow keys and was restored. The GSAP player reached a distinct still frame at 2.0/4.0 s, then was reset to 0. The background changed still → playing → still. Local Reduce motion disabled playback/background animation and reported its still state; it was restored. Docs navigation and its browse menu worked at 200%. | Chrome's browser-reported GPU adapter was not measured; the host GPU and earlier Playwright Chromium 153 adapter do not establish it. These per-step observations do not establish Fire rendering or complete the selected-browser result. Visibility return was not established: opening a second tab did not make the observed page hidden. Native zoom was reset to 100% (CSS viewport 1672 px, DPR 2); the original Pause and motion settings were restored. |
| Installed Safari 26.6.2, visible production page at native 100% zoom; window 1324 × 940 points                                                           | **UNTESTED environment-level acceptance; bounded Fire pixel observation:** in matched native ScreenCaptureKit window captures, selecting None showed the plain image, SVG and live heading; selecting Fire showed distinct flames around the image and SVG contours and over the heading. The Fire control was enabled.                                                                                                                                                                                                                                                                                                                                                                                                                                            | Required CSS viewport, page DPR, adapter identity and motion preference were not measured. Window points do not establish CSS viewport. Safari WebDriver session creation was unavailable because remote automation was disabled; no setting was changed. These metrics were also not obtained through the current native UI, so no values or adapter identity are inferred.                                                                                     |

For the selected native Chrome and Safari environments, scrolling, lifecycle
(refresh/replacement, teardown/reattachment), native text selection and visibility
return remain **UNTESTED**. Chrome's 200% per-step fallback/interaction observations
do not complete the selected-browser result. Safari's 200% fallback observations
are historical and bounded to their earlier run. VoiceOver actual speech, physical
mobile and a second OS/GPU remain
**UNAVAILABLE**; unsupported composition and performance were not measured.
Issue #87 remains open; the draft PR records partial evidence only.

The Safari comparison is saved locally as
`.scratch/browser-accessibility-evidence/safari-none.png` and
`.scratch/browser-accessibility-evidence/safari-fire.png`. A different screenshot
surface did not show the Fire layer; its omission is unexplained, so this result
uses the matched native window captures. No screenshot is published or uploaded.
The [accessibility record](accessibility-verification.md#available-mac-continuation--2026-10-18)
separately records the keyboard and VoiceOver evidence boundary. In a future native
Safari session, record browser-reported viewport, DPR, adapter, visibility and
motion metadata before assigning a result; then complete the scrolling and lifecycle
matrix, native selection and visibility return. Record actual AT speech separately
with observable audio or captions. Keep raw screenshots local; do not publish them.

### Bounded native follow-up — 2026-10-19 UTC

Source remained `8d7eeecbf4faa1ea4609de19147b23abd09770d4`, lockfile SHA-256
`9fd9ab1136ae32a42690f0ef80763d4a47cf468cc8f2343cab20991d2b1f8b89`,
and served production `apps/web/dist/index.html` SHA-256
`799dc75cfde3ff6d4b5e5f7b410f0835c60271f2840905c93ab7adc81c11c693`.
The same macOS 26.6.2/Mac17,8/M5 Pro host and installed Chrome 155.0.8059.80
and Safari 26.6.2 were used. The built homepage was served at
`http://127.0.0.1:4323/`; a separate, ignored local-only diagnostic page at
`http://127.0.0.1:8765/diagnostic.html` reported Safari metadata. It is not the
authored homepage and cannot supply its render or interaction result.

| Browser and condition                                              | Result and observed behavior                                                                                                                                                                                                                                                                                                                 | Boundary                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Chrome 155, built homepage with DevTools docked                    | **UNTESTED environment-level result; bounded metadata and controls:** the page console reported CSS viewport 1421 × 1003, DPR 2, reduced motion false, and browser-requested adapter vendor `apple`, architecture `metal-3`, device and description empty. The homepage's Effect control changed Fire → None, disabling intensity and Pause. | `document.visibilityState` reported `hidden` while the GUI exposed the page. The two local native UI captures labelled Fire and None have identical SHA-256, so they establish no matched pixel comparison or visible replacement. The earlier 200% fallback/keyboard observations remain separate.                                            |
| Safari 26.6.2, local-only diagnostic tab                           | **UNTESTED environment-level result; bounded browser metadata:** the diagnostic reported CSS viewport 1324 × 850, DPR 2, reduced motion false, `navigator.gpu` present, and a requested adapter whose vendor, architecture, device and description each reported `apple`.                                                                    | The diagnostic reported `hidden` at creation and after switching away and back, with no visibility-change event. This is browser metadata on a separate local page, not a measured homepage viewport, visibility return or new Fire pixel result. The earlier matched native Safari homepage captures retain their narrower pixel observation. |
| Safari 26.6.2, built homepage through native accessibility actions | **UNTESTED environment-level result; bounded control transitions:** the original Pause changed to Resume and back; Effect changed Fire → None → Fire, disabling and then re-enabling intensity and Pause.                                                                                                                                    | The session lacked a qualifying visible-pixel observation and native scrolling returned `noWindowsAvailable`. These controls do not establish public `refresh()`/`dispose()` calls, teardown, reattachment, placement, selection or visibility return.                                                                                         |

The native UI also intermittently returned `noWindowsAvailable` for coordinate or
scroll actions. Because the pages reported `hidden` and Chrome's two captures were
byte-identical despite the Effect value change, no new rendering, scrolling,
visibility-return or native text-selection PASS is assigned. The selected-native
environment checks remain **UNTESTED**; no browser incompatibility is inferred.
Actual VoiceOver speech remains **UNAVAILABLE** as recorded above, and physical
mobile/other OS/GPU remain inaccessible. Raw local captures and the diagnostic
source are in `.scratch/native-2026-10-19/`; none were uploaded.
