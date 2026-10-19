# domfx

GPU edge effects for live DOM elements. Choose from 21 effects, including Electricity, Frost, Fire, Slime, Burned paper, Kinetic bloom and geometric patterns. Animate automatically or control time and intensity with your code or GSAP.

This repository contains a working browser feasibility experiment in a pnpm monorepo. Packages are private and experimental; the manual attachment API is experimental and there is no published npm package yet.

## Quickstart and usage

Start with the [consumer quickstart](QUICKSTART.md) for verified standalone and GSAP examples, local tarball installation, lifecycle ownership, and support limits.

Package-specific contracts and API references live in their respective package guides:

- [`@domfx/core`](packages/core/README.md) — DOM/framework/GPU-independent contracts and computation
- [`@domfx/domfx`](packages/domfx/README.md) — browser capture and internal TypeGPU renderer
- [`@domfx/gsap`](packages/gsap/README.md) — optional GSAP lifecycle helpers

## Support limits

All effects share capture, placement, animation controls and cleanup. Local Chromium checks cover capture, GPU distances, rendering, lifecycle and GSAP controls. They do not establish broad browser support or performance guarantees.

- See the [browser support record](engineering/browser-support.md) for measured environments and untested coverage.
- See [GLOSSARY.md](GLOSSARY.md) for shared domain terminology.

## Development

Use Node 22.22.3 (`.nvmrc`) and pnpm 11.5.0 (`packageManager`). From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm demo
```

Open the website in a WebGPU-enabled browser. `apps/web` is the Astro development surface and public examples gallery: edit the library, rebuild packages (`pnpm build`), and restart `pnpm demo`. The original page remains usable when effects are unavailable.

Key development commands:

- `pnpm demo` / `pnpm web` — build packages and start the Astro website
- `pnpm check` — formatting, lint, boundaries, builds, types, unit and packed-contract tests
- `pnpm test:web:smoke` — development/production website smoke suite with WebGPU unavailable
- `pnpm agent:verify` — repository checks, production website build, and smoke verification
- `pnpm format` / `pnpm lint` — Oxfmt and Oxlint

Install Chromium for testing with `pnpm --filter @domfx/web exec playwright install chromium`. Effect API conventions and future control design checks are documented in [engineering/effect-api.md](engineering/effect-api.md). Detailed verification commands, GPU backends, and measurement suites are documented in [CONTRIBUTING.md](CONTRIBUTING.md) and [HARNESS.md](HARNESS.md).

## Workspace structure

```text
packages/core   → DOM/framework/GPU-independent contracts and computation
packages/domfx  → browser capture and internal TypeGPU renderer; consumes core
packages/gsap   → optional GSAP lifecycle helpers
apps/web        → Astro website, public examples and user documentation
tests/gpu       → package-private regression fixtures and numerical tests; no demo app
```

One workspace lockfile governs dependencies. All packages remain private and experimental; the selected npm scope is `@domfx`. The website and test fixtures import built package exports, never library source aliases. Rebuild packages after library edits and restart the website.

`tests/gpu` is a package-private workspace for internal regression testing and diagnostic fixtures. It is test infrastructure, not another public gallery or published package.

## Contributing and verification

- [CONTRIBUTING.md](CONTRIBUTING.md) defines code conventions, commit formats, dependency boundaries, and the verification process.
- [HARNESS.md](HARNESS.md) provides executable verification (`pnpm agent:verify`) and task briefs (`pnpm agent:brief`).
- [Artifact policy](engineering/artifact-policy.md) defines publication boundaries, durable documentation vs. local state, and document formats.
- The contributor route is fully usable for human developers using standard pnpm commands without requiring an AI client.

CI runs fast repository checks, production builds, and a GPU-independent website smoke suite. Full GPU runs stay local.

## Repository maintenance and releases

- [.github/REPOSITORY_SETTINGS.md](.github/REPOSITORY_SETTINGS.md) records branch rules, label taxonomies, security policies, and shared maintenance routines.
- [RELEASING.md](RELEASING.md) defines the manual first-alpha release and artifact approval process.

Publication remains disabled, and neither the website nor test fixtures are npm releases.

## License and inspiration

domfx is [MIT licensed](LICENSE). Dependencies retain their own licenses; GSAP is not relicensed by this project. Vendored skills retain their upstream MIT notices; see [skill provenance](engineering/skills.md).

Inspired by [Kugiri](https://github.com/edoardolunardi/kugiri)'s library-and-demo approach. No Kugiri implementation code was copied.
