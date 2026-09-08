# domfx agent guide

Read `README.md` and `CONTRIBUTING.md` before planning or implementation.
Use `CONTEXT.md` for shared domain terminology.

## Engineering workflow

Follow `CONTRIBUTING.md` for commit/code conventions and `workspace-boundaries.mjs`
for permitted dependency directions. Run `pnpm check` before handing off code changes.
Use Oxfmt (`pnpm format`) and Oxlint (`pnpm lint`), not competing formatters.
Do not format vendored skills or generated/local-only files. Review automatic fixes.

Use the relevant GitHub issue for scope and acceptance checks. Confirm the intended
contract before changing capture, rendering, compositing or animation boundaries.

`PROJECT_CONTEXT.md`, `docs/` and `.scratch/` are optional, ignored maintainer notes.
Read them when available, but do not require them in public clones or publish them.
Put any context contributors need in the issue or tracked contributor guidance.

## Code health

Keep changes vertical, small, typed, and testable. Preserve the core's DOM/framework independence; browser and GPU details belong behind adapters. Every behavior change needs an observable verification path.
