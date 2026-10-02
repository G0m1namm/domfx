# Public attachment layout and allocation investigation

Issue [#57](https://github.com/G0m1namm/domfx/issues/57) investigates the current
document scheduler and public ambient attachments. It does not change runtime
scheduling, clocks, admission budgets, or the separate #30/#31 release candidates.

## Reproduce

Install the repository's Chromium, then run `pnpm measure:layout`. The runner builds
the production fixtures, serves an ephemeral loopback port and opens six fresh visible
Chromium processes serially: no-effect and ambient-effect conditions at each of
1, 10 and 50 targets. Keep the window visible and avoid competing GPU work.
`DOMFX_BROWSER_EXECUTABLE` selects an alternative Chromium;
`DOMFX_POWER_MODE` and `DOMFX_REFRESH_RATE` record known operator observations,
otherwise they remain unknown. Playwright supplies its normal launch defaults
in addition to the recorded `--enable-unsafe-webgpu` argument.

Each baseline has the same target count, DOM, CSS and assets as its effect condition.
Targets are solid rounded 24 × 16 CSS-pixel blocks in one positioned grid host,
10 columns at most, with 80-pixel gaps. At viewport 1280 × 900 and DPR 2 every
target, including its 32-pixel capture padding, fits on screen. Padded rasters are
176 × 160 physical pixels. The fixture uses the exported `attachFire` with
`clock: 'ambient'`, seed 7, initial time 0, intensity 1 and the default motion policy.
Each attachment's existing ambient clock runs continuously after initialization;
the fixture introduces no shared clock. All geometry is static during steady trials.

Admission uses unchanged runtime budgets: 1,000,000 pixels per capture, 48 MB per
target steady state, 88 MB per target transient and 144 MB document aggregate.
Unavailable handles retain their reason and invalidate the requested condition;
the runner never substitutes a smaller active count. No-effect cases have zero
active effects, but still contain the requested number of visible DOM targets.

After serial `handle.ready` initialization and a one-second warmup, collect five
two-second ordinary trials. Raw rAF intervals measure responsiveness, not CPU
execution time or GPU duration. Lifecycle getters track minimum active and maximum
suspended counts on every sampled frame; all effect times must advance. Geometry
is checked only at trial boundaries. Page visibility changes and reduced motion
invalidate the trial. These checks add some JS overhead, including sample arrays,
and do not expose exact renderer frame counts or GPU completion.

One additional two-second diagnostic trial follows the ordinary trials. It enables
[CDP Performance](https://chromedevtools.github.io/devtools-protocol/tot/Performance/)
metrics with `timeTicks`, a timeline/V8 GC trace, 1 ms CPU sampling and
[heap sampling](https://chromedevtools.github.io/devtools-protocol/tot/HeapProfiler/)
at a 32768-byte interval, including objects collected by minor and major GC.
No forced GC runs. Diagnostic durations include profiler overhead and boundary
checks/transport; they must not be pooled with ordinary rAF trials. CPU profiles
retain call frames and sampled stacks; heap profiles retain allocation stacks and
statistical size estimates, not exact allocation counts. A heap-size delta is a
gauge change, not allocated bytes. The trace summary selects renderer-main-thread
complete Layout, UpdateLayoutTree, MinorGC and MajorGC slices; nested V8 GC phases
are retained in raw traces but not summed as additional pauses. User Timing marks
bound the sampled loop; the summary excludes profiler startup/shutdown and clips
overlapping slices to that interval. Missing event names
or zero samples do not prove absence of work. CDP layout/style counters provide a
second observation. CPU task/layout durations are never labeled GPU duration.

Actual GPU timing is unavailable on this public path: attachments do not request
timestamp queries. The separate `pnpm measure:steady` experiment remains the GPU
timing protocol. Adapter identity is queried using the same default adapter request
as the public renderer, without creating another device.

Initialization wall durations and one refresh per target are separate report fields,
outside all steady trials. Early attachments animate while later ones initialize.
Refreshes run serially after pausing every handle. Neither series is a cold-start or
SDF-only measurement. Cleanup disposes every handle and verifies no effect canvas
remains; exact managed-resource accounting is not exposed by the public API.

## Evidence and interpretation

Each run retains `.scratch/layout-performance/<timestamp>/report.json`, the build
log, exact production `dist`, screenshots, and one `.trace.json`, `.cpuprofile` and
`.heapprofile` per condition. The report contains revision/dirty state, lockfile and
build/asset hashes, installed dependency versions, OS/CPU, browser, adapter, viewport,
DPR, dimensions, motion/clock/activity data, raw samples and nearest-rank
P50/P95/P99/max distributions. Import traces and CPU/heap profiles into Chromium
DevTools; use the retained production code for URL/line/column attribution.
Local evidence is ignored and must be attached separately when sharing results.

Exit 0 means all six requested conditions completed with valid samples and cleanup;
it is not a performance gate or optimization approval. Failed, unavailable or partial
conditions remain explicit and exit nonzero. Ordinary trials repeat within a process;
repeat the command to check between-run variability. Serial condition order, driver
caches, background load, unknown thermal/power state and display refresh limit causal
inference. No prototype benefit can be claimed without a controlled comparison.

`pnpm test:gpu:full` covers the retained fixture in development and production,
including 50-target activity, raster dimensions, refresh, disposal, a matching baseline,
unavailable GPU and visibility invalidation. Tooling tests protect percentile ranks,
signed metric deltas and trace thread/GC selection. Correctness tests do not assert
hardware performance thresholds.

## Recorded result: 2026-09-16 UTC

Two complete runs with the final trace boundaries are retained locally:

- `.scratch/layout-performance/2026-09-16T15-43-47-856Z/`
- `.scratch/layout-performance/2026-09-16T15-45-41-308Z/` (table below)

Both used runtime revision `760502280f7ac5df85cdb59145ff991a22ffefcb`, with only
the lab/tooling/documentation investigation uncommitted, and identical production
build SHA-256 `fabf908c8dbbaeace4b473f1e44d67614db046e5eb4107afd802dbc5febf663a`.
Lockfile SHA-256: `1ee167840d7b50b1894866ffe2aeb172b8ae8d159fe65b7715a57476b454eeba`.
An earlier exploratory run at `2026-09-16T15-41-19-360Z` retained profiler-startup GC
in its summary; it is superseded for GC interpretation, not pooled with these runs.

Environment: Apple M5 Pro, Darwin 25.6.0 arm64, Node 22.22.3,
Chromium 153.0.8010.12, native default Apple adapter (`apple`, `metal-3`;
device/description strings unexposed), 1280 × 900, DPR 2, visible page,
reduced motion disabled. Browser/adapter/viewport/motion settings matched across
conditions. Display refresh, power mode, thermal state and competing system load
remain unknown. Observed ~33.3 ms rAF cadence is not evidence of physical display
refresh or a passing 60 Hz responsiveness gate.

Every effect condition admitted the full requested count and kept 1/10/50 active,
fresh, unpaused handles throughout sampled frames, with zero suspended or unavailable
handles and zero visibility changes. All padded target bounds were visible; all
effect rasters were 176 × 160. No resource-limited scenario occurred. All handles
disposed and all effect canvases were removed. Screenshots also show all 50 effects.

Ordinary rAF distributions, pooled across five two-second trials per condition
(milliseconds; raw per-trial distributions remain in each report):

| Targets | Effects | Intervals |  P50 |  P95 |  P99 | Maximum |
| ------- | ------- | --------: | ---: | ---: | ---: | ------: |
| 1       | None    |       302 | 33.3 | 33.9 | 34.1 |    34.2 |
| 1       | Ambient |       303 | 33.3 | 33.9 | 34.3 |    34.4 |
| 10      | None    |       303 | 33.3 | 33.9 | 34.2 |    34.3 |
| 10      | Ambient |       302 | 33.3 | 34.0 | 34.3 |    34.3 |
| 50      | None    |       305 | 33.3 | 33.9 | 34.2 |    35.2 |
| 50      | Ambient |       302 | 33.3 | 33.5 | 34.2 |    34.3 |

Effect-minus-baseline pooled P95 deltas were 0.0/+0.1/−0.4 ms at 1/10/50 targets.
The previous complete run gave +0.1/+0.3/−0.7 ms. Negative differences are noise or
uncontrolled timing effects, not evidence that adding effects improves performance.
No ordinary trial in either run had P95 above 34.2 ms. These observations do not
establish submillisecond equivalence or behavior on a slower device.

Separate instrumented windows, approximately two seconds each:

| Targets | Effects | CPU task total ms | JS script total ms | Sampled allocation MB | Main-thread major GC slices / total ms |
| ------- | ------- | ----------------: | -----------------: | --------------------: | -------------------------------------: |
| 1       | None    |            10.807 |              0.212 |                 0.198 |                                  0 / 0 |
| 1       | Ambient |            33.258 |             15.744 |                 0.262 |                                  0 / 0 |
| 10      | None    |            10.975 |              0.220 |                 0.197 |                                  0 / 0 |
| 10      | Ambient |           112.350 |             66.308 |                 1.806 |                              1 / 3.447 |
| 50      | None    |            11.171 |              0.233 |                 0.166 |                                  0 / 0 |
| 50      | Ambient |           153.703 |            106.729 |                 7.217 |                              3 / 3.437 |

MB means decimal million bytes and sampled sizes are statistical estimates. Script
time is part of task time; do not add these columns. The metric deltas cover CDP
boundaries, while GC totals are clipped to the marked animation loop. Both complete
runs recorded **zero LayoutCount and RecalcStyleCount increments**, zero corresponding
duration increments, and no Layout/UpdateLayoutTree slices within the marked loop.
That does not mean computed-style/geometry reads were free: their JS/native costs
remain in task time and CPU profiles. No MinorGC slices were exposed in these windows.
The latest maximum major-GC slice was 3.447 ms at 10 targets and 1.182 ms at 50.
There was no trace data loss. GPU duration is **unavailable**, not zero.

In the prior complete run, 50 targets had 152.177 ms CPU task time, 106.324 ms script
time, 7.942 MB sampled allocation and three major-GC slices totaling 3.653 ms.
Allocation attribution for the two 50-target profiles assigns 2.590–2.819 MB to
`scaleToViewport` and 1.213–1.344 MB to the `render` frame. Attribution uses saved
`experimental-ZvLDqvoK.js`, zero-based line 275, columns 12140 and 3305 respectively;
these are whole-function sampling locations, not individual allocation instructions.

Separate latest initialization totals were 30.9/101.9/333.3 ms, and paused serial
refresh totals were 10.1/58.3/239.0 ms for 1/10/50 targets. These single batches are
retained to establish separation from steady measurements, not compared to #30 gates.

## Decisions

**Read/write phasing: no-go for a runtime redesign from this evidence.** The measured
static geometry does not produce layout/style recalculations, so there is no observed
forced-layout cost for a phase split to remove. The existing placement equality check
already avoids unchanged layer-style writes. A phase split would add snapshot ownership
and cross-target ordering/cancellation obligations without a measured benefit here.
This does not establish that scrolling, resizing, animated geometry or deeper ancestry
cannot cause layout thrashing. A future report of such a workload should reproduce
its forced layouts first; an accepted change to frame ordering then requires the ADR
called for by #57.

**Allocation reuse: no-go for uniform staging or scheduler queue changes from this
evidence.** Allocation increases with active target count, but these profiles do not
isolate a responsiveness problem caused by either candidate. Allocation stacks in the
retained production bundle attribute much of the sampled work to `scaleToViewport`
(`Bn`, repeated computed-style/DOMMatrix traversal), placement/visibility helpers and
the render/present paths. The sampled `render` frame includes command descriptors,
arrays and wrapper objects; its total cannot be assigned to the four-float uniform
array. Statistical sampling likewise cannot establish that an unsampled scheduler
copy is free. Reusing one staging array has a small ownership cost, but its benefit
remains unmeasured. Reusing queues adds cancellation/reentrancy/frame-order obligations
and does not remove the dominant observed geometry work.

No isolated runtime prototype was needed for these conservative no-go decisions, and
no optimization saving is claimed. There is no justified implementation ticket from
this bounded workload. If a slower device or moving/deeper geometry supplies a
repeatable bottleneck, profile that scenario before selecting a candidate; any isolated
prototype must compare the same build/fixture settings and verify fixed-time pixels,
target isolation, cancellation and cleanup. Neither a general pooling framework nor
a global clock follows from these observations.
