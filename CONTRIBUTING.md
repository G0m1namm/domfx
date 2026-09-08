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

| Workspace               | Allowed workspace dependencies               |
| ----------------------- | -------------------------------------------- |
| `packages/core`         | None; no DOM, framework, GPU or Node imports |
| `packages/domfx`        | Core                                         |
| `packages/gsap` (later) | Core and browser package                     |
| `apps/lab`              | Library packages, never other apps           |
| `apps/web` (later)      | Library packages, never other apps           |

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

Keep changes small and include a reproducible check. Packages must not import
apps; GSAP and diagnostic distance oracles currently belong only to the lab.
For library edits, rebuild with `pnpm build`; the lab imports compiled packages,
not source aliases. Restart `pnpm demo` after rebuilding to refresh dependencies.

Before proposing a change:

1. Run `pnpm check` and `pnpm build:demo`.
2. For capture/GPU changes, run both `pnpm demo` and `pnpm preview:demo` in a
   WebGPU-enabled browser with reduced motion disabled. Confirm the page reports
   PASS, exercise the controls, and dispose the effect.
3. Describe the reason, observable result, and remaining limitations. Include
   browser/GPU details for rendering bugs. Never infer GPU success from CI alone.

The GitHub workflow checks conventions, boundaries, types, tests and the production
build. It does not yet automate browser/GPU execution.

## Maintainer notes

Public contributions must be understandable from tracked files and the linked
issue. `PROJECT_CONTEXT.md`, `docs/` and `.scratch/` are local-only notes, not
contributor prerequisites. Never commit them.

See [.github/REPOSITORY_SETTINGS.md](.github/REPOSITORY_SETTINGS.md) for launch
settings. Packages stay private until release gates pass; public source does not
imply npm publication. Retain the project and third-party license notices.
