# AI Hero workflow for domfx

[Matt Pocock’s AI Hero skills](https://www.aihero.dev/skills) are the default planning,
implementation, and review workflow. The full published set is installed in
`.agents/skills`; experimental and miscellaneous upstream skills are outside this set.
[HARNESS.md](../HARNESS.md) describes the executable verification tools beneath it.

## Start here

In Codex, invoke a skill with `$skill-name`, or ask to use it by name. Other clients
may use `/skill-name`. New installations become available on the next turn; if a
client caches its catalog, start a fresh session in this repository.

| Situation                                       | Skill and result                                                                                     |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Unsure where to start                           | `$ask-matt` recommends a flow after reading the relevant skills.                                     |
| An idea needs decisions                         | `$grill-with-docs` records agreed terminology and durable decisions.                                 |
| A design needs something runnable               | `$prototype` makes local UI alternatives or a logic demo; record the approved decision.              |
| External facts are missing                      | `$aihero-research` produces a bounded, cited primary-source report.                                  |
| Agreed work spans several sessions              | `$to-spec`, then `$to-tickets`: a decision record and independently verifiable slices with blockers. |
| One ticket is ready                             | `$implement` uses TDD where applicable, verifies, reviews, and commits task-owned work.              |
| A complete spec has ready tickets               | `$implement-spec` runs independent tickets in isolated worktrees and verifies their integration.     |
| A large effort has unresolved decisions         | `$wayfinder` builds a decision map; it hands off to specification once decisions are settled.        |
| A bug or performance regression needs diagnosis | `$diagnosing-bugs` establishes a reproducer or measurement before testing hypotheses.                |
| Raw issues need shaping                         | `$triage` checks the claim and produces a brief and readiness state.                                 |
| Architecture is causing friction                | `$improve-codebase-architecture` surveys candidates; `$codebase-design` supports module design.      |
| A change needs review                           | `$code-review` independently checks Standards and Spec against the same diff.                        |
| A PR needs a description                        | `$pr` presents the change, evidence, and rollback/blast-radius considerations.                       |
| A session exposed workflow friction             | `$aihero-retro` proposes improvements supported by that session’s record.                            |
| Work must move to another session or workspace  | `$handoff` records decisions, evidence, pointers, and the next action.                               |
| A concept needs teaching                        | `$teach` uses a separate learning workspace and builds on prior lessons.                             |
| A non-code idea needs clarification             | `$grill-me`; `$wait-what` re-explains an unclear response.                                           |
| Someone else holds needed information           | `$to-questionnaire` drafts questions; `$wizard` prepares steps only a human can perform.             |
| Agent guidance needs editing                    | `$writing-for-agents` keeps instructions focused and navigable.                                      |
| The repo’s setup changes                        | `$setup-matt-pocock-skills` updates the tracked tracker, labels, and domain configuration.           |

`tdd`, `grilling`, `domain-modeling`, and `codebase-design` are reusable disciplines
loaded by the appropriate flow. Install availability does not mean running every
skill on every task. User-invoked skills retain their explicit invocation policy;
ask-matt recommends the next command instead of silently launching a new workflow.

## Repository integration

Read this section when a skill links here. Repository contracts and explicit user
instructions take precedence over upstream examples.

- **Configuration:** [issue tracker](agents/issue-tracker.md),
  [triage labels](agents/triage-labels.md), and [domain documentation](agents/domain.md)
  are tracked and sufficient for a fresh clone. GitHub is the canonical backlog.
- **Terminology:** [GLOSSARY.md](../GLOSSARY.md) is the single domain glossary.
  Record new lasting architecture decisions in `engineering/adr/` only when needed.
  Existing ignored notes remain optional; publish contributor-required decisions in
  the issue or tracked guidance, without copying private notes wholesale.
- **Skill calls:** when upstream says “call the Skill tool,” load the named local
  `SKILL.md` and follow it using the tools this client provides. Resolve dependencies
  to this repository’s installed skills. `aihero-research` and `aihero-retro` are
  Matt’s skills; the globally installed `research` and `retro` serve other workflows.
- **Decisions:** reuse approvals and test boundaries from the issue or conversation.
  Ask when a material decision is unresolved. A prototype recommendation does not
  approve a new visual direction; [DESIGN.md](../DESIGN.md) still governs the website.
- **Implementation:** use the TypeScript and relevant browser/GPU/GSAP skills in
  [skills.md](skills.md). Prefer pnpm; use the existing Oxfmt/Oxlint and package
  boundaries. RTK is a local CLI preference when installed, not a new contributor
  prerequisite. Do not copy an upstream example’s framework, formatter, or test runner
  merely because it appears in a skill.
- **Evidence:** start implementation with `pnpm agent:brief`. A linked issue/spec is
  the brief; avoid writing a duplicate. Run focused checks while editing, then
  `pnpm agent:verify` and applicable checks in [CONTRIBUTING.md](../CONTRIBUTING.md).
  The harness includes `pnpm check`; GPU correctness needs real GPU evidence.
  Review and fix actionable findings, rerunning affected checks after changes.
- **Parallel work:** `implement-spec` may run independent ready tickets concurrently,
  within the environment’s available agent slots. Give each worker explicit ownership,
  its own clean worktree based on the integration branch, and notice that other
  workers are active. Workers preserve others’ changes; integration and final
  verification run serially with the integration worktree idle. Research workers
  research directly instead of recursively delegating the same question. Research
  workers that commit or push evidence also receive dedicated worktrees and branches.
- **Memory priority:** lower peak memory is a priority for the test-tooling
  investigation. It is not a general constraint on implementation, agent concurrency,
  or a new runtime/library requirement. Measure test memory with controlled browser
  and server concurrency so concurrent development does not contaminate results.
- **Artifacts and actions:** follow the [artifact policy](artifact-policy.md). Keep design
  exploration prototypes and screenshots local, and record approved conclusions in
  `DESIGN.md` or the issue. Selected non-design research evidence may use a dedicated
  branch with a commit and entry path linked from its issue. Follow the
  invoked workflow’s authorized local commits and draft PR steps; merging to main,
  deploying, and publishing remain separate actions. Preserve unrelated changes and
  unfinished worktrees. Draft questionnaires for the user to send.

## Everyday sequences

A scoped ticket: `$implement #<ticket>` → TDD/focused checks → repository verification
→ Standards and Spec review → task commit and evidence.

A larger agreed change: `$to-spec` → `$to-tickets` → `$implement-spec #<spec>`.
Review the proposed slices and actual blockers before publishing them. Parent specs
are labelled `spec`, not queued as `ready-for-agent` implementation tickets.

An uncertain idea: `$grill-with-docs` → research or prototype if needed → the appropriate
single-ticket or multi-ticket sequence. Use `$wayfinder` when the unresolved decisions
span sessions. Finish a difficult session with `$aihero-retro` while its evidence is
still available.

For the homepage exploration, start from the existing design issue, complete its
`DESIGN.md` format criterion, and use `$prototype` to compare the requested concepts.
For test tooling, research compatibility first, then compare measured peak memory
under equivalent coverage. Reuse existing issues instead of creating duplicates.

## Maintenance and provenance

The pinned source revision and complete installed inventory are in
[aihero-skills.json](aihero-skills.json). Each skill retains the upstream MIT license;
`pr/CREDITS.md` also retains its source attribution. These are adapted copies, not an
auto-updating plugin. Do not install a second plugin copy over the same commands.

Local adaptations: tracked `engineering/agents` and `engineering/adr` paths; the shared
integration pointer; research/retro aliases and matching internal calls; nonrecursive
research and isolated research branches; a separate teaching directory; reuse of approved test seams; proportional specs with a distinct parent
label; repository verification in implement/implement-spec; worktree preservation and
merge-aware completion; repository PR templates; and review of task-owned uncommitted/untracked changes.
Codex invocation policy is recorded in each skill’s `agents/openai.yaml`.

To update, fetch the desired upstream revision into a temporary directory, review
changes against the pinned source, retain licenses/resources, and reapply these
adaptations. Update the manifest after reviewing the diff. Validate frontmatter,
resource links, invocation policies, and both skill aliases; then run the applicable
repository checks. Compare actual workflow outcomes using
[harness-evaluation.md](harness-evaluation.md), rather than assuming more instructions
improve quality.
