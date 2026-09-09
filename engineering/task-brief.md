# Task brief

Use this in the issue, task conversation, or an ignored `.scratch/` note.
For a small fix, a few sentences covering these points are sufficient.

## Contract

- Request or issue:
- Observable result and explicit non-goals:
- Owning module/package and existing implementation/test to follow:
- Inputs, outputs, invariants, compatibility, and public API impact:
- Resource ownership, disposal, async ordering, and expected failures (if relevant):

## Design choice

- Simplest implementation and why it is sufficient:
- Alternative considered and concrete reason to reject it (for material decisions):
- New dependency, abstraction, or public export and the current need it serves:
- Open question that changes behavior or scope, if any:

## Acceptance and implementation

| Observable acceptance criterion      | Verification scenario                      | Implementation step         |
| ------------------------------------ | ------------------------------------------ | --------------------------- |
| Describe the caller-visible behavior | Name the test or reproducible manual check | Name the owning file/module |

For bugs, show the regression failing before the fix. For refactors, preserve
behavior checks before and after. Include boundary/failure cases where relevant.

## Handoff evidence

- Final behavior and changed files:
- Automated verification report and outcome:
- Browser/GPU results for development and production, or why not applicable:
- Design/contract review findings and their resolution:
- Remaining limitations and any follow-up scope:

Only mark a check as passed after observing it. Keep secrets out of briefs and reports.

## Continuation (only for interrupted work)

Record the current source revision/diff, completed acceptance checks and evidence,
unresolved decisions or blockers, and the next concrete action. On resuming, compare
the current worktree with that record before relying on earlier verification.
