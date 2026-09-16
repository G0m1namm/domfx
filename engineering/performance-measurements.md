# Initialization and rebuild measurements

Issue [#30](https://github.com/G0m1namm/domfx/issues/30) measures candidate gates on a
specific environment. The gallery prerequisite [#27](https://github.com/G0m1namm/domfx/issues/27)
completed in PR #66; its live-gallery correctness checks remain in `pnpm agent:verify`.

Run `pnpm measure:performance` after installing Chromium as described in
[browser verification](browser-verification.md). This builds the production lab,
serves it on an ephemeral loopback port and opens visible Chromium. Keep the page
visible and avoid competing GPU work during collection. Each condition runs serially
in five freshly launched Chromium processes with temporary profiles. No profile,
browser process or browser HTTP cache is reused. OS filesystem and GPU driver caches
are not cleared; this is a **clean-profile start**, not a machine reboot.

The runner writes `.scratch/performance/<timestamp>/report.json`, ten fixture
screenshots and the build log. It records revision/dirty state, lockfile and production
bundle hashes, installed package versions, Node/OS/architecture/device, actual browser
version and GPU adapter, viewport, DPR, visibility, motion preference and asset
URLs/sizes/hashes/resource timings. Dirty builds are identified by their build hash.
Power mode and display refresh rate default to `unknown`; provide observed values
through `DOMFX_POWER_MODE` and `DOMFX_REFRESH_RATE` when known. They are explicitly
labeled operator-provided, never inferred from animation callbacks or battery level.
`DOMFX_BROWSER_EXECUTABLE` optionally selects a Chromium executable. This command uses
the native adapter; the actual adapter description is the evidence, not the request.

## Fixtures and timing boundaries

- **One target:** a 280 × 64 CSS-pixel headline containing system-font text and an `A`
  from the repository's original `block.ttf` fixture.
- **Two targets:** the same headline and the gallery's 96 × 64 transparent
  `silver-ring.png`, together in a positioned shared host. Both prepared GPU frames
  remain allocated until the batch completes. Targets are captured/prepared serially,
  matching the renderer's serialized preparation. The gate applies to the entire batch.

The viewport is 1280 × 900 with actual DPR 2. Both conditions use 32 CSS-pixel
padding, matching the public attachment default. The expected padded rasters are
688 × 256 and 320 × 256 physical pixels; every raw sample records actual dimensions.
This bounded fixture uses the existing capture API and experimental renderer export.
It does not measure the public attachment lifecycle or all five gallery classes.

Asset readiness starts in the fixture module. Font loading plus `document.fonts.ready`
and, for two targets, `image.decode()` run concurrently. Their individual durations,
combined elapsed wait and navigation-to-assets-ready timestamp are separate fields.
Required asset failures fail the fixture; they cannot produce passing timing gates.
Local assets have no artificial delay or network throttling in the measurement run.

**Initialization** starts after assets are ready, before dynamic imports of the browser
and experimental GPU package exports. It includes module loading, GPU service/fire
pipeline creation, lazy capture-adapter loading, first capture and SDF preparation for
the whole batch. It ends after GPU queue completion. Import, service and first-rebuild
durations are also recorded separately. Navigation-to-first-SDF elapsed time is retained;
page loading and initial font/image waiting are outside the initialization candidate.

In the fifth profile of each condition, after the cold sample, collect **three warmups
and 30 rebuilds** with the same service and ready assets. Every batch starts at capture
and ends after all target SDF work completes, using `performance.now()`. Rebuilds
include capture's necessary RGBA readback, upload, JFA, resource allocation and capture
frame release. Explicit queue completion is awaited. They exclude diagnostic SDF
readback, numerical oracle work, fire rendering and prepared-frame destruction.
Warmup samples are retained separately and never enter P95. SDF readbacks after the
cold batch and final warm batch check finite inside/outside output outside timing;
the full numerical oracle remains in the existing correctness suite.

## Candidate gates

| Gate                                     | Required evidence                              | Candidate                 |
| ---------------------------------------- | ---------------------------------------------- | ------------------------- |
| Initialization, separately per condition | Five completed clean-profile starts            | Maximum ≤ 2000 ms         |
| Warm rebuild, separately per condition   | Three warmups followed by 30 completed batches | Nearest-rank P95 ≤ 300 ms |

For 30 samples, P95 is the 29th ascending value. Each gate reports `pass`, `fail` or
`untested`, its fixed limit, measured statistic, sample count and `held` state. A
threshold breach is `fail` even with incomplete evidence. Missing/invalid samples,
failed fixture checks, visibility changes, unavailable GPU or browser errors prevent a
pass. `fail` and `untested` remain held. The runner saves results after every profile,
continues collecting the remaining profiles after a failure, and exits 0 only when all
four gates pass; otherwise it exits 1. A missing browser or unavailable GPU is never a pass.

`pnpm check` tests inclusive limits, P95 rank, incomplete evidence and held failures.
Development/production browser checks exercise the raw counts/dimensions, separate
asset readiness, delayed GPU completion, SDF checks, cleanup and unavailable GPU.
These tests verify the protocol and never assert hardware performance thresholds.
The dedicated runner evaluates candidate gates using fresh production measurements.

Results describe only the recorded machine, assets, dimensions and profile conditions.
They do not establish steady-render GPU performance, cross-device guarantees or
portable budgets. The spike's old warm P95 is not a new measurement. A failed candidate
requires investigation or an explicit contract decision; do not relax its limit.

## Steady animation and no-effect baseline

Issue [#31](https://github.com/G0m1namm/domfx/issues/31) uses `pnpm measure:steady`.
The same runner builds production assets and records the source, dependency, asset,
OS, browser and GPU identity described above. Evidence goes to
`.scratch/steady-performance/<timestamp>/report.json`, with build logs and screenshots.
It runs no-effect, one-target and two-target conditions serially, each in a fresh
visible Chromium process. All conditions display **both** fixture elements, load the
same font/image, and use the same viewport, DPR, seed (7), intensity (1), and elapsed
rAF clock reset to zero per trial. Browser/adapter/capability/environment mismatches
hold the overall result. Display refresh and power mode remain operator-provided or
`unknown`; neither is inferred from rAF.

The lab uses the experimental renderer with canvas presentation and fixed placement.
Capture and SDF preparation happen once before a one-second animation warmup, followed
by five two-second trials per condition. The same prepared frames remain allocated
throughout. There are no rebuilds, diagnostic pixel readbacks, or awaited GPU completion
inside a trial. Per-frame counts, page visibility changes, reduced-motion state and
padded target bounds guard against inactive or offscreen work being mistaken for low
cost. This measures active fire rendering/presentation, not the public attachment's
observer or placement overhead. It does not exercise suspension performance.

When the adapter supports `timestamp-query`, only the measurement renderer requests
it. Caller-owned timestamp writes bracket each actual fire pass. Raw unsigned 64-bit
nanosecond pairs are saved as decimal strings; their differences are converted to
milliseconds and summed across targets for each animation frame. Each trial's
nearest-rank P95 must be **≤6 ms**, so a pooled statistic cannot hide a slow trial.
This GPU duration excludes uniform uploads, queue gaps, presentation texture copies,
browser compositing and SDF work. Equal quantized timestamps are retained as zero
elapsed time; invalid/reset timestamps fail collection. The no-effect baseline submits
no render passes and has no GPU samples: its GPU duration is not fabricated as zero.
It supplies the rAF/CPU responsiveness comparison against both effect conditions.
See the [WebGPU timestamp example](https://developer.chrome.com/blog/new-in-webgpu-121#timestamp_queries)
for the pass timestamp/resolve mechanism.

Without timestamp queries, the fallback is explicitly **responsiveness, not GPU time**.
All five two-second trials must individually have **P95 rAF interval ≤20 ms** and
**no main-thread long task >50 ms**. A pass requires `DOMFX_REFRESH_RATE=60`, supplied
only after observing the display setting, and a supported long-task observer. Unknown
or other refresh rates, missing observations, unavailable GPU, visibility changes,
partial trials and browser errors cannot pass. Automated tests simulate capability
absence to verify collection; they do not establish a physical 60 Hz measurement.

The report retains raw rAF intervals, CPU submission wall times, GPU timestamp pairs,
long tasks and per-target render counts. It reports signed effect-minus-baseline P95
rAF and CPU submission deltas (positive means added cost), GPU P95, unchanged candidate
limits and held gate states. Inapplicable gates remain `untested`; their
`observedLimitExceeded` field still records any measured threshold breach. CPU submission includes uniform writes, encoding, submit
and presentation calls; it is never labeled GPU time. Current prepared-frame bytes
and instrumentation bytes are recorded. Timestamp instrumentation has at most 4096
query slots plus two 32768-byte buffers, resolved/mapped once **after** each trial;
query storage is implementation-dependent. Slot exhaustion fails rather than dropping
samples. Timing resources are destroyed after each trial; layers and frames are
released on completion/failure. Normal attachments do not request timestamps.

These measurements include instrumentation overhead. They do not estimate that overhead
as a separate uninstrumented GPU measurement, establish end-to-end GPU frame time, or
make a cross-device performance guarantee. Serial condition order, driver caches,
background load and power management can affect deltas. A breach stays failed with
its original threshold; investigate it instead of adjusting the candidate.
