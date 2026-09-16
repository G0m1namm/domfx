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
