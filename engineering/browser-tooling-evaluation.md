# Browser tooling evaluation — issue #88

> Historical baseline: these timings cover the former lab workflow. The website is now the demo surface; routine verification uses GPU-independent website smoke, and full GPU fixtures are opt-in under `tests/gpu`. The timings below do not measure the new workflow.

## Decision

Retain Playwright Test and pnpm for complete verification. No candidate established
a faster complete workflow with the existing checks. This is a bounded no-go for
migration on the measured macOS environment, not proof that Playwright is universally
fastest. GitHub Actions' temporary static-check/build policy remains unchanged.

| Candidate                            | Decision                                                 | Evidence and cost                                                                                                                                                                                                                                     |
| ------------------------------------ | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Playwright 1.63.0 + pnpm 11.5.0      | Retain                                                   | Three complete passing workflows; median 495.68 s. Existing isolation, assertions, evidence validation and diagnostics stay available.                                                                                                                |
| Puppeteer Core 25.12.0               | Limited to standalone experiments; defer suite migration | Driver-only median 1.816 s versus 1.893 s, a 4.0% difference on a small workload. No equivalent complete runner was implemented or measured. Porting fixtures, locator assertions, clock control, traces and report validation would add maintenance. |
| Rustwright 0.3.0 Node binding        | No-go for the current suite                              | Published contexts explicitly lack cookie/storage isolation; routing, locators, media/viewport control, page events and tracing are absent from the published declaration surface. No incomplete suite was counted as passing.                        |
| Project-specific server lifetime     | Do not adopt for speed                                   | A representative serial subset had medians of 6.808 s split versus 6.434 s combined, including startup and cleanup. No full-workflow improvement was demonstrated.                                                                                    |
| Vite+ 1.0.0 task orchestration/cache | Defer                                                    | Warm uncached library builds were slightly slower; cache hits saved about 1.1 s per build. Restoration and invalidation probes passed, but no complete cached workflow was measured. Adds a tool/configuration dependency for a small measured stage. |
| Minimal repeated-build removal       | Defer implementation                                     | The repeated warm library build is approximately 1.2 s, about 0.24% of the complete workflow. This attributable opportunity is smaller than the observed 7.92 s full-run range; it is not a measured workflow gain.                                   |

