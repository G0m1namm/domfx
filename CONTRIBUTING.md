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
`pre-push` runs `pnpm check` and `pnpm build:demo`. Reinstall with
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

Consumer-facing library changes include a changeset (`pnpm changeset`); tooling,
lab-only and contributor-doc changes need no package bump. See
[RELEASING.md](RELEASING.md). Publishing remains disabled.

## Dependency boundaries

| Workspace          | Allowed workspace dependencies               |
| ------------------ | -------------------------------------------- |
| `packages/core`    | None; no DOM, framework, GPU or Node imports |
| `packages/domfx`   | Core                                         |
| `packages/gsap`    | Core and browser package                     |
| `apps/lab`         | Library packages, never other apps           |
| `apps/web` (later) | Library packages, never other apps           |

`workspace-boundaries.mjs` defines the direction. `pnpm lint:boundaries` checks
manifests and imports (run `pnpm build` first). Cross-workspace dependencies must
use `workspace:*` and exported package names, not relative paths into source or
dist. Dependencies belong to their consumers; runtime code cannot rely on
dev-only packages. Boundary regressions are tested in `pnpm test:tooling`.

The lab is a diagnostic testbed, not the marketing website. The future
`apps/web` will own the public landing page, documentation and curated examples.
Neither app imports the other; reusable example logic belongs in a package only
when actual reuse warrants it. The website is not scaffolded yet.

## Verification

The [development harness](HARNESS.md) provides a task brief (`pnpm agent:brief`) and
one verification command (`pnpm agent:verify`) that runs the checks below and records
their outcomes locally. It supports coding agents and human contributors alike.

Keep changes small and include a reproducible check. Packages must not import
apps; diagnostic distance oracles belong only to the lab. GSAP belongs in the optional
adapter and its lab consumers. For library edits, rebuild with `pnpm build`; the lab imports compiled packages,
not source aliases. Restart `pnpm demo` after rebuilding to refresh dependencies.

Before proposing a change:

1. Run `pnpm agent:verify`: it runs `pnpm check`, `pnpm build:demo`, then the
   development and production browser/GPU suite. Install Chromium as described in
   [browser verification](engineering/browser-verification.md) first.
2. For capture/GPU changes, add a scenario for the changed behavior. Exercise any
   relevant case outside the automated coverage in both `pnpm demo` and
   `pnpm preview:demo`, and record the actual environment and outcome.
3. Describe the reason, observable result, and remaining limitations. Include
   browser/GPU details for rendering bugs. Never infer GPU success from CI alone.

The GitHub workflow runs the same harness with Chromium and the SwiftShader software
GPU, and retains browser reports and failure traces. CI exercises shaders and the lab's
browser scenarios; it does not establish hardware performance or broad browser support.

## Maintainer notes

Public contributions must be understandable from tracked files and the linked
issue. `PROJECT_CONTEXT.md`, `docs/` and `.scratch/` are local-only notes, not
contributor prerequisites. Never commit them.

See [.github/REPOSITORY_SETTINGS.md](.github/REPOSITORY_SETTINGS.md) for launch
settings. Packages stay private until release gates pass; public source does not
imply npm publication. Retain the project and third-party license notices.
