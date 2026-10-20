# Coordination ownership

Use the installed Orca `orchestration` skill and its version-matched CLI guide for
commands. These repository rules define who owns work and evidence.

## Dispatch and review

The coordinator gives each implementation dispatch its own worktree, task scope,
acceptance checks and next owner. Only that dispatched worker sends its completion
message, using its own live task and dispatch IDs, after its edits and checks stop.

An Orca implementation worker returns its commit/diff and evidence to the coordinator
for review. It does not launch nested reviewers with an inherited dispatch preamble.
The coordinator launches independent Standards and Spec reviews with fresh context:
the fixed revision, diff command, task paths, contract and standards pointers.
Reviewers receive their own dispatch IDs when run through Orca, never the implementer's.
They report findings without editing files or settling another worker's dispatch.
The coordinator routes fixes to an implementation worker and repeats affected checks.

Before accepting completion, compare the message's task/dispatch IDs, worktree,
revision and check results with the assigned work. An unexpected completion is an
ownership incident: preserve the diff, inspect live worker state, and use Orca's
recovery guide. Issue closure still follows the merge/evidence rules in
[the tracker guide](issue-tracker.md).

This workflow avoids inherited completion duties; it does not add authorization to
Orca itself. Runtime rejection of another worker's completion requires an Orca change.

## Browser and server ownership

Repository browser test and measurement scripts use `scripts/browser-session.mjs`.
It reserves one browser session across linked Git worktrees before starting the
command. A competing run fails with the owner PID, worktree and record path; wait
for that owner to finish and retry. This prevents overlapping test ports and noisy
measurements without terminating someone else's work.

For a focused CLI check, use `pnpm browser:run <command> [args...]`. For manual browser
work, the coordinator grants one window, records the browser/tab and any server
PID, port, worktree and log path in its local handoff, and pauses automated browser
runs until that window is released. Raw CLI invocations and GUI/MCP browser activity
do not acquire the lock automatically. Keep the verified worktree idle.

The runner records its PID, worktree, command and child process group at
`<git-common-dir>/domfx-browser-session/owner.json`. On normal exit, failure, SIGINT
or SIGTERM, it terminates that group and removes the lock. Forced termination
(SIGKILL), detached grandchildren and manual browser tools require owner inspection.
For a retained lock, inspect the recorded wrapper and process group before removing
the lock directory; never kill by port number or delete a live owner's lock.

Cleanup applies only to owned resources. Keep intentionally retained previews in
the handoff with their owner and stop command. Store logs and screenshots under
ignored `.scratch/`; publish conclusions and reproducible checks, not raw sessions.
