# Production homepage performance baseline

Issue #86 measures the editorial homepage from #89, including four authored Fire
targets, the independent GSAP player and the optional Prism WebGL background. Run
`pnpm build:web`, then `pnpm measure:homepage` with a quiet, visible WebGPU-capable
machine. The runner serves the exact `apps/web/dist` files on a loopback port and
stores ignored evidence under `.scratch/homepage-performance/<timestamp>/report.json`.
Set `DOMFX_BROWSER_EXECUTABLE` to select Chromium, and record known display refresh
and power mode with `DOMFX_REFRESH_RATE` and `DOMFX_POWER_MODE`. Its default matrix
uses 1440 × 900 at DPR 1 and 2 and 360 × 780 at DPR 2, three fresh contexts per
Fire/None condition, one-second warmup, and three 1.5-second steady samples in each.
The first context also exercises scrolling, quick intensity changes, Pause, reduced
motion, offscreen and hidden return, the background and GSAP player, warm navigation
and teardown. Increase repetitions with `DOMFX_HOMEPAGE_TRIALS`; set
`DOMFX_HOMEPAGE_DURATION_MS` for each ordinary window.
The first None context for each profile also runs `captureElement` once per
configured trial per authored target after all ordinary comparisons (three trials
by default). These time the existing
capture adapter against the production DOM with the current flame-height-derived
padding; they are isolated diagnostic calls, not the site's startup capture
intervals. The runner records each effect canvas insertion time during
initialization as an attachment proxy. It attempts a second native tab after the
separate synthetic visibility check and reports native hide/return only if the
original tab actually becomes hidden. Adapter `timestamp-query` support is
recorded without making a GPU timing claim about the public attachment path.

Fire/None uses the same production page and assets. The player and background start
still. Their still/play comparisons run after selecting None and scrolling the same
page to each component. Keep the browser visible and the machine free of competing
builds or GPU work. Raw response resource timing, local raw/gzip/Brotli asset sizes,
load wall time, browser navigation timing, first Fire canvas time, rAF intervals,
long tasks, CDP task/script/style/layout counters, JS heap gauges, Chromium process
RSS, target dimensions and effect canvas dimensions are retained per condition. One
separate diagnostic window per profile/condition retains a CPU profile, sampled
heap allocation profile and timeline/GC trace. Diagnostic windows include profiling
overhead and must not be pooled with ordinary trial distributions. The same static
media and build serve both controls. All built files are fetched and consumed in each
context before steady sampling to equalize browser-cache asset sets; only Fire parses
and runs its lazy JS chunk. The first Fire context also selects None after steady
trials and collects three more windows on the same loaded page, then checks Fire
reattachment. This paired control retains the already loaded JS, media and page
state. Cold load remains a separate observation.
The hidden-page control overrides `document.hidden` and dispatches a visibility event,
as the website test does; it is synthetic lifecycle evidence, not a native tab-hide
measurement.
First canvas is an initialization proxy, not an exact capture or GPU interval.
RSS covers the browser's reported processes, includes shared browser overhead,
and cannot be assigned exclusively to one target. Heap deltas are gauge changes,
not allocated bytes. Long-task observation does not capture all main-thread work.
The public homepage exposes no exact live capture count, managed GPU reservation
count or GPU timestamp. Canvas additions/removals expose a subset of attachment
churn; canvas pixel counts do not measure GPU usage. Allocation sampling is
statistical, not an exact count. Inspect retained traces/profiles before
attributing a repeated hotspot, and report unavailable quantities explicitly.

The runner records every condition and failure; exit zero means collection completed,
not that a performance budget passed. #37 owns website budget decisions, so this
baseline is descriptive. Do not extrapolate from desktop emulation to real mobile
hardware. Compare any candidate with the same build, controls and asset state, and
use the fixed-time output and lifecycle checks before considering a runtime change.
The static 1/10/50-target result in
[layout allocation investigation](layout-allocation-investigation.md) found no
forced layout in its steady fixture; it does not establish the cost of this page's
ordinary scroll or changing geometry.

## Baseline recorded 2026-10-18 UTC

