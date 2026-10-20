# domfx agent guide

Read `README.md` and `CONTRIBUTING.md` before planning or implementation.
Use `GLOSSARY.md` for shared domain terminology.

## Communication

Use the fewest words that clearly explain the idea. Lead with the result, use plain
language, and say each point once. Keep details needed to act, verify, or understand
a limitation; expand when asked.

Keep tool output focused: read relevant file sections and request only needed fields.
Save lengthy logs locally and return the outcome, relevant failure, and evidence path.

## Engineering workflow

Use the [AI Hero workflow](engineering/agent-workflow.md) for planning, implementation,
and review. Its full skill set is installed in `.agents/skills`; use `ask-matt` when
the next flow is unclear. [HARNESS.md](HARNESS.md) supplies executable verification.
Start implementation with `pnpm agent:brief`; finish with `pnpm agent:verify` and
applicable manual checks. The linked issue/spec can serve as the task brief.

Follow `CONTRIBUTING.md` for commit/code conventions and `workspace-boundaries.mjs`
for permitted dependency directions. Run `pnpm check` before handing off code changes.
Use Oxfmt (`pnpm format`) and Oxlint (`pnpm lint`), not competing formatters.
Do not format vendored skills or generated/local-only files. Review automatic fixes.

Use the relevant GitHub issue for scope and acceptance checks. Confirm the intended
contract before changing capture, rendering, compositing or animation boundaries.

`PROJECT_CONTEXT.md`, `docs/` and `.scratch/` are optional, ignored maintainer notes.
Read them when available, but do not require them in public clones or publish them.
Put any context contributors need in the issue or tracked contributor guidance.
See [artifact and documentation policy](engineering/artifact-policy.md) for publication boundaries.

## Agent skills

- **Issue tracker:** GitHub Issues; see [operations and completion](engineering/agents/issue-tracker.md).
- **Triage:** use the [configured labels](engineering/agents/triage-labels.md), including separate specs and decision maps.
- **Domain:** one `GLOSSARY.md`; see [domain documentation](engineering/agents/domain.md).
- **Integration:** read [workflow adaptations](engineering/agent-workflow.md#repository-integration) when invoking a skill, especially for parallel work, testing, or artifact handoff.

## Code health

Read [code conventions](engineering/code-conventions.md) before JavaScript/TypeScript
implementation and review; complete its final review checklist before handoff.

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

For UI implementation and review, read [UI conventions](engineering/ui-conventions.md).
Apply its rules to changed styles and complete its review checklist before handoff.
