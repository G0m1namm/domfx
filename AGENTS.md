# domfx agent guide

Read `README.md` and `CONTRIBUTING.md` before planning or implementation.
Use `CONTEXT.md` for shared domain terminology.

## Engineering workflow

Use [HARNESS.md](HARNESS.md) for the define → design → implement → verify → review loop.
Start with `pnpm agent:brief`; finish implementation with `pnpm agent:verify` and the
applicable manual checks. Keep the task brief proportional to the change.

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

For TypeScript implementation, refactoring, and architecture work, use
[domfx-typescript-engineering](.agents/skills/domfx-typescript-engineering/SKILL.md).
Apply patterns only when a current requirement warrants them.

When the user asks to find architecture improvements, use
[improve-codebase-architecture](.agents/skills/improve-codebase-architecture/SKILL.md).
It uses [codebase-design](.agents/skills/codebase-design/SKILL.md) and the installed
grilling and domain-modeling skills to explore candidates before implementation.

For specialist work, load the relevant [skills](engineering/skills.md):
[GPU/shaders](.agents/skills/domfx-gpu-engineering/SKILL.md),
[browser/capture](.agents/skills/domfx-browser-engineering/SKILL.md),
[GSAP core](.agents/skills/gsap-core/SKILL.md), and
[GSAP timelines](.agents/skills/gsap-timeline/SKILL.md).
Repository contracts take precedence over upstream examples, especially target
visibility, global animation state, package boundaries, and resource ownership.

Keep changes vertical, small, typed, and testable. Preserve the core's DOM/framework independence; browser and GPU details belong behind adapters. Every behavior change needs an observable verification path.

## Design System

Always read DESIGN.md before making any visual or UI decisions.
All font choices, colors, spacing, and aesthetic direction are defined there.
Do not deviate without explicit user approval.
In QA mode, flag any code that does not match DESIGN.md.
