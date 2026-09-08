# domfx

GPU edge effects for live DOM elements. The first vertical slice is a fire effect that follows an element's visible silhouette and is controlled by GSAP.

This repository contains a working browser feasibility experiment in a pnpm
monorepo. Packages are private and experimental; there is no stable attachment
API or published installation command yet.

## Development

Use Node 22.22.3 (`.nvmrc`) and pnpm 11.5.0 (`packageManager`). From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm demo
```

Open the printed loopback address in a WebGPU-enabled browser. With reduced
motion disabled, the lab automatically checks capture, GPU distances, fire and
GSAP seeking. It also provides Play, Seek, Reverse and Dispose controls.

| Command | Result |
| --- | --- |
| `pnpm build` | Build core, then browser/GPU JavaScript and declarations |
| `pnpm typecheck` | Build dependencies and check all workspaces/configs |
| `pnpm test` | Build dependencies and run four numerical tests |
| `pnpm check` | Build, validate boundaries, typecheck and run tooling/numerical tests |
| `pnpm lint:boundaries` | Check workspace dependencies and imports after building |
| `pnpm test:tooling` | Test commit conventions and forbidden dependency edges |
| `pnpm hooks:install` | Install or repair Lefthook's commit-message and pre-push hooks |
| `pnpm demo` | Build packages and start the development lab |
| `pnpm build:demo` | Build packages and the production lab in `apps/lab/dist` |
| `pnpm preview:demo` | Serve the production lab after `build:demo` |

## Workspace structure

```text
packages/core   → DOM/framework/GPU-independent contracts and alpha classification
packages/domfx  → browser capture and internal TypeGPU renderer; consumes core
apps/lab        → GPU experiment, GSAP example, diagnostics and tests; consumes packages
```

One workspace lockfile governs dependencies. `@domfx/core`, `@domfx/browser` and
`@domfx/lab` are private local names, not reserved registry names. The lab imports
built package exports; it has no source aliases or TypeGPU build plugin. Shader
transformation belongs to the browser package. The `/experimental` entry exposes
the spike to the lab temporarily, not a supported public renderer API.

Rebuild packages after library edits and restart the lab to refresh dependencies.
Test-only Float64 distance oracles stay in the lab, outside consumer runtime.
`apps/lab` is the diagnostic testbed; `apps/web` will be the separate marketing
and documentation website. Add `packages/gsap` and `apps/web` when their tickets start; the future app still
needs product discovery. No empty workspaces or extra task orchestrator are needed.

## Spike stack

- TypeGPU + `@typegpu/sdf` for WebGPU work and mask-to-SDF generation.
- SnapDOM as the MVP capture adapter.
- GSAP as the first animation adapter.

The core is framework-agnostic. Capture and renderer adapters are explicit seams so native HTML-in-Canvas and vGPU can be evaluated later without changing the public model.

## Status

The capture → GPU SDF → GPU fire spike passes in the recorded local browser. All
five DOM capture classes plus overflow/transform guards pass an independent
distance oracle; the largest measured error is 0.277 raster pixels. These are
bounded fixture results, not broad browser support or performance guarantees.
The lab prints its current verification results. Internal evidence lives in the
local-only `docs/` folder, not the public contributor documentation.

This is not yet a stable attachment API or a completed five-class/two-live-target preview. Reusable lifecycle/GSAP adapters, full geometry and refresh-race coverage, broader performance/support measurements and user validation remain next.

## Workflow

Read [CONTRIBUTING.md](CONTRIBUTING.md) for checks and the public-repository checklist.
Commitlint enforces Conventional Commits; Lefthook installs the local checks.
Workspace manifests and import boundaries are checked locally and in CI.

## Inspiration

[Kugiri's first commit](https://github.com/edoardolunardi/kugiri/commit/29182419bbe187f43c7fe955053cefca52d4984b)
already paired library source with a demo/test harness, package metadata and
documentation. Its release automation came later. We follow that practical
progression, using separate workspaces because domfx has distinct core, browser
and app responsibilities. No Kugiri implementation code was copied.
