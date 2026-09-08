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

| Command                             | Result                                                                     |
| ----------------------------------- | -------------------------------------------------------------------------- |
| `pnpm build`                        | Build core, then browser/GPU JavaScript and declarations                   |
| `pnpm typecheck`                    | Build dependencies and check all workspaces/configs                        |
| `pnpm test`                         | Build dependencies and run four numerical tests                            |
| `pnpm check`                        | Check formatting/lint, build, validate boundaries, typecheck and run tests |
| `pnpm format` / `pnpm format:check` | Apply or check Oxfmt formatting and import order                           |
| `pnpm lint` / `pnpm lint:fix`       | Check Oxlint rules or apply safe fixes                                     |
| `pnpm lint:boundaries`              | Check workspace dependencies and imports after building                    |
| `pnpm test:tooling`                 | Test commit conventions and forbidden dependency edges                     |
| `pnpm hooks:install`                | Install or repair Lefthook's pre-commit, commit-message and pre-push hooks |
| `pnpm demo`                         | Build packages and start the development lab                               |
| `pnpm build:demo`                   | Build packages and the production lab in `apps/lab/dist`                   |
| `pnpm preview:demo`                 | Serve the production lab after `build:demo`                                |

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
`apps/lab` is the diagnostic testbed, not a marketing website.

## Spike stack

- TypeGPU + `@typegpu/sdf` for WebGPU work and mask-to-SDF generation.
- SnapDOM as the MVP capture adapter.
- GSAP as the first animation adapter.

## Status

The lab exercises capture → GPU distance field → fire rendering and prints its
verification results. Local fixture checks have passed, but they do not establish
broad browser support or performance guarantees.

A stable attachment API, reusable lifecycle/GSAP adapters, broader geometry and
refresh coverage, and automated browser verification remain unfinished.

## Workflow

Read [CONTRIBUTING.md](CONTRIBUTING.md) for checks and the public-repository checklist.
See [CONTEXT.md](CONTEXT.md) for domain terminology.
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
[upstream MIT notice](.agents/skills/LICENSE).

## Inspiration

Inspired by [Kugiri](https://github.com/edoardolunardi/kugiri)'s library-and-demo
approach. No Kugiri implementation code was copied.
