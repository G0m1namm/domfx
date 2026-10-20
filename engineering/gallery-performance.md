# Gallery performance baseline

Issue [#86](https://github.com/G0m1namm/domfx/issues/86), measured 2026-10-20.
This replaces the active measurement method for the current five-card homepage.
The [editorial baseline](homepage-performance.md) remains historical evidence for
its pinned revision; its four-target controls and timings do not describe this page.

## Reproduce

From a clean checkout with dependencies and Playwright Chromium installed:

```sh
pnpm build:web
pnpm measure:homepage
```

For the separate browser-generated tab visibility check:

```sh
pnpm measure:homepage --native-visibility
```

This uses a temporary headed Chromium profile and `connectOverCDP({ noDefaults:
true })` in its default context. Normal tab activation generates visibility events;
no document visibility property is overridden and no visibility event is dispatched.
By default it checks three hide/return cycles on both `/` and `/effects/`, using the actual
window, DPR and OS motion preference rather than the performance profiles.
The native process and temporary profile belong to this command and are cleaned
up on completion. A failed cycle fails collection and retains its partial state.

Run serially, without competing builds, browser tests or GPU measurements. The
command uses the shared browser-session lock and serves the composed
`apps/web/dist` on a temporary loopback port. It does not rebuild that directory.
Results, raw samples, screenshots, CPU/allocation profiles and traces stay in
ignored `.scratch/gallery-performance/<timestamp>/`. Preserve incomplete reports;
`outcome: running` or `incomplete` is never a successful baseline.

Defaults are three fresh contexts per control/profile, three 1.5-second steady
windows per context and a one-second warmup. `DOMFX_HOMEPAGE_TRIALS` and
`DOMFX_HOMEPAGE_DURATION_MS` change those counts/durations; 250 ms is the minimum
window, suitable only for preflight. `DOMFX_BROWSER_EXECUTABLE` selects an installed
Chromium executable. Record known conditions with `DOMFX_POWER_MODE` and
`DOMFX_REFRESH_RATE`; leaving them unset records `unknown`.

The runner rejects the wrong route/composition, missing visible output, hidden or
truncated timing windows, page errors and failed scenarios. It stops on failure
without retrying or discarding the failed condition. Rejected windows retain raw
timing and boundary snapshots in `failedMeasurement`, outside successful sample
distributions. Action/timeouts retain whatever partial timing remains accessible;
a lost page can leave that evidence unavailable. Timing windows have a bounded
timeout. The current contract requires five homepage cards and validates every
preview with at least 8% of its target area in the viewport.

## Workload and controls

Profiles are 1440×900 CSS pixels at DPR 1 and 2, and 360×780 at DPR 2. The narrow
profile is desktop emulation, not real mobile hardware. Each fresh context measures
a cold navigation, warmed steady windows and one warm reload. Control order
alternates between context pairs; profiles run serially in one browser. Browser
cache starts empty per context; OS, driver and shader caches are uncontrolled.

Both controls use the same production page, content, route, viewport and motion
preference (`no-preference`). A fixed GitHub star response removes external API
variability. Fetch interception preserves normal browser caching; Playwright
routing is deliberately avoided because it disables HTTP cache.

- **Effects:** the ordinary public application path with WebGPU available.
- **Capability-static:** a diagnostic init script hides `navigator.gpu`. Native
  content remains, but effect imports, status text and available controls differ.
  Fresh-context comparisons include that entire fallback path.
- **Paired static:** after the effects steady windows, synthetic `pagehide` and
  persisted `pageshow` restart page owners with WebGPU suppressed. The page, loaded
  assets and parsed code remain. Three more windows precede restoration and reload.
  These are synthetic lifecycle operations, not an actual BFCache measurement.

Neither static comparison isolates GPU cost or perfectly preserves application
state: owners restart, and the capability changes. Reduced motion is tested
separately and is not used as the static control.

The first context of each control/profile also measures three repetitions of:
ordinary wheel scrolling; nine-second closing/header pattern cycles; preview
open/close; Text/SVG/Image replacement; four rapid intensity changes; keyboard
zoom/pan/reset; search through both effect and Pagefind documentation results; and
`/effects/` filtering through Pattern/Energy/Material/All. Scroll trials reset
instantly to the document top. Effects contexts separately measure the closing
control's header/artwork pause and the preview's local pause. Neither is a global
card pause. Other contexts supply independent steady/load repetitions, not extra
independent interaction sessions.

Ordinary windows collect rAF intervals, long tasks and direct canvas insertion/
removal, with CDP metrics at their boundaries. The window continues until both its
minimum duration and action sequence finish. Task time includes automation and
measurement work; it is not action latency or INP. rAF intervals describe callback
pacing, not GPU execution or presented frames. Canvas churn is a DOM proxy and
does not count internal capture attempts, textures or other resources.

## Recorded source and environment

The retained baseline is local run `2026-10-20T20-57-58-131Z`: **18/18 contexts
completed**, with no page errors. Six separate steady-state diagnostic traces
completed without reported event loss. Raw files are local evidence, not required
checkout inputs. The tables below preserve the relevant observations for review.

| Identity                          | Value                                                               |
| --------------------------------- | ------------------------------------------------------------------- |
| Runtime source                    | `351b473fa505104836154cab37d821f8a2102a2d`                          |
| Working changes during collection | runner and its two helper/test files only                           |
| Lockfile SHA-256                  | `c52ead1ee72369986e624127d6f8c0a14dd0dfaf47b4498f9e3932f8b734eb1b`  |
| Runner SHA-256                    | `73ba22355e7509e08b35840d0c32c9d474f87270ca6d3983fe8e9e4474bdfb2d`  |
| Helper SHA-256                    | `9adae6357d5f5d9c91417a873a88b997fcd75e38e7dd63629728e8a107842e23`  |
| Composed build SHA-256            | `803a2c0caef87ce7e23165ae197a41c7257d8c4de7c94dced4931a36d6fef995`  |
| Machine                           | Apple M5 Pro, arm64, Darwin 25.6.0                                  |
| Browser / Node                    | Headed Playwright Chromium 153.0.8010.12 / Node 22.22.3             |
| Adapter metadata                  | Apple, Metal 3; device/description empty; timestamp-query supported |
| Power mode / display refresh      | Unknown / unknown                                                   |

The runner hashes every composed file and records bounds, visible hosts, canvas
dimensions, DPR, motion and visibility alongside each sample. Native Apple GPU
availability was observed; no timestamp queries were used on application passes.
Chromium starts with `--enable-unsafe-webgpu` and BFCache disabled. These conditions
are narrower than stock-browser or cross-browser support evidence.

At the document top, desktop profiles had three active canvases: header,
Electricity (320×240 CSS px) and Frost (133.1×140.8). Their output sizes were
1504×68, 384×304 and 197×205 at DPR 1; doubled at DPR 2. The narrow profile had
header and Electricity (241.7×216 CSS px), with output sizes 848×136 and 612×560.
Output includes effect overflow; these pixel dimensions are not VRAM estimates.
Static contexts had zero canvases. Actual visible/active counts change on scroll.

A separate collector-validation supplement, `2026-10-20T21-16-29-812Z`, completed
six contexts with one repetition and 300 ms minimum windows after review added
header/closing/dialog geometry and intermediate replacement/zoom observations.
It used the same build and runtime revision. Its runner/helper hashes are
`1d4c9a923424c24ca6e064376e868a5085042351582744295ee8b20fc2c1a8b5` and
`f869e086df25b3223502f970e904edd6d2a6dc5a74870bf8d99a023f14370e75`.
These observations validate collection; their timings are not pooled with the
18-context baseline. Intermediate snapshots add diagnostic overhead to replacement
and zoom/pan windows in the updated runner.

The supplement observed active header targets of 1440×4 CSS px on desktop and
360×4 on narrow; active closing targets were 380×285 and 240×180 respectively.
SVG/Image dialog targets were 260×260 desktop and 200×200 narrow. Text targets were
158.4×180 and 104.9×120. Each effects replacement observation had one active dialog canvas.
Zoom snapshots recorded scale 1.5 then reset to 1; narrow keyboard pan moved the
transform by −2 px while desktop movement was clamped to the fitting target.
Native-hide polling now uses a 100 ms timer instead of rAF; it remained unavailable.

## Load and assets

All sizes use KiB (1024 bytes). Whole-build compressed sizes are per-file gzip and
Brotli estimates, not observed CDN transfers. The loopback server sends uncompressed
responses with a one-hour cache. These numbers do not predict deployed latency.

| Composed build group           | Files | Raw KiB | Gzip KiB | Brotli KiB |
| ------------------------------ | ----: | ------: | -------: | ---------: |
| Entire composed site           |   177 |  9837.2 |   6290.2 |     5771.8 |
| Marketing `_astro/`            |     8 |  4336.6 |   3572.2 |     3274.8 |
| Docs subtree, including search |   147 |  4819.2 |   2307.6 |     2098.3 |
| Shared root fonts              |    11 |   239.7 |    218.9 |      215.2 |

The four marketing PNGs alone total 3752.6 KiB raw. The browser/effect bundle is
363.4 KiB raw / 99.9 gzip / 84.3 Brotli; SnapDOM is 154.9 / 49.0 / 42.1 KiB.
The separate docs bundle and docs artwork contribute to build size, not initial
homepage downloads.

At homepage readiness, navigation plus completed resource `transferSize` totaled
4499.9 KiB for effects and 3957.0 KiB for static, identically across profiles and
three fresh contexts. Warm reloads transferred 42.0 KiB in both controls: the HTML
was fetched while recorded subresources came from cache. Resource entries can
repeat capture-related asset reads; encoded body sizes must not be summed as
network bytes. Later homepage interactions added 85.4 KiB of observed resource
transfer after the warm reload, including the deferred Pagefind loader/worker.
Gallery subresources then added zero transfer bytes from the warm cache. Those
resource totals exclude each document's separate navigation entry and do not
measure uncached search or gallery navigation.

Times below are nearest-rank **P50 / P95 ms**, three independent contexts per cell;
P95 equals the observed maximum with this sample count.

| Profile       | Effects load, cold / warm | Static load, cold / warm | First canvas, cold / warm | Header active, cold / warm |
| ------------- | ------------------------- | ------------------------ | ------------------------- | -------------------------- |
| Desktop DPR 1 | 25.3/27.9 · 9.8/9.9       | 25.7/25.8 · 14.5/15.0    | 181.2/291.8 · 113.9/116.7 | 185.4/301.1 · 126.8/127.3  |
| Desktop DPR 2 | 28.0/36.1 · 10.1/10.6     | 40.4/41.2 · 16.1/16.1    | 199.5/202.2 · 120.5/122.0 | 208.8/211.2 · 130.4/132.2  |
| Narrow DPR 2  | 26.4/27.4 · 9.2/9.4       | 27.1/30.8 · 15.7/15.9    | 174.6/178.4 · 117.3/118.6 | 174.6/178.5 · 117.4/118.6  |

Load means Navigation Timing `loadEventEnd`. First canvas means the first observed
canvas insertion; header active means the first observed active status. Both are
timestamps since navigation and initialization proxies. Neither times capture,
first rendered effect pixels, shader compilation or GPU completion. Static has no
corresponding effect marks. A faster load event does not mean effects initialized.

## Steady work and interactions

Each steady/control cell contains nine 1.5-second windows from three contexts.
Quantiles below are per-window main-thread TaskDuration deltas in ms. Paired
static windows follow effects in the same loaded page.

| Profile       | Effects P50/P95 | Fresh static P50/P95 | Paired static P50/P95 | Effects rAF P50/P95 ms (interval count) |
| ------------- | --------------: | -------------------: | --------------------: | --------------------------------------: |
| Desktop DPR 1 |     183.7/211.0 |            14.0/17.5 |             13.4/16.2 |                          8.3/9.2 (1621) |
| Desktop DPR 2 |     194.0/211.7 |            13.7/16.0 |             13.6/21.0 |                          8.3/9.0 (1620) |
| Narrow DPR 2  |     155.5/178.5 |            14.7/32.6 |             13.3/16.7 |                         8.3/10.0 (1621) |

All ordinary steady windows had zero long tasks, zero LayoutCount/RecalcStyleCount
increments and zero direct canvas churn. Effects ScriptDuration P50 was
125.0/127.7/103.1 ms per window respectively, versus about 2 ms in fresh static.
This establishes recurring CPU work for the full animation path on this machine;
it does not establish a GPU bottleneck or a budget violation.

The next table shows **effects task P50/P95 ms per window**, three repetitions in
one context per profile. Most windows last at least 1.5 seconds; cycle windows last
nine seconds. Do not compare cycle totals as if their duration were equal.

| Scenario                     | Desktop DPR 1 | Desktop DPR 2 | Narrow DPR 2 |
| ---------------------------- | ------------: | ------------: | -----------: |
| Ordinary scroll              |   269.7/310.0 |   260.5/286.7 |  248.5/256.7 |
| Closing/header pattern cycle |   898.0/900.3 |   958.6/980.5 |  852.8/854.1 |
| Header/artwork paused        |     75.0/82.1 |     76.4/84.2 |    64.1/75.3 |
| Preview open/close           |   241.4/250.1 |   238.7/242.3 |  388.4/391.7 |
| Text/SVG/Image replacement   |   239.3/253.5 |   246.3/259.7 |  231.7/240.2 |
| Rapid intensity              |   173.9/180.5 |   177.8/179.8 |  151.1/160.8 |
| Zoom/pan/reset               |   173.2/178.3 |   179.0/189.0 |  159.9/164.8 |
| Preview paused               |    94.7/100.8 |   105.2/108.4 |    87.1/91.6 |
| Search open/results/close    |   244.9/292.0 |   227.8/288.4 |  403.2/503.4 |
| Gallery filtering            |   658.1/676.2 |   672.6/700.5 |  522.3/533.2 |

The corresponding static scenarios produced no long tasks. Their task P50 values
ranged from 19.7–34.3 ms for scroll/preview/search and 52.4–60.5 ms for filtering;
nine-second static cycles used 73.8–75.3 ms. No static canvases were inserted.

Effects produced the following long-task observations across the three windows
per profile. A zero elsewhere means none observed in these short samples.

| Scenario           | Desktop DPR 1 count/max ms | Desktop DPR 2 count/max ms | Narrow DPR 2 count/max ms |
| ------------------ | -------------------------: | -------------------------: | ------------------------: |
| Ordinary scroll    |                       3/81 |                       3/82 |                      2/51 |
| Pattern cycle      |                       3/69 |                       3/68 |                      3/67 |
| Preview open/close |                        0/— |                        0/— |                     3/107 |
| Search             |                        0/— |                        0/— |                     4/121 |
| Gallery filtering  |                      9/175 |                      9/174 |                     6/133 |

Median rAF remained 8.3 ms across these scenarios, so a median alone hides spikes.
Maximum intervals reached 183.3 ms during desktop filtering and 116.7 ms during
narrow search. Canvas insertions/removals accompanied scrolling, pattern changes,
target replacement and dialog/filter transitions. Intensity and zoom/pan produced
zero direct canvas churn. This locates a transition/attachment workload to
investigate; it does not identify the responsible capture or GPU operation.

## Memory and separate diagnostics

Steady-window ending JS heap P50/P95 MiB was 5.54/7.11, 5.79/7.85 and 6.26/9.22
for effects at desktop DPR 1, desktop DPR 2 and narrow DPR 2. Fresh static was
1.67/1.84 MiB in each profile. No forced GC was used. Heap values vary with natural
collection and are neither peak allocation nor retained-leak measurements.

Initial summed browser-process RSS P50 was 1200.1/1216.1/1211.5 MiB for effects
and 1087.3/1106.1/1105.3 MiB for static. This sums OS RSS of CDP-reported browser
processes in a reused browser. Shared pages can be counted repeatedly; browser,
renderer and GPU-service caches persist. It is not unique page memory, incremental
effect memory, a logical reservation ledger or VRAM. Post-interaction/teardown
RSS is retained locally but cannot prove a leak or successful GPU deallocation.

Six extra 1.5-second steady windows enabled tracing, CPU sampling and allocation
sampling together. Their overhead is excluded from the ordinary timing tables.
Sampled allocations were 2629.1/2981.6/2116.4 KiB for effects versus
453.4/387.9/323.1 KiB for static. These sampled estimates include collected objects
and instrumentation, not live bytes or an exact allocation rate. The built browser
bundle accounts for the largest sampled self-allocation group in effects
(2177.0/2240.9/1696.7 KiB); minified frames do not justify a specific source fix.

Renderer-main trace events included MinorGC/MajorGC durations of
1.30+4.14+2.24 ms, 0.54+3.59+4.19 ms and 4.44+3.73 ms respectively. Static had
one MajorGC of 2.68/3.05/3.10 ms. Nested/background GC events are not added to
these totals. No long tasks were recorded in the diagnostic windows.

**CPU profile timing is unusable:** every profile contains negative `timeDeltas`
(178–257 entries per file). Raw profiles are retained, but no function-level CPU
milliseconds or percentage ranking is derived from them. The unaffected ordinary
CDP counter deltas and trace event durations above remain separate observations.
Trace event loss was false; that does not validate CPU sampling timestamps.

Console warnings included nonpreferred WebGPU canvas format (potential extra
copy), unused font preloads and repeated SnapDOM capture. They are investigation
leads, not measured explanations for the spikes.

## Lifecycle evidence, exclusions and decisions

Offscreen return and both pause/resume paths completed. Synthetic hidden state,
reduced motion and synthetic `pagehide` each left zero canvases in all six
interaction contexts. Clearing reduced motion retained zero output until explicit
Resume; synthetic visibility return recreated visible effects. Final navigation
to `about:blank` completed. These DOM observations do not prove exact internal
resource destruction or actual GPU memory release.

The original performance contexts recorded native tab-hide as `unavailable`:
bringing another automated tab forward never produced `document.hidden`.
Installed-Chrome inspection was inconclusive and native app control timed out.
Those attempts remain excluded, rather than relabelled as successful.

The separate `--native-visibility` mode removes Playwright's default page overrides.
The pinned Playwright implementation enables focus emulation for ordinary pages;
the [CDP definition](https://github.com/ChromeDevTools/devtools-protocol/blob/master/pdl/domains/Emulation.pdl)
describes that override as simulating a focused and active page. Disabling focus
emulation from an additional CDP session alone did not resolve the earlier attempt.
Using a fresh native process/default context without those overrides did produce
browser-generated hidden/visible transitions. This establishes a working verification
method; it does not attribute the earlier failure to one individual override.

Native tab-hide/return now has separate functional evidence: three cycles on each
marketing route, all with trusted hidden/visible event pairs, zero canvases after
500 ms hidden, and one canvas per visible effect host on return. The source/build
identity and exact environment for the retained run are recorded below. It does
not add performance timing samples or establish internal resource destruction.

Retained run `2026-10-20T21-33-48-351Z` completed all six cycles and process/profile
cleanup. Source was `8b4c2b8f9ee4c5a6025bf6bb02076a444bbafcf3` with the native-mode
runner edits; runner SHA-256
`e5724dee0fa53cd6a379da9ec2e4bb5dafec32a607dd24225ae7dcd809f69b72`.
The helper, lockfile and composed build identities match the preceding supplement.
Environment was Chromium 153.0.8010.12, Darwin 25.6.0 arm64, Apple M5 Pro / Metal 3,
actual 1200×807 CSS px at DPR 2, reduced motion off. Display refresh and power mode
remain unknown. These browser-generated tab switches were controlled through CDP;
they are not evidence for OS window minimization or manual keyboard behavior.

| Route       | Cycles passed | Before / hidden / returned canvases | Trusted events per cycle |
| ----------- | ------------: | ----------------------------------: | -----------------------: |
| `/`         |             3 |                           3 / 0 / 3 |                        2 |
| `/effects/` |             3 |                           5 / 0 / 5 |                        2 |

BFCache correctness tests in #141 remain separate evidence. Real mobile, other
browsers, display/power controls, internal capture/resource counts, GPU pass time
and actual VRAM remain unavailable.

Local collection history is preserved rather than silently pooled:

- `2026-10-20T20-51-09-264Z`: failed preflight; changing the GPU getter plus a
  visibility event did not reset the application's latched capability.
- `2026-10-20T20-52-43-202Z`: six-context 300 ms preflight, before final scenario
  refinements; excluded from baseline statistics.
- The first full run (`baseline.log`) was interrupted to replace smooth-scroll
  resets with explicit instant resets; excluded as incomplete.
- `2026-10-20T20-57-58-131Z` (`baseline-2.log`): the sole repeated baseline above.

Priorities supported by this run:

1. Profile attachment transitions during filtering, narrow dialog/search return
   and pattern replacement, using valid diagnostic timestamps and fixed output
   comparisons. Their recurring long tasks are a better starting point than
   steady layout work, which did not reproduce the retired controls' churn.
2. Evaluate smaller encodings for the four marketing PNGs while preserving the
   approved artwork and capture output. Their raw sizes dominate the measured
   cold transfer; deployed compression/network and image-decode costs still need
   separate evidence before claiming a latency improvement.
3. Extend native visibility evidence to other browsers/devices under #87.
   Establish website budgets under #37 before declaring any budget pass/fail.

**No runtime optimization is included in this measurement change.** The historical
redundant-control-write fix concerned retired UI and is not an outstanding current
fix. No equivalent current layout churn reproduced. Transition spikes warrant a
bounded follow-up investigation; these aggregate windows and invalid CPU sampling
timestamps do not justify speculative lifecycle/capture changes. Preserve native
interaction, fixed-time output and resource ownership in any later optimization.
