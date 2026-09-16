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
