# domfx

GPU edge effects for live DOM elements. The first vertical slice is a fire effect that follows an element's visible silhouette and is controlled by GSAP.

This repository contains a working browser feasibility experiment in a pnpm
monorepo. Packages are private and experimental; the manual attachment
API is experimental and there is no published installation command yet.

## Development

Use Node 22.22.3 (`.nvmrc`) and pnpm 11.5.0 (`packageManager`). From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm demo
```

Open the printed loopback address in a WebGPU-enabled browser. With reduced
motion disabled, the lab automatically checks capture, GPU distances, fire and
GSAP seeking. The main page renders a five-class gallery (headline, button, SVG, transparent raster
and card) through public attachments, with two targets in one scrolling host. Per-target
controls exercise time, intensity, refresh, placement and disposal; the headline retains
Play, Seek and Reverse controls.

| Command                             | Result                                                                     |
| ----------------------------------- | -------------------------------------------------------------------------- |
| `pnpm build`                        | Build core, then browser/GPU JavaScript and declarations                   |
| `pnpm typecheck`                    | Build dependencies and check all workspaces/configs                        |
| `pnpm test:browser:evidence`        | Build and run production browser fixtures; save JSON, PNGs and logs        |
| `pnpm test`                         | Build dependencies and run four numerical tests                            |
| `pnpm check`                        | Check formatting/lint, build, validate boundaries, typecheck and run tests |
| `pnpm format` / `pnpm format:check` | Apply or check Oxfmt formatting and import order                           |
| `pnpm lint` / `pnpm lint:fix`       | Check Oxlint rules or apply safe fixes                                     |
| `pnpm lint:boundaries`              | Check workspace dependencies and imports after building                    |
| `pnpm test:tooling`                 | Test commit conventions and forbidden dependency edges                     |
| `pnpm test:packed`                  | Verify packed GPU dev/prod and missing-transform rejection                 |
| `pnpm hooks:install`                | Install or repair Lefthook's pre-commit, commit-message and pre-push hooks |
| `pnpm demo`                         | Build packages and start the development lab                               |
| `pnpm build:demo`                   | Build packages and the production lab in `apps/lab/dist`                   |
| `pnpm preview:demo`                 | Serve the production lab after `build:demo`                                |
| `pnpm test:browser`                 | Build and verify the development/production lab in Chromium                |
| `pnpm agent:verify`                 | Run repository checks, builds, and browser/GPU verification with evidence  |

For browser checks, first run `pnpm --filter @domfx/lab exec playwright install chromium`.
See [browser verification](engineering/browser-verification.md) for GPU backends,
CI behavior, evidence, and coverage limits.

## Workspace structure

```text
packages/core   → DOM/framework/GPU-independent contracts and alpha classification
packages/domfx  → browser capture and internal TypeGPU renderer; consumes core
packages/gsap   → optional GSAP timeline binding; consumes core types and the GSAP peer
apps/lab        → GPU experiment, GSAP example, diagnostics and tests; consumes packages
```

One workspace lockfile governs dependencies. `@domfx/core`, `@domfx/browser` and
`@domfx/gsap` and `@domfx/lab` are private local names, not reserved registry names. The lab imports
built package exports; it has no source aliases or TypeGPU build plugin. Shader
transformation belongs to the browser package. The `/experimental` entry exposes
the spike to the lab temporarily, not a supported public renderer API.

Rebuild packages after library edits and restart the lab to refresh dependencies.
See [packed ESM consumption](packages/domfx/README.md#packed-esm-consumption) for
the supported consumer build path and Chromium setup for `pnpm test:packed`.
Test-only Float64 distance oracles stay in the lab, outside consumer runtime.
`apps/lab` is the diagnostic testbed, not a marketing website.

## Spike stack

- TypeGPU + `@typegpu/sdf` for WebGPU work and mask-to-SDF generation.
- SnapDOM as the MVP capture adapter.
- GSAP as the first animation adapter.

## Status

The lab exercises capture → GPU distance field → fire rendering and prints its
verification results. Local fixture checks have passed, but they do not establish
broad browser support or performance guarantees.

The existing lab scenarios run automatically in Chromium for development and
production builds. An experimental [manual attachment API](packages/domfx/README.md#manual-fire-attachment)
is available through the browser package. The optional [GSAP binding](packages/gsap/README.md)
drives manual attachments from caller-owned timelines; open `/gsap.html` in the lab
for its package consumer. Broader browser/geometry support and refresh coverage remain unfinished.

## Workflow

Read [CONTRIBUTING.md](CONTRIBUTING.md) for checks and the public-repository checklist.
See [CONTEXT.md](CONTEXT.md) for domain terminology.
Use the [development agent harness](HARNESS.md) for task contracts, design review,
and recorded verification: `pnpm agent:brief` and `pnpm agent:verify`.
Oxfmt enforces formatting/import order; Oxlint checks code correctness.
Commitlint enforces Conventional Commits; Lefthook installs the local checks.
Workspace manifests and import boundaries are checked locally and in CI.

## Release preparation

See [RELEASING.md](RELEASING.md) for versioning and release gates.
`pnpm release:check` validates local release preparation without publishing.
All packages remain private; the lab and future website are not npm releases.

## License

domfx is [MIT licensed](LICENSE). Dependencies retain their own licenses;
GSAP is not relicensed by this project. Vendored skills retain their
[existing upstream MIT notice](.agents/skills/LICENSE) and the per-skill notices
listed in [skill provenance](engineering/skills.md).

## Inspiration

Inspired by [Kugiri](https://github.com/edoardolunardi/kugiri)'s library-and-demo
approach. No Kugiri implementation code was copied.

## Browser regression fixtures

Install Chromium once with `pnpm --filter @domfx/lab exec playwright install chromium`,
then run `pnpm test:browser:evidence`. The command runs numerical tests, builds the production
lab, serves it on an ephemeral loopback port, and launches visible Chromium with
reduced motion disabled at 1280 × 720 and DPR 2. A desktop session and WebGPU are
required. To use an existing Chromium executable, set `DOMFX_BROWSER_EXECUTABLE`
to its absolute path. The runner uses Playwright's browser transport API only;
the assertions remain in the lab.

Each run writes `.scratch/browser-regression/<timestamp>/report.json`, fixture
PNGs, a page screenshot, and test/build logs. JSON records the Git revision and
dirty state, production bundle and lockfile hashes, installed dependency versions,
actual browser version, user agent, GPU adapter, viewport and DPR. Nondeterministic
measurements live under `timings`, separate from fixture checks and pixel hashes;
the warm timing candidate is informational and never gates a pass. PNGs and hashes
are evidence for that run, not portable baselines across GPUs or browsers.

Exit codes: `0` = PASS; `1` = assertion/build/runner failure; `2` = GPU or effect
unavailable; `3` = browser launch/transport unavailable. Missing hardware is never
a successful GPU run. Failure reports retain completed fixture evidence. Run
`pnpm test:browser:evidence --inject-failure` to prove the failure path: on a working GPU it
must report FAIL, include `injected assertion failure`, and exit 1. It intentionally
fails after the fixture assertions; do not interpret an unavailable run as this proof.
Manual `pnpm demo` and `pnpm preview:demo` controls remain available.
