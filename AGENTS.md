# domfx agent guide

Read `PROJECT_CONTEXT.md` before planning or implementation. Read the relevant ADRs before changing capture, rendering, compositing, or animation boundaries.

## Engineering workflow

Follow `CONTRIBUTING.md` for commit/code conventions and `workspace-boundaries.mjs`
for permitted dependency directions. Run `pnpm check` before handing off code changes.

Tasks are local Markdown files under `.scratch/<feature>/issues/`. See `docs/agents/issue-tracker.md`.

Use the standard triage states in `docs/agents/triage-labels.md`. A task is `ready-for-agent` only when its acceptance checks can be completed without guessing.

The domain documentation uses one root `CONTEXT.md` and `docs/adr/`. See `docs/agents/domain.md`.

## Code health

Keep changes vertical, small, typed, and testable. Preserve the core's DOM/framework independence; browser and GPU details belong behind adapters. Every behavior change needs an observable verification path.