There is no qualifying challenger to rank above the incumbent. These decisions do
not mark every acceptance checkbox in [#88](https://github.com/G0m1namm/domfx/issues/88)
complete. In particular, full alternative-runner/cache workflows, Linux reliability,
and peak process memory remain unmeasured. No production dependency, script, fixture,
rendering budget, assertion, concurrency setting or CI policy was changed.

## Comparison contract and environment

The criteria were stated before running prototypes: prioritize repeated complete
wall-clock time beyond the observed spread, preserve correctness/reliability and
the verification contract, and treat subset results separately. No optimization may
win by shortening observation windows, reducing raster budgets, dropping diagnostics
or sharing test page state. Migration also needs equivalent capabilities and cleanup.

Measurements were taken on 2026-10-02 UTC from clean revision
`b31832a873aceaa3c3cdac8063f7f18df4fc2e73`, newer than the issue's merged groundwork.
All three harness source snapshots matched before and after execution:
`7748364788aeb4c36edae9bdbf354b07e436714193dee00bc9c3b390f69ad146`.

- macOS 26.6.2 / build 25G83, arm64, Apple M5 Pro, Mac17,8, 18 logical CPUs,
  24 GiB RAM; Node 22.22.3 and pnpm 11.5.0.
- Full Chromium 153.0.8010.12 from Playwright cache revision `chromium-1243`;
  native WebGPU, adapter vendor `apple`, architecture `metal-3`.
- Browser executable SHA-256:
  `8319963f6625accf51c0dd4f55091ceaf9f09ed39e7a52fed4fae12b2a6b668a`.
- Lockfile SHA-256:
  `24ab1b4beed70ccd4680614378ae2c4628113770a8bf83a6b967f2e14002d37f`.
- One browser test worker, zero retries, sequential lab/website workflows. Library
  builds retain pnpm's dependency ordering, with browser/GSAP builds able to overlap
  after core. The Vite+ wrapper runs one outer task with the same underlying pnpm command.
- Lab defaults: 1280 × 900, DPR 2; existing cases also exercise DPR 1. Website
  defaults: 1440 × 1000, DPR 1, with existing case-specific viewport/DPR overrides.
  Reduced motion is disabled by default. Existing configuration/launch flags remain intact.

Complete runs execute `pnpm agent:verify`, followed by `pnpm test:web`. The harness
includes `pnpm check`, the production lab build and development/production browser
checks. Website verification includes its library/Astro builds and both projects.
No task/result cache skips command execution; normal compiler incremental state is
preserved. Each project owns fresh browser
contexts. `DEBUG=pw:webserver,pw:browser` was constant across baseline runs to retain
startup/cleanup logs; these are instrumented local timings, not CI estimates.

The first run is reported separately from repeat runs. Neither OS caches nor machine
state were reset; “first” does not mean a cold machine. Each browser launch uses a
fresh profile. Native Chromium emitted CVDisplayLink warnings in stderr; the raw logs
retain them. Required rendering checks and page-error assertions passed.

## Complete workflow samples

Times are seconds, including child command startup and teardown.

| Run       | Repository check | Lab build | Lab browser command | Harness total | Website total | Complete total |
| --------- | ---------------: | --------: | ------------------: | ------------: | ------------: | -------------: |
| 1, first  |           21.643 |     1.307 |             360.069 |       383.400 |       119.993 |        503.393 |
| 2, repeat |           16.355 |     0.975 |             360.720 |       378.447 |       117.029 |        495.476 |
| 3, repeat |           16.244 |     0.984 |             360.504 |       378.108 |       117.570 |        495.678 |

Median complete time: **495.678 s**; range **495.476–503.393 s**, spread **7.917 s**.
The two repeat runs range **495.476–495.678 s**; two samples alone are insufficient
to establish a stable warm-workflow distribution.

Every run passed **402 lab cases and 100 website cases**, across both projects,
without skips, unexpected failures or flaky results: **3/3 complete runs passed**.
Harnesses validated browser evidence and unchanged source identity. The earlier
400-case result in the issue is not the same revision/workload.

### Critical path attribution

In run 3, summed lab test durations were 355.870 s within a 360.504 s browser
command; website test durations were 110.695 s within its 117.570 s build/test
workflow. Together, test durations account for about **94%** of complete wall time.
They include test fixtures, input waits, capture and GPU work; they are not isolated
GPU execution times or driver CPU times.

- Lab servers took about 0.735 s total to become ready; website servers took
  about 1.895 s. Server termination logs span approximately 9 ms for lab and 20 ms
  for website in run 3.
- Browser OS process spawning was about 1 ms per launch. This log milestone is
  **not** CDP/browser readiness. Actual awaited launch/readiness is measured separately
  in the standalone driver trial; full-suite readiness is not independently isolated.
- Browser closes in run 3 took approximately 44/47 ms for lab projects and
  57/54 ms for website projects. Those costs are already in workflow totals.
- Run 3 log arrival boundaries attribute about 1.23 s to the library build,
  3.58 s to recursive typechecking, and 0.91 s to recursive numerical/adapter tests.
  Tooling tests plus packed-contract preparation/checks occupy about 8.66 s between
  their first launcher and recursive typecheck startup. Raw milestones retain each
  package's build/typecheck start and completion; these are wall intervals, not CPU profiles.
- Lab file totals include `steady.spec.ts` 114.863 s, `lab.spec.ts` 42.323 s,
  `stress.spec.ts` 30.541 s and `accessibility.spec.ts` 24.203 s. The steady cases
  and public soak deliberately observe activity over time. Website file totals include
  `site.spec.ts` 46.049 s and `documentation.spec.ts` 37.414 s.

Server startup and duplicate builds are small opportunities on this machine.
Do not shorten the required steady/soak sampling to claim a tooling gain. Bun or
bundler replacement was not trialed: CPU tests/builds are a small part of this measured
critical path, and changing them would require a separate compatibility experiment.

## Driver capability screen and trials

The screen uses features present in the repository, not headline upstream claims.

| Used capability                                         | Playwright Test                       | Puppeteer Core 25.12.0                                                                   | Rustwright Node 0.3.0                                    |
| ------------------------------------------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Isolated contexts/storage                               | Existing suite                        | Verified in trial with fresh contexts and a localStorage sentinel                        | Declarations explicitly describe nonisolating shims      |
| Routing, init scripts, page errors                      | Existing suite                        | Different APIs; interception/init/page-error smoke checks passed                         | Required surface absent                                  |
| Real pointer/keyboard input                             | Existing suite                        | Click and Enter activation passed                                                        | Click/fill exposed; required keyboard surface absent     |
| Locator assertions and virtual page clock               | Existing suite                        | Requires porting; no Playwright assertion/clock compatibility established                | Required surface absent                                  |
| Viewport/DPR/media emulation                            | Existing suite                        | Matched in trial                                                                         | Required configuration absent                            |
| Screenshots, test traces, JSON attachments              | Existing suite and harness validation | PNG passed; Chrome performance tracing is not a Playwright test trace/report replacement | Screenshot exposed; required trace/report surface absent |
| Runner fixtures/projects and complete evidence identity | Existing suite                        | Must be supplied and maintained separately                                               | Must be supplied and maintained separately               |

Rustwright screening inspected the actual published `index.d.ts` in the 0.3.0 npm
tarball, SHA-256 `1c863eecb67cb6c8c27f3ea1441b94971559da8f9ad97bcaf185bdbaee49da6d`.
Its Python client/driver residency claims do not measure Node or total Chromium
memory. See the [published Node limitations](https://github.com/Skyvern-AI/rustwright#limitations)
and [Node declarations](https://github.com/Skyvern-AI/rustwright/blob/main/node/index.d.ts).

The final driver trial alternated ordering over five launches per driver. Both used
the same full Chromium executable, copied launch flags, pipe transport, native Metal,
1280 × 900/DPR 2, production assets and assertions. Puppeteer used
`ignoreDefaultArgs: true`, `pipe: true`, `waitForInitialPage: false` to match
Playwright's no-initial-window launch. Server startup was outside these **driver-only**
samples. Each launch ran one first-context workload and one warm-browser workload
with a new isolated context; warm never reused test page state.

The workload checked real button/Enter activation, init scripts, context isolation,
real shared capture/GPU output and resource cleanup, delayed preparation cleanup,
420 failure-classification checks, intercepted broken-image rejection with preserved
DOM and zero temporary nodes, page errors and PNG screenshots. Underlying numerical
and lifecycle fixture assertions remained active. It is a narrow driver comparison;
it does not implement all locator waits, console-error checks, clock emulation,
runner failure traces or complete report validation.

| Driver / trial | Awaited launch | First-context workload | Warm-browser workload | Browser close | Total |
| -------------- | -------------: | ---------------------: | --------------------: | ------------: | ----: |
| Playwright 1   |          0.208 |                  0.872 |                 0.814 |         0.046 | 1.945 |
| Playwright 2   |          0.134 |                  0.874 |                 0.820 |         0.040 | 1.873 |
| Playwright 3   |          0.134 |                  0.890 |                 0.836 |         0.044 | 1.910 |
| Playwright 4   |          0.124 |                  0.908 |                 0.818 |         0.038 | 1.893 |
| Playwright 5   |          0.156 |                  0.866 |                 0.802 |         0.043 | 1.873 |
| Puppeteer 1    |          0.137 |                  0.837 |                 0.795 |         0.042 | 1.816 |
| Puppeteer 2    |          0.146 |                  0.820 |                 0.800 |         0.041 | 1.813 |
| Puppeteer 3    |          0.143 |                  0.834 |                 0.766 |         0.041 | 1.790 |
| Puppeteer 4    |          0.144 |                  0.836 |                 0.803 |         0.040 | 1.828 |
| Puppeteer 5    |          0.124 |                  0.844 |                 0.816 |         0.041 | 1.831 |

Playwright median total **1.893 s**, range **1.873–1.945 s**; Puppeteer median
**1.816 s**, range **1.790–1.831 s**. First-context medians were 0.874/0.836 s;
warm-browser medians 0.818/0.800 s. Final trial failures: **0/5 per driver**.
Both report the same browser version/user agent, viewport/DPR and adapter identity.
Browser/context closure completed and the owned preview port was closed afterward.

Failed pilots remain separate. Puppeteer's initial-page default timed out on the
copied no-startup-window launch (five recorded timeouts). An overlapping replacement
run and later server-interruption errors invalidated pilot timing/output ownership.
Those samples are excluded from speed estimates, not reported as successful runs;
the final trial used a separate output directory after all pilot processes ended.
No full-suite Puppeteer reliability rate or speedup can be inferred from the corrected trial.

## Server lifetime and task-cache experiments

The lifetime trial kept one worker and identical inherited assertions, traces,
screenshots and rendering settings. It compared both servers owned by one test
invocation with two serial invocations, each owning one server. Five representative
cases ran in each project: real input after composition rejection, shared real GPU
capture/cleanup, delayed preparation, routed delayed image capture and failure identity.
No suite configuration was retained.

| Trial | Combined servers/invocation | Split project invocations |
| ----- | --------------------------: | ------------------------: |
| 1     |                     6.876 s |                   6.786 s |
| 2     |                     6.427 s |                   6.808 s |
| 3     |                     6.434 s |                   6.881 s |

Median split time was **0.374 s slower**. All 60 selected case executions passed,
without skips/flaky results, and both ports were closed afterward. This subset did
not justify expanding the prototype to a complete workflow or adopting it for speed.
Peak-memory consequences of running one rather than two servers were not measured.

Vite+ used an isolated archive of the same revision with its own frozen pnpm install.
Only task orchestration/cache changed; `pnpm build`, TypeGPU's existing Vite transform,
the patched SDF dependency and Astro commands remained intact. Outer concurrency was
one; nested pnpm build concurrency was identical in both arms. Task-cache entries were
cleared before each cache-miss sample. Machine/OS caches were not cleared.

| Trial        | Direct pnpm library build | Vite+ cache miss | Vite+ cache hit |
| ------------ | ------------------------: | ---------------: | --------------: |
| 1, first use |                   3.270 s |          3.509 s |         0.082 s |
| 2, repeat    |                   1.155 s |          1.243 s |         0.083 s |
| 3, repeat    |                   1.157 s |          1.247 s |         0.084 s |

In the prototype, explicit cache inputs cover package sources/configuration, the
lockfile, workspace manifest and SDF patch; outputs cover all three package `dist`
trees. `NODE_ENV` and `DOMFX_*` are included in the build environment fingerprint.
Deleting all three output trees and hitting the cache restored the exact directory
digest (`f86e39f198366f721bfd9b34449c88ee0a6017784c07afea4a97fe881b398979`).
Source and lockfile edits each caused a cache miss. An uncached probe received
`DOMFX_GPU_BACKEND`, `DOMFX_BROWSER_OUTPUT_DIR` and `DOMFX_BROWSER_EXECUTABLE` intact.

Packed strict declaration/Node-import contracts, the production lab build and Astro
production build passed in the prototype. A complete browser/GPU run using restored
outputs, packed GPU consumers and release rehearsal were **not** run in this prototype;
it is not qualified for adoption. Evidence-producing harness/browser/performance/release
commands stayed outside the cache. The complete direct pnpm path remains available.
See [Vite+ task semantics](https://viteplus.dev/guide/run) and
[cache semantics](https://viteplus.dev/guide/cache); `vp test` invokes Vitest and is
not a replacement for Playwright Test or domfx's complete `check` contract.

## Evidence, reproduction and remaining limits

Raw local evidence is retained under `.scratch/tooling-88/`:

- `baseline/`: environment, raw samples, per-run timestamped log chunks, original
  harness verification/browser reports and copied website reports/screenshots.
- `summary.json`: per-run source snapshots, package-command milestones, per-file
  test durations and server/browser lifecycle log intervals.
- `drivers-final/`: qualifying driver samples, launch flags, actual browser/adapter
  identity, fixture results and screenshots. `drivers-pilot*` and `drivers-overlap/`
  retain invalid/failed pilot evidence separately.
- `servers/`: all invocation logs and project reports, raw elapsed samples.
- `vite/`: raw build/cache/probe logs and restoration/environment results;
  `vite-prototype/` and `candidates/` hold the isolated pinned experiment.
- `evidence-identities.json`: browser executable identity and production/package
  directory hashes recorded after the unchanged-source trials. These post-run hashes
  are not per-run asset attestations; harness snapshots are the per-run source evidence.

These ignored artifacts and prototype scripts are local evidence, not public
repository dependencies. Raw numeric samples are transcribed above so the decision
does not depend on access to the originating workspace.

To repeat the complete baseline, install the repository's pinned dependencies and
full Chromium, keep the worktree idle, and time these commands sequentially three times:

```sh
DEBUG=pw:webserver,pw:browser pnpm agent:verify
DEBUG=pw:webserver,pw:browser pnpm test:web
```

Retain each harness directory and copy `.scratch/web/` before its next run replaces
it. Record monotonic start/end time for each command, source/lockfile/browser identity,
backend and concurrency; retain nonzero exits and incomplete reports. Server-lifetime
and candidate driver/cache results are separate experiments, not parts of the baseline.
The local orchestration scripts also retain timestamped output for attribution.

**Peak process memory was not collected.** RSS/PSS/physical footprint, JS heap,
shared-page accounting and driver/GPU-process residency are unavailable measurements,
not zero or evidence of improvement. Managed GPU buffer/reservation cleanup assertions
are correctness checks, not process-tree peak memory or total VRAM measurements.
Concurrency was not increased, and no upstream Python memory claim was extrapolated.

Linux Actions failures described in #88 remain unresolved. This native macOS evidence
does not establish SwiftShader/Linux, other-browser/device, physical device-loss or
long-session reliability. The earlier headless-shell and Lightpanda screens were not
rerun and are not new candidate results. Dedicated memory profiling does not block
the supported decision to retain the incumbent, but any future concurrency change
needs simultaneous process-tree sampling and reliability checks.

No implementation follow-up is justified by an established complete-workflow gain
in this experiment. Reconsider a candidate when its Node surface supports the missing
contract or attribution identifies a material build/driver bottleneck. Any proposed
adoption must then run repeated complete equivalent workflows, retain failed samples,
and perform the packed GPU/SSR/type/Astro and release checks relevant to the change.
