# Browser verification

The website is the development and examples surface. Private `tests/gpu` pages
retain rendering/lifecycle regressions and optional measurements without a public
lab app. Both consumers use built package exports.

See the [tooling evaluation](browser-tooling-evaluation.md) for historical issue
#88 timings. Those measurements preceded this change in verification scope.

## Routine checks

```sh
pnpm --filter @domfx/web exec playwright install chromium
pnpm agent:verify
```

The harness runs repository checks, builds the production website, then verifies
five website smoke cases in both development and production. These inject missing
WebGPU: responsive layout, native navigation, loaded example assets and readable
documentation must still work. This is not successful GPU rendering evidence.
CI runs these gates and release metadata checks; full GPU tests stay local.
Each harness report identifies `verificationScope: website-smoke` and
`gpuVerification: not-run`. Failures retain screenshots and traces.

## Local rendering checks

| Command                                      | Coverage                                                                                                                                          |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm test:gpu`                              | Ten existing production smoke cases: real output, GSAP seeking/binding disposal, late disposal, refresh, motion, input and zero-size behavior     |
| `pnpm test:gpu:full`                         | All retained development/production capture, numerical, placement, assets, motion, clock, sharing, lifecycle, retry, stress and measurement cases |
| `pnpm test:web`                              | Complete development/production website tests, including public API examples and GPU pixels                                                       |
| `pnpm test:visual`                           | Production website screenshot comparisons, including paused Fire                                                                                  |
| `pnpm test:browser:evidence`                 | Production capture/numerical checks with raw JSON, images and environment identity                                                                |
| `pnpm test:packed` / `pnpm release:rehearse` | Fresh tarball consumers, real rendering and cleanup                                                                                               |

For a focused fixture run, build first and select its spec:

```sh
pnpm build:gpu
pnpm --filter @domfx/gpu-tests exec playwright test failures.spec.ts --project production
```

`pnpm test:browser` remains an alias for `pnpm test:gpu:full`. Tests never treat
missing GPU as a passing rendering check. The full fixture suite has one worker,
zero retries, and a ten-minute native limit. Long observations remain in the full
suite and the explicit `measure:*` commands, outside routine CI/harness verification.

Set `DOMFX_GPU_BACKEND=native` (default) for hardware rendering, or `swiftshader`
for software WebGPU. Linux software flags are retained for local investigation;
the earlier Linux rendering failures remain unresolved. Software rendering cannot
establish native performance or broad browser support. See the
[support record](browser-support.md).

## Capture alignment across engines

```sh
pnpm --filter @domfx/gpu-tests exec playwright install chromium firefox webkit
pnpm test:capture
```

This GPU-independent check measures colored landmarks in actual captured pixels
at DPR 1 and 2 in Chromium, Firefox and WebKit, in development and production.
It checks positioned HTML, fractional geometry, translation/scale, padding and
paint outside all four target edges. It also checks that capture preserves the
original element. Playwright WebKit is a regression engine, not installed Safari.

The capture uses HTML layout for its inset because WebKit can ignore SVG viewport
translations for positioned HTML inside `foreignObject`. See
[WebKit #23113](https://bugs.webkit.org/show_bug.cgi?id=23113#c62).
This check does not establish GPU output, native page zoom or mobile support.
Verify those separately on the actual browser, comparing the rendered shape with
the original target after scrolling, resizing and pausing.

## Placement and native zoom

`pnpm test:placement` checks the actual private Floating UI adapter without a GPU
in Chromium, Firefox and Playwright WebKit, development and production, at DPR 1/2.
The real-GPU placement and lifecycle tests remain part of `pnpm test:gpu:full`.
Geometry-only results do not establish captured pixels or rendered output.

For installed Safari, build with `pnpm build:gpu`, serve `tests/gpu/dist` using
the private fixture's Vite preview, and open `/placement-native.html`. Keep that
window in the foreground. At native 100% and 200% page zoom, click **Run placement
checks** and retain the JSON report locally. Restore the browser zoom afterward.
The fixture checks text/SVG/image targets, nested scrolling, nonuniform scale,
paused movement without recapture, refresh, disposal and reattachment. It requires
visible samples, nontransparent GPU output and at most one physical pixel of layer
geometry error against live target bounds. This is not a pixel-shape comparison.

Record the source revision, lockfile/build hashes, installed browser/OS, observed
native zoom, viewport/DPR, visibility and motion setting with the results. The
reported default adapter is a separate capability query, not renderer-device
identity. Playwright WebKit and a JavaScript viewport scale cannot prove native
Safari page zoom. The fixture emits `domfx-native-placement` with its report for
local evidence collection; no report leaves the page by default.

`pnpm measure:placement` compares one/two paused public attachments with no-effect
controls through stationary, nested-scroll and transformed movement workloads.
Run the same committed fixture before and after a placement change, with browser
runs serialized. Its report separates ordinary page timings from instrumented
read/frame/submission counts and records bundle sizes, source/build identities,
cleanup and method limits. These local samples do not promise a speed improvement.
For separate placement attribution, run `pnpm measure:placement -- --attribution`.
It uses an unminified source-mapped consumer, isolates precise function-coverage
counts from 1 ms CPU sampling in fresh processes, and retains raw coverage/profiles
locally. Coverage disables optimization; its counts include CDP boundaries. The
source-attributed sampling estimate includes placement visibility/clip helpers and
Floating UI, including async continuations; it is not exclusive placement CPU or
layout/GPU time. Keep these diagnostic results separate from ordinary timings and
production bundle sizes, and use the same mode for both source revisions.

## Visual comparisons

The local visual suite uses production website examples with fixed viewport and
pinned Chromium. Motion-free screenshots check the page shell; the Fire example
starts paused at time zero with its existing fixed seed. No effect renderer is mocked.
The test requires a real decorative layer; unavailable output fails.

Baselines stay local and ignored in
`apps/web/browser-tests/visual-baselines/<platform>/<backend>/`; do not commit or
upload these screenshots to PRs. Each checkout needs reviewed local samples before
running comparisons. A changed GPU/driver may require inspection even on the same
OS. They are not universal pixel truth. Generate candidates with:

```sh
pnpm test:visual --update-snapshots
```

Review every image diff before retaining an update. Do not update baselines merely
to make failures disappear. Screenshots detect appearance changes; separate fixture
assertions verify cleanup, late completion, refresh and native input preservation.
Native hardware screenshots do not gate hosted CI.

## Fixture evidence and manual checks

Standalone fixtures write `.scratch/browser/report.json` and failure traces;
website tests write `.scratch/web/report.json`. Harness smoke evidence has its own
`.scratch/agent/run-*/browser/` directory. Show a trace with:

```sh
pnpm --filter @domfx/web exec playwright show-trace /absolute/path/to/trace.zip
```

`pnpm test:browser:evidence` records revision/dirty state, lockfile/bundle hashes,
dependencies, browser/adapter, DPR and viewport, numerical checks and fixture images.
Exit 0 means PASS; exit 1 means failed assertions/build/runner; exit 2 means unavailable
GPU/effect; exit 3 means unavailable browser/transport. On a working GPU,
`--inject-failure` must exit 1 after saving completed evidence.

Use `pnpm demo` and `pnpm preview:demo` for manual website inspection. Private
fixture pages can be inspected with `pnpm --filter @domfx/gpu-tests exec vite
--host 127.0.0.1` (or `vite preview` after `pnpm build:gpu`). Record browser/GPU,
viewport, DPR, motion preference, actual outcome and untested cases. Before releases,
run the full local GPU and website suites plus the tarball rehearsal.

The public lab gallery/control tests were retired. Their relevant capture shapes
remain in `capture.spec.ts`; public gallery integration is covered by the website.
Existing independent numerical oracles, failure injection, resource accounting,
asset, lifecycle and shared-service fixtures remain test-only infrastructure.