The reviewed complete run is retained locally at
`.scratch/homepage-performance/2026-10-18T22-19-28-724Z/`; earlier runs at
`2026-10-18T21-53-17-235Z/` and `2026-10-18T22-05-03-879Z/` are superseded
because their lifecycle or component controls were incomplete. Source revision
`eb97f5d3f8726de66b9c77946c3e0272e7970ef9` had only this task's
tooling/documentation edits uncommitted. The reviewed measurement script SHA-256
was `3936f616c249cf83fd7df3bf628491cdb5eae2e8d527a47839bfaa5f657173c9`.
The complete run's warm reloads preserved the player-area scroll position and
therefore showed no visible Fire canvases. Those warm observations are also
superseded. The corrected six-condition warm-only supplement is retained at
`.scratch/homepage-performance/2026-10-18T22-31-41-661Z/`, using amended script
SHA-256 `a0c32c21acd17e1a97cfb0d5e75d49238a7959a6041dc8093f91e4e0f522011f`.
It used the same source, production build and lockfile. Every reload started at
scroll Y 0, remained there at `load`, and subsequently showed all three visible
authored hero targets with one canvas per host in Fire and no canvases in None.
Lockfile SHA-256 was
`0b7f551f3d596b3110054b88c410cb0cb0e187c34772f494c4d5a89bfeea64da`;
production `dist` SHA-256 was
`6f20cba1f8313b222cc5e789857e55978c17f564c926732b7c583c506099bd45`.
All 18 requested contexts completed without collection errors, all 40 asset warmup
requests per context succeeded, and six diagnostic traces reported no data loss.
The browser emitted 41 WebGPU warnings that the configured canvas format required
an extra copy on this device and nine SnapDOM repeated-capture warnings; these
may affect the measured path. Local PNG screenshots
show the editorial hero with three visible Fire targets at DPR 1/2. The installation
action is the fourth authored target and activates on scroll.

The machine was an Apple M5 Pro, macOS Darwin 25.6.0 arm64, Node 22.22.3 and
Playwright Chromium 153.0.8010.12 with the default Apple `metal-3` adapter.
Viewport profiles were 1440 × 900 DPR 1/2 and 360 × 780 DPR 2. Initial image,
SVG, heading and installation-action bounds were 381 × 286, 295 × 221, 224 × 107
and 144 × 44 CSS px on desktop; narrow bounds were 149 × 112, 142 × 106,
130 × 96 and 144 × 44 CSS px. Three hero targets were initially visible and
active with Fire; the installation action was below the viewport. The effect
canvas dimensions for the visible targets were 340 × 276, 340 × 276 and
308 × 191 at desktop DPR 1; 680 × 552, 680 × 552 and 616 × 382 at desktop DPR 2;
and 680 × 552, 680 × 552 and 428 × 360 at narrow DPR 2. Both motion preferences
were off and the page was visible during steady trials. Known physical display
refresh, power and thermal state were unavailable. An unrelated idle preview
process was present during preflight and left untouched.

The 40-file production build totals 1,600,125 raw bytes; local gzip and Brotli
calculations total 1,076,214 and 1,040,861 bytes. These are compression estimates,
not network transfers. This loopback server served uncompressed files. Initial
None navigation requested 794,434 encoded body bytes and recorded 797,734 transfer
bytes including resource-timing overhead. Lazy Fire imports can occur after `load`,
so cold `load` comparisons cannot isolate Fire startup cost. After initialization
and explicit equal-cache warmup, each context had fetched all 40 production assets;
resource timing recorded 1,612,125 transfer bytes for that entire build. This is
the test's deliberately warmed asset set, not a claim about normal visitor download.

Each cell below shows nearest-rank P50 / P95. Cold load has three fresh-context
samples from the complete run; warm reload has three samples from one fresh context
per condition in the corrected supplement. The reload clock ends at `load`; Fire
canvas insertion follows it. Steady rAF and task
values summarize nine 1.5-second windows per condition (three in each context),
after a one-second warmup. Task values are CDP main-thread `TaskDuration` increments
per window in milliseconds. rAF values summarize each window's P95 interval;
they are responsiveness observations, not GPU durations or CPU frame times.

| Viewport   | Effect | Cold load ms | Warm reload ms | Steady rAF P95 ms | Steady task ms | Layouts/window |
| ---------- | ------ | -----------: | -------------: | ----------------: | -------------: | -------------: |
| 1440 DPR 1 | None   | 61.3 / 122.9 |    27.2 / 43.5 |         9.2 / 9.2 |    22.6 / 27.7 |          0 / 0 |
| 1440 DPR 1 | Fire   |  48.7 / 49.4 |    19.3 / 36.7 |         9.2 / 9.3 |  215.8 / 269.7 |      181 / 181 |
| 1440 DPR 2 | None   |  48.3 / 74.0 |    23.6 / 24.9 |         9.0 / 9.2 |    14.8 / 31.0 |          0 / 0 |
| 1440 DPR 2 | Fire   |  45.2 / 50.6 |    17.5 / 35.6 |         9.0 / 9.3 |  228.7 / 265.4 |      181 / 185 |
| 360 DPR 2  | None   |  44.6 / 54.4 |    17.9 / 41.3 |         9.2 / 9.3 |    25.3 / 27.2 |          0 / 0 |
| 360 DPR 2  | Fire   |  43.5 / 47.4 |    21.9 / 35.1 |         9.2 / 9.3 |  207.6 / 274.2 |      181 / 183 |

