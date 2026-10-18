# Contributing

domfx is an experimental library, not a stable published API. Start with the
setup and workspace map in [README.md](README.md).

## Conventions

- Use pnpm, TypeScript/ES modules, two-space indentation, single quotes and
  semicolons in source. `.editorconfig` defines whitespace rules.
- Oxfmt owns formatting and import order; do not add Prettier or a second formatter.
  Use 100-column wrapping, trailing commas, parenthesized arrow parameters and LF.
  Imports are alphabetical within groups: Node built-ins, external dependencies,
  `@domfx/` packages, then relative imports. Side-effect imports retain their order.
  Use explicit type-only imports. Oxlint enforces correctness, unused bindings,
  strict equality, no `var`/debugger and `const` where possible. Prefix intentionally
  unused parameters with `_`. TypeScript and dependency-cruiser remain separate gates.
- Use braces for every control-flow body and one variable per declaration; Oxlint
  enforces both. Separate functions and logical phases with a blank line. Group
  related declarations together, with blank lines between different responsibilities.
  Use descriptive names for state and coordinate spaces. Extract cohesive work when
  it clarifies inputs and ownership; keep resource creation and cleanup easy to trace.
- Explicit `any`, `@ts-ignore`, and `@ts-nocheck` are rejected. Use `unknown` and
  narrow external inputs. `@ts-expect-error` requires an explanation of at least
  10 characters, such as the invalid contract exercised by a negative type test.
- Run `pnpm format` to format, `pnpm lint:fix` for safe lint fixes, and review the diff.
  `pnpm format:check` and `pnpm lint` never modify files. Oxc versions are pinned;
  upgrades must pass tooling regression tests. Generated output, local docs/plans,
  vendored skills and the generated lockfile are not formatting targets.
- Use `kebab-case` filenames and named exports. Keep changes small, typed and
  covered by observable tests; do not commit generated output.
- Follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/):
  `type(scope): description`, for example `feat(core): add manual controls`.
  Scopes are optional; allowed scopes are `core`, `domfx`, `lab`, `web`, `gsap`,
  `repo`, `deps`, `release`. Use `!` or a `BREAKING CHANGE:` footer for breaking changes.
- Common types: `feat`, `fix`, `docs`, `test`, `refactor`, `perf`, `build`, `ci`,
  `chore`, `style`, `revert`. Commitlint enforces the conventional preset and scopes.

`pnpm install` installs Lefthook hooks. `pre-commit` checks formatting and lint
across the working tree (including unstaged edits); `commit-msg` checks the message;
`pre-push` runs `pnpm check` and builds the production website without rebuilding the libraries.
Use `DOMFX_FULL_VERIFY=1 git push` to opt into website smoke and the full local GPU suite in the hook. Reinstall with
`pnpm hooks:install` if needed. Hooks validate but never format, stage or commit
files automatically. CI repeats checks and validates PR commit ranges; push CI
checks the latest commit without retroactively enforcing all existing history.
Use a Conventional Commit title for the PR too: squash merges use that title.

## Proposing changes

Use GitHub issues for reproducible bugs and scoped feature proposals. Discuss large
changes before implementing. Fork the repository, work on a short-lived branch,
and open a PR against `main`. There is no permanent `develop` or `master` branch.
Follow the [Code of Conduct](CODE_OF_CONDUCT.md). Report vulnerabilities through
[SECURITY.md](SECURITY.md), never public issues.

Keep design explorations local and ignored: prototype HTML/CSS/JS, alternative
designs, comparison boards, screenshots, thumbnails and planning notes do not
belong in commits or PR uploads. Commit production application code, its supporting
tests/documentation, and image assets actually used by the application or marketing
site. Visual-test screenshots and baselines stay local. Record approved design
decisions in `DESIGN.md` without requiring exploration artifacts.

Consumer-facing library changes include a changeset (`pnpm changeset`); tooling,
fixture-only and contributor-doc changes need no package bump. See
[RELEASING.md](RELEASING.md). Publishing remains disabled.

## Dependency boundaries

| Workspace        | Allowed workspace dependencies               |
| ---------------- | -------------------------------------------- |
| `packages/core`  | None; no DOM, framework, GPU or Node imports |
| `packages/domfx` | Core                                         |
| `packages/gsap`  | Core and browser package                     |
| `tests/gpu`      | Library packages, never other apps           |
| `apps/web`       | Library packages, never other apps           |

