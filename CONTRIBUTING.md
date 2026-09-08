# Contributing

domfx is an experimental library, not a stable published API. Start with the
setup and workspace map in [README.md](README.md).

## Conventions

- Use pnpm, TypeScript/ES modules, two-space indentation, single quotes and
  semicolons in source. `.editorconfig` defines whitespace rules.
- Use `kebab-case` filenames and named exports. Keep changes small, typed and
  covered by observable tests; do not commit generated output.
- Follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/):
  `type(scope): description`, for example `feat(core): add manual controls`.
  Scopes are optional; allowed scopes are `core`, `domfx`, `lab`, `web`, `gsap`,
  `repo`, `deps`, `release`. Use `!` or a `BREAKING CHANGE:` footer for breaking changes.
- Common types: `feat`, `fix`, `docs`, `test`, `refactor`, `perf`, `build`, `ci`,
  `chore`, `style`, `revert`. Commitlint enforces the conventional preset and scopes.

`pnpm install` installs Lefthook hooks. `commit-msg` checks the message;
`pre-push` runs `pnpm check` and `pnpm build:demo`. Reinstall with
`pnpm hooks:install` if needed. Hooks validate but never format, stage or commit
files automatically. CI repeats checks and validates PR commit ranges; push CI
checks the latest commit without retroactively enforcing all existing history.

## Dependency boundaries

| Workspace | Allowed workspace dependencies |
| --- | --- |
| `packages/core` | None; no DOM, framework, GPU or Node imports |
| `packages/domfx` | Core |
| `packages/gsap` (later) | Core and browser package |
| `apps/lab` | Library packages, never other apps |
| `apps/web` (later) | Library packages, never other apps |

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

The GitHub workflow checks conventions, boundaries, types, tests and the production build. It
does not yet automate browser/GPU execution; that is a separate backlog ticket.
Local planning lives under `.scratch/preview/` and `/docs/`, both ignored and
excluded from the initial commit. Public contributor guidance stays in this file
and README. A hosted issue tracker is not configured yet.

## Before making the repository public

- Choose the project license and retain any required third-party notices.
- Review tracked files and Git history for private material and local-only notes.
- Choose the GitHub owner/repository and establish contribution/security contacts.
- Keep workspace packages private until package names, packed-consumer checks
  and release gates are approved. Public source and npm publication are separate.

No project license has been selected by this migration. It adds no publishing,
deployment or release credentials.