The first Fire canvas appeared after navigation-start P50/P95 195.2/195.8 ms at
desktop DPR 1, 165.8/176.4 ms at desktop DPR 2, and 167.2/213.4 ms narrow.
The post-`load` wait was 122.3/135.2 ms, 105.7/106.9 ms and 111.8/141.5 ms,
respectively. Neither clock waits for all three captures or measures GPU readiness.
In the corrected warm supplement, first Fire canvas insertion after navigation
start was 98.4/102.1 ms, 109.8/129.2 ms and 103.3/105.3 ms for desktop DPR 1,
desktop DPR 2 and narrow DPR 2, respectively. These are separate from `load` and
from the later three-target assertion.
In the paired same-page control, switching Fire to None removed all effect canvases,
produced zero layout increments and 11–28 ms task increments in three further windows per
profile, then Fire reattached all three canvases. These paired windows retain the
parsed Fire code and loaded assets. Neither fresh-context nor paired comparison
showed a steady rAF P95 separation larger than the observed ~0.3 ms window range.
There were no observed PerformanceObserver long tasks in the ordinary windows.

One separate diagnostic window per profile/condition captured CPU, allocation and
GC traces. Fire traces showed 184–185 main-renderer Layout slices totaling
13.7–27.2 ms and 184–185 UpdateLayoutTree slices totaling 5.6–10.4 ms over about
1.5 seconds; None had no such steady slices. Fire sampled allocation was
2.95–3.09 MB versus 0.033–0.066 MB for None. The largest sampled Fire site was
the minified `scaleToViewport` function (`a_`), with 1.25–1.70 MB combined
sampled self size across its entries. Fire traces showed two or three main-thread
major-GC slices totaling 3.8–6.6 ms; these are
diagnostic observations with profiling overhead. Nested GC phases are not summed
into additional pauses. The same geometry traversal was prominent in #57's static
fixture, but that fixture had zero layout/style recalculations. This homepage does
recalculate layout during steady Fire, so #57's static no-go cannot settle the
moving-page question. The trace does not isolate whether app control writes,
placement reads or canvas presentation causes those layouts.

The single ordinary-scroll window per profile measured 131–173 layouts and
103–193 ms task work with None, versus 143–196 layouts and 145–220 ms with Fire.
Fire attached one installation-action canvas while hero canvases left view. The
intentionally rapid setting window changed intensity and flame height every
250 ms: Fire added 15 and removed 15–18 canvases, with 433–538 ms total task work,
versus 34–43 ms for None. Its maximum observed rAF interval was 33–42 ms, though
there was no >50 ms long task. These single windows identify churn under this
scripted stress, not a normal-user frequency or a stable scroll delta.

With Fire off, three still/play windows each were taken at the visible player and
background. The GSAP player had zero layout increments still and 181–182 per
1.5-second playing window, with playing task work 94–192 ms. Background still
and opt-in play both had zero layout increments; task work overlapped broadly
(roughly 14–33 ms still and 15–55 ms playing). rAF P95 for both components stayed
near 9 ms. The background's 30 fps WebGL draws are not GPU timed by this method.

At desktop Fire, three canvases remained attached under Pause, dropped to zero
offscreen, reattached to three on return, dropped to zero under the synthetic
hidden transition, and reattached to three on synthetic return. Reduced motion
removed all canvases and ending that preference did not silently resume. At the
narrow viewport, one canvas remained at document bottom because the installation
action was visible there; returning to the hero restored three. Navigation to
`about:blank` exercised teardown, but this runner does not inspect internal
resource destruction. Website lifecycle tests provide separate correctness
evidence; native tab hiding and return remain unmeasured here.