`workspace-boundaries.mjs` defines the direction. `pnpm lint:boundaries` checks
manifests and imports (run `pnpm build` first). Cross-workspace dependencies must
use `workspace:*` and exported package names, not relative paths into source or
dist. Dependencies belong to their consumers; runtime code cannot rely on
dev-only packages. Boundary regressions are tested in `pnpm test:tooling`.

The website is the development/demo surface. Package-private `tests/gpu` pages exist only
for regression checks and optional measurements. Neither consumer imports the other.
Use the website's existing examples for public demonstrations; add a small package-private
fixture when a failure/lifecycle case cannot be exercised there.

## Verification

The [development harness](HARNESS.md) provides a task brief (`pnpm agent:brief`) and
one verification command (`pnpm agent:verify`) that runs repository checks and records
outcomes locally. Human contributors can run the same checks directly (`pnpm check` and
`pnpm test:web:smoke`) without an agent client.

Keep changes small and include a reproducible check. Packages must not import
apps; diagnostic distance oracles belong only to test fixtures. GSAP belongs in the optional
adapter and its example and fixture consumers. For library edits, rebuild with `pnpm build`; the website and fixtures import compiled packages,
not source aliases. Restart `pnpm demo` after rebuilding to refresh dependencies.

`pnpm check` includes the display-free packed consumer checks. The compile-only
`scripts/fixtures/packed-contracts/semantics.ts` fixture protects public attachment,
control and GSAP binding types with valid examples, explained `@ts-expect-error`
cases and exact promise-type checks. It uses packed declarations in strict NodeNext
and Bundler modes; run it directly with `pnpm test:packed:contracts`. These checks
establish type acceptance/rejection, not browser/GPU behavior or browser-package SSR support.

Before proposing a change:

1. Run `pnpm agent:verify`: repository checks, website build, and a small website
   smoke suite with WebGPU unavailable. This verifies page usability, not rendering.
2. For capture/rendering/lifecycle changes, run `pnpm test:gpu` and relevant focused
   fixture tests. Inspect affected website examples in development and production.
   Use `pnpm test:visual` for local screenshot comparisons; review baseline changes.
3. Before a release, run `pnpm test:gpu:full`, `pnpm test:web`, and
   `pnpm release:rehearse` on a WebGPU-capable machine. Record environment and results.
4. Describe observable changes and remaining limitations. Never infer GPU success
   from website smoke or static checks.

CI runs `pnpm check`, the production website build, a GPU-independent website smoke
suite and release metadata validation. Expensive GPU, soak and performance runs are
local opt-in checks. The publication workflow remains disabled; its existing GPU
preparation must be revised before enabling publication on hosted runners.

## Publication and working artifacts

domfx separates durable contributor knowledge from local operational state:

- **Tracked knowledge:** Durable setup, commands, architecture contracts, domain terminology
  ([GLOSSARY.md](GLOSSARY.md)), design direction ([DESIGN.md](DESIGN.md)), licenses, and
  necessary workflow configuration are tracked in Git. Task scope and decisions belong in
  linked GitHub issues.
- **Local working state:** Personal working notes, transient experiment runs, local settings,
  and environment variables stay in ignored locations (`.scratch/`, `PROJECT_CONTEXT.md`,
  local `docs/`, `.env*.local`). Never commit or require them.
- **Pushed branches reach the repository audience:** Any pushed branch is available to that
  audience even if never merged into `main`, and can become public if visibility changes.
  Do not push credentials, raw memory traces, or sensitive personal data.
- **Publication boundaries:** GitHub source visibility and npm distribution are distinct.
  Library manifests select `dist` (`files: ["dist"]`); npm tarballs also include package
  metadata, README, license, and an optional changelog, as verified by
  `pnpm release:artifacts`.
- **Test fixtures:** `tests/gpu` is a package-private workspace for internal regression testing.
  While its tracked source is visible in the public repository, it is not an exported npm
  package or public demo gallery. Never store secrets or private data in test fixtures.

See [artifact and documentation policy](engineering/artifact-policy.md) for the complete
audience, location, and format map. Shared repository settings and maintenance routines live
in [.github/REPOSITORY_SETTINGS.md](.github/REPOSITORY_SETTINGS.md); link to it instead of
duplicating routines here. Packages stay private until release gates pass; public source does
not imply npm publication.
