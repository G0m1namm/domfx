---
name: implement
description: "Implement a piece of work based on a spec or set of tickets."
disable-model-invocation: true
---

Read the [domfx integration](../../../engineering/agent-workflow.md#repository-integration) before running this skill.


Implement the work described by the user in the spec or tickets.

If the user passes a ticket reference, fetch it from the issue tracker and state its title before starting. If the reference is ambiguous, ask.

Call the Skill tool with "tdd" where possible, at pre-agreed seams.

Run focused checks during implementation. After edits settle, run `pnpm agent:verify` and the applicable browser/GPU/manual checks in `CONTRIBUTING.md`. The harness already includes `pnpm check`; repeat affected checks after review fixes.

Once done, call the Skill tool with "code-review" to review the work.

Commit only this task's changes on its feature branch after verification and review. Preserve unrelated work. Follow the repository tracker rules for PRs and completion.