JS heap gauges after warmup were approximately 0.99–1.01 MB with None and
10.5–10.7 MB with Fire in the first contexts; trial heap deltas changed sign with GC and are not
allocated-byte counts. Chromium-process RSS was collected separately from CDP's
browser process IDs and `ps`; first-snapshot totals ranged roughly 0.89–1.16 GiB
across conditions. These totals contain the shared browser/GPU processes and
serially accumulated caches, so their Fire/None differences are not website
resident-memory deltas. The public attachment ledger cannot be read on this page.
Applying its documented steady-state `40 × canvas pixels + 20` byte formula to the
three visible canvases yields _logical reservation estimates_ of 9.86 MB at
desktop DPR 1, 39.44 MB at desktop DPR 2 and 36.19 MB narrow DPR 2. These are
admission-accounting estimates, not measured GPU memory usage; browser capture
intermediates, swapchain multiplicity and driver allocations are excluded. There
are no GPU timestamp queries on this public path.

## Decision and follow-up boundary

No website budget was approved in #37, so no pass/fail verdict is assigned.
**No broad optimization is approved from this baseline alone.** The later
controlled probe below isolated repeated Fire layout to unchanged homepage label
writes. Equality guards at those two writes are the bounded correction; the
remaining style and `scaleToViewport` allocation work has no demonstrated
responsiveness cost here. The rapid flame-height stress is lower priority: it triggers
expected recapture churn, and any app-level coalescing would need a real input
frequency and visual-response requirement before changing behavior. The player and
background evidence does not justify a rewrite. The WebGPU format warning is an
observed condition, not a measured bottleneck; any investigation must isolate its
cost and preserve rendered output correctness. Real mobile hardware, native
hidden-tab behavior, managed/GPU memory instrumentation and GPU pass timings remain
separate evidence gaps.

## Follow-up layout attribution, 2026-10-18 UTC

The baseline traces contained 184–185 full-document Layout events in each Fire
diagnostic window and none in the None windows. Each Fire Layout followed a
homepage script callback; the trace alone did not prove which operation dirtied
layout. The app calls `updateControls()` on every active Fire frame, including
unchanged assignments to the playback and system-motion labels. A bounded
page-side diagnostic suppressed only assignments of the existing text to those
two labels. It did not change application or library source.

Four fresh headed Chromium contexts ran serially at 1440 × 900 DPR 1 on the same
40-file production build (`6f20cba1f8313b222cc5e789857e55978c17f564c926732b7c583c506099bd45`):
None, Fire, guarded Fire, Fire. Each had three 1.5-second CDP Performance windows
after a 1.5-second warmup. Layout counts were 0/0/0 for None,
180/181/180 for Fire, 0/0/0 for guarded Fire, and 181/179/180 for the
return Fire control. The guard skipped 1,451 unchanged text assignments while
three Fire canvases stayed attached. All contexts reported the requested effect,
visible page and no page errors. Style recalculation stayed at 180–181 per
guarded window, so the experiment isolates the repeated layout invalidation,
not all style work. CDP task time overlapped across Fire and guarded Fire;
this small sample establishes neither a user-visible latency improvement nor a
budget result.

The probe used source revision `8d7eeecbf4faa1ea4609de19147b23abd09770d4`
with only measurement-script edits, lockfile SHA-256
`9fd9ab1136ae32a42690f0ef80763d4a47cf468cc8f2343cab20991d2b1f8b89`,
Playwright Chromium 153.0.8010.12 and ignored local script SHA-256
`0f7dd44d84ffdcfe37e85f4267069c87e9a6e6b7fb443c75206585f85db1adac`.
Raw windows remain in `.scratch/homepage-layout-probe.json`. The finding supports
guarding unchanged control text at its owning site call; later evidence must
verify real source changes, interaction, fixed-time output and lifecycle behavior.

## Guarded page comparison and remaining gaps

The production source then gained equality guards for the playback and system
motion label writes only. A website regression observed zero redundant mutations
over eight active Fire frames, while Pause/Resume and system motion text still
changed when their states changed. It failed against the original source (16
mutations in each development and production run) and passed after the guards
(2/2 focused browser cases). This is a label behavior check; unchanged broad
website verification is deferred to final combined integration.

