# domfx

GPU edge effects for live DOM elements. The first vertical slice is a fire effect that follows an element's visible silhouette and is controlled by GSAP.

This repository contains a working browser feasibility experiment in a pnpm
monorepo. Packages are private and experimental; the manual attachment
API is experimental and there is no published installation command yet.

Start with the [consumer quickstart](QUICKSTART.md) for verified standalone and GSAP
examples, local tarball installation, lifecycle ownership and support limits.

## Development

Use Node 22.22.3 (`.nvmrc`) and pnpm 11.5.0 (`packageManager`). From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm demo
```

Open the website in a WebGPU-enabled browser. It is the development surface and
public examples gallery: change the library, rebuild packages, and restart `pnpm demo`.
The original page remains usable when effects are unavailable.

| Command                                                                    | Result                                                                      |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `pnpm demo` / `pnpm web`                                                   | Build packages and start the Astro website                                  |
| `pnpm build:web` / `pnpm preview:web`                                      | Build and preview the production website                                    |
| `pnpm check`                                                               | Formatting, lint, boundaries, builds, types, unit and packed-contract tests |
| `pnpm agent:verify`                                                        | Repository checks, production website build and website smoke tests         |
| `pnpm test:web:smoke`                                                      | Small development/production website suite with WebGPU unavailable          |
| `pnpm test:web`                                                            | Complete local website suite, including real GPU rendering                  |
| `pnpm test:visual`                                                         | Local production screenshot comparisons, including paused fire              |
| `pnpm test:gpu`                                                            | Ten production rendering/lifecycle smoke cases in private fixtures          |
| `pnpm test:gpu:full`                                                       | Complete local development/production GPU fixture suite                     |
| `pnpm test:browser:evidence`                                               | Production capture/numerical checks with JSON and PNG evidence              |
| `pnpm measure:steady` / `pnpm measure:layout` / `pnpm measure:performance` | Opt-in local measurements                                                   |
| `pnpm test:packed` / `pnpm release:rehearse`                               | Fresh tarball consumers with real GPU checks                                |
| `pnpm format` / `pnpm lint`                                                | Oxfmt and Oxlint                                                            |

Install Chromium once with `pnpm --filter @domfx/web exec playwright install chromium`.
See [browser verification](engineering/browser-verification.md) for commands,
visual baselines, GPU backends and coverage limits. Full GPU runs stay local;
a green CI website smoke check does not establish effect correctness.

## Workspace structure

```text
packages/core   → DOM/framework/GPU-independent contracts and computation
packages/domfx  → browser capture and internal TypeGPU renderer; consumes core
packages/gsap   → optional GSAP timeline binding
apps/web        → Astro website, public examples and user documentation
tests/gpu      → private regression fixtures and numerical tests; no demo app
```

One workspace lockfile governs dependencies. All packages remain private and
experimental; the selected npm scope is `@domfx`. The website and fixtures import
built package exports, never library source aliases. Shader transformation belongs
to the browser package. Rebuild packages after library edits and restart the website.
Fixtures are test infrastructure, not another public gallery or published package.

## Status

The first effect is Fire. Local Chromium checks cover capture, GPU distances,
rendering, lifecycle and GSAP controls. They do not establish broad browser support
or performance guarantees. See the [support record](engineering/browser-support.md)
for measured environments and untested coverage, and [CONTEXT.md](CONTEXT.md) for terminology.

Read [CONTRIBUTING.md](CONTRIBUTING.md) for the development workflow and
[HARNESS.md](HARNESS.md) for recorded verification. CI runs fast repository checks,
production builds and a GPU-independent website smoke suite. Rendering changes
require relevant local GPU checks; releases require the full local suites.

## Release preparation

See [RELEASING.md](RELEASING.md) for the manual first-alpha release and artifact
approval process. `pnpm release:check` validates metadata without publishing;
`pnpm release:rehearse` verifies fresh standalone/GSAP consumers and GPU cleanup.
Publication remains disabled, and neither the website nor fixtures are npm releases.

## License

domfx is [MIT licensed](LICENSE). Dependencies retain their own licenses;
GSAP is not relicensed by this project. Vendored skills retain their
[existing upstream MIT notice](.agents/skills/LICENSE) and the per-skill notices
listed in [skill provenance](engineering/skills.md).

## Inspiration

Inspired by [Kugiri](https://github.com/edoardolunardi/kugiri)'s library-and-demo
approach. No Kugiri implementation code was copied.

## Browser regression fixtures

`pnpm test:browser:evidence` saves production capture/numerical reports, images and
logs under `.scratch/browser-regression/`. A desktop session and WebGPU are required;
`DOMFX_BROWSER_EXECUTABLE` can select an existing Chromium executable.

Exit codes distinguish PASS (0), assertion/build failure (1), unavailable GPU/effect
(2), and unavailable browser/transport (3). Missing hardware never counts as a
successful rendering check. `pnpm test:browser:evidence --inject-failure` must exit 1
on a working GPU and retain its completed evidence. PNG hashes are evidence for
that environment, not portable baselines across browsers and GPUs.
