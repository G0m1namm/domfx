# Verification harness

The [AI Hero workflow](engineering/agent-workflow.md) governs planning, implementation,
and review. This harness supplies repeatable verification and evidence for that
workflow, for coding agents and human contributors alike.

## Start a task

Run `pnpm agent:brief` to print the current runtime, permitted dependency directions,
and a [task brief](engineering/task-brief.md). Fill it in using the issue or request.
Keep the working brief in the task conversation, issue, or ignored `.scratch/` notes.
The command prints context; it does not call a model or generate implementation code.

Read the [TypeScript engineering skill](.agents/skills/domfx-typescript-engineering/SKILL.md)
and the affected package's code. Anchor work to an existing implementation and test
whose conventions fit the task. Existing experimental code is a reference, not proof
that every design choice should be copied.

Select [specialist skills](engineering/skills.md) for GPU/shaders, browser capture,
or animation work. Load both sides when a change crosses capture/render boundaries.

## Use with the skills

An issue or approved spec supplies the contract and acceptance checks. `implement`
and `implement-spec` use focused checks during development, then this harness once
edits settle. Their code review is a distinct pass against Standards and Spec.
Repeat affected checks after review fixes and record unverified work explicitly.

The runner does not call a model, spawn agents, commit, push, merge, publish, or
change GitHub settings. Those actions belong to the invoked skill and task scope.
For parallel implementation, verify the integrated source with that worktree idle;
individual worker results do not substitute for integration evidence.

## What the commands enforce

`pnpm agent:verify` runs `pnpm check`, `pnpm build:web:built`, and
`pnpm test:web:smoke:built` in order, stopping on failure. Libraries build once;
the website consumes those outputs. Smoke tests inject unavailable WebGPU and
verify navigation, layout, examples and documentation. GPU correctness is explicitly
`not-run` in this report. Rendering changes and releases need the local GPU checks
listed in [CONTRIBUTING.md](CONTRIBUTING.md).

CI runs the same routine gates plus release metadata validation. Install Chromium
using the [browser verification guide](engineering/browser-verification.md).

For documentation changes, also run `pnpm test:docs`. It checks the composed
site, including docs navigation, live labs, shared search and discovery output.
Normal website builds include Starlight under `/docs/`; the harness checks that
output and the development server.

`pnpm check:artifacts` rejects tracked local notes, design explorations and visual
baselines, including force-added files. Browser commands share an ownership lock
across linked worktrees and clean up their process group; see
[coordination ownership](engineering/agents/coordination.md) for contention and recovery.

| Gate                                                    | Enforcement                                                                                           |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Formatting and import style                             | Oxfmt                                                                                                 |
| Correctness and unused bindings                         | Oxlint                                                                                                |
| Type safety escape routes                               | Reject explicit `any`, `@ts-ignore`, and `@ts-nocheck`; require an explanation for `@ts-expect-error` |
| Type compatibility and core platform independence       | Workspace TypeScript configurations                                                                   |
| Dependency direction, cycles, and exported entry points | Workspace checker and dependency-cruiser                                                              |
| Behavior and tooling regressions                        | Numerical tests and tooling tests                                                                     |
| Built consumer integration                              | Production website build using package exports                                                        |
| Website usability without WebGPU                        | Small Chromium development/production smoke suite; local GPU verification remains separate            |

Keep exceptions narrow and documented. Negative type tests may use explained
`@ts-expect-error`; do not weaken rules or suppress errors merely to get a green build.
Assertions, async ownership, numerical validity, API quality, and appropriate abstraction
still require review. Lint cannot determine whether a design is good.

Each verification run writes `.scratch/agent/run-*/verification.json`, including
timestamps, the actual Node version/platform/architecture, command outcomes, and
source digests before execution and after each command. Digests
cover HEAD, tracked files (including deletions), and nonignored untracked files;
ignored dependencies/build output are outside that scope. A source change observed
after any command fails the run and skips remaining commands. `sourceAfter` is the
last completed snapshot. These are checkpoints, not a continuous file watch: edits
made and restored within one command are not detected. Keep the worktree idle while
verifying. A report marked `running` is incomplete, never a pass.
Keep terminal output with the report when diagnosing a failure. The summary does not
contain source contents or environment-variable dumps. Its `browserReport` points to
per-run test evidence, including website screenshots and browser errors; failures retain traces.
`browserVerification` stays `not-run` if an earlier gate fails. A successful browser
command must also produce complete passing evidence for both projects without skips.

A passing report means only that the automated commands passed for that source
snapshot and the recorded browser suite. It is not a reusable approval or a claim about
untested devices/scenarios. Rerun after further edits; complete relevant manual checks
and design review separately.

## Design review questions

- Can a caller understand the contract without reading the implementation?
- Does the change belong in this module, and do dependencies still point inward?
- Does each abstraction solve a current problem? Could a plain function be clearer?
- Are invalid states excluded or rejected where inputs enter?
- Who owns resources, and what happens on failure, cancellation, stale completion,
  repeated disposal, or seek/reverse when those operations apply?
- Do tests observe the requested behavior, including the regression or edge case,
  with expectations independent of the implementation?
- Are public documentation, release notes/changesets, and examples updated when needed?

For each finding, cite the affected code, violated contract or concrete failure,
and smallest correction. Distinguish a defect from a stylistic preference. The handoff
must include evidence and unverified work; the PR template prompts for both.

## Basis and evolution

The [reference comparison](engineering/references.md) records relevant practices from
TypeGPU, Floating UI, Playwright, and 2026 harness engineering reports.
We adopt practices that fit domfx's size and execution model. When a recurring defect
is found, add a focused regression or boundary rule; add prose only when judgment is
needed. More rules, layers, agents, and coverage percentages do not establish quality.

Use the [harness evaluation guide](engineering/harness-evaluation.md) when changing
the workflow or skills. Compare task outcomes and verification cost, and distinguish
deterministic tooling tests from evidence about an agent's engineering decisions.