Two complete, serial 18-context runs used the same earlier measurement script
SHA-256
`f964a21a2b4dee04dfc2c1732592292081a8f4998f4b2b8350d483ea958d95ca`,
lockfile SHA-256
`9fd9ab1136ae32a42690f0ef80763d4a47cf468cc8f2343cab20991d2b1f8b89`,
and source base `8d7eeecbf4faa1ea4609de19147b23abd09770d4`.
The pre-guard raw report is
`.scratch/homepage-performance/2026-10-18T23-44-08-807Z/report.json` with build
SHA-256 `6f20cba1f8313b222cc5e789857e55978c17f564c926732b7c583c506099bd45`;
the post-guard report is
`.scratch/homepage-performance/2026-10-18T23-51-16-226Z/report.json` with build
SHA-256 `e5751e62fb316c6ebcb8875669ac965e2cac3ceb5f504c6b1030cbc667b3da84`.
Both completed all 18 contexts without collection errors. These runs started
after a separate source-only check ended at 23:41:33 UTC; an earlier failed
instrumentation run that overlapped that check is excluded. Each profile had
nine ordinary steady windows for Fire and nine for None. Pre-guard Fire had
181–182 Layout increments per 1.5-second window across desktop DPR 1/2 and
narrow DPR 2; post-guard Fire had zero in every window. None had zero throughout.
Fire main-thread task increments varied and overlapped before and after, and
rAF P95 stayed around 9 ms; the runs do not establish a broad latency win.
This removes the specific repeated layout invalidation, not all style updates.

Canvas insertion timestamps in the first Fire context show heading, SVG and
image attachment at 176.4/182.1/190.2 ms from navigation start before the
guard and 181.8/187.5/197.9 ms after it at desktop DPR 1. Desktop DPR 2 was
179.7/187.6/195.2 ms before and 178.0/187.5/192.5 ms after; narrow DPR 2 was
174.4/185.2/191.6 ms before and 171.5/185.1/193.8 ms after. These are DOM
attachment proxies; they cannot separate capture, renderer preparation or GPU
execution. Both complete matrices used that earlier script, before the current
startup-observer disconnect change; they provide no retrospective performance or
latency claim about the current script. The public `captureElement` diagnostic in
those complete runs used
its default 32 CSS px padding, so its raster sizes and wall times do not match
the live Fire capture's 42 CSS px padding. A later bounded supplement with
script SHA-256
`88bc0e4b3716c84252727ca0933e4169d7ac27885145b939f90e4e325d65af5e`
used the post-guard build and recorded 42 CSS px padding. Its desktop DPR 1
first None context has three isolated serial samples for each authored target
in `.scratch/homepage-performance/2026-10-18T23-59-01-386Z/report.json`:
image 72.5/35.4/26.5 ms at 340 × 276 px, SVG 11.0/7.2/7.2 ms at
340 × 276 px, heading 9.2/6.1/6.1 ms at 308 × 191 px, and installation
action 13.3/8.2/11.5 ms at 228 × 128 px. This run was deliberately stopped
after the bounded supplement; its report retains `outcome: running` and seven
completed contexts and is not a third comparable matrix. None of these adapter
calls is a live page startup interval or GPU duration.

A separate bounded narrow DPR 2 probe closed the missing matched-padding row.
On the same post-guard build (`e5751e62fb316c6ebcb8875669ac965e2cac3ceb5f504c6b1030cbc667b3da84`),
headed Chromium 153.0.8010.12 on macOS 26.6.2 at 360 × 780 used the Apple `metal-3` adapter,
Fire None, still background/player and no reduced motion. Each authored target
was scrolled into view and checked for stable dimensions, visible paint and no
effect canvas before three serial public `captureElement` calls; every frame
was released. With the live flame-height-derived 42 CSS px padding, image
captures were 73.8/25.4/23.8 ms at 680 × 552 px, SVG 14.5/10.3/9.6 ms at
680 × 552 px, heading 18.9/8.7/7.6 ms at 428 × 360 px, and installation
action 24.3/11.4/10.7 ms at 456 × 256 px. The current runner script SHA-256
was `a9436e7b36917a1331977d48c134a12ea3dc82e2664c2810c504bbf1fa8bd8c1`;
the standalone probe SHA-256 was
`c647f50cde5bfb3787aac6bf64f069f737818d86f06cfdd89ef122f56584f5b5`.
Raw state, dimensions, wall times and errors are retained in ignored
`.scratch/narrow-capture-results.json`. These isolated captures are diagnostic
adapter calls, not visible Fire attachments, live startup intervals or GPU
timings. No full matrix ran with the current runner script.

The Apple `metal-3` adapter advertised `timestamp-query`, but the public Fire
attachment path did not request a query; GPU pass duration and actual VRAM
remain unmeasured. A second Chromium tab did not make the original tab report
`document.hidden` on this headed macOS host, so actual native hide/return is
unavailable. The separate synthetic visibility test remains lifecycle evidence
only. Process RSS and logical reservation estimates retain their original
limitations. Real mobile hardware was unavailable. With no approved website
budget or reproduced remaining bottleneck, broader runtime work is a bounded
no-go pending direct evidence on representative devices.
