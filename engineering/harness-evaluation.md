# Evaluating the development harness

Evaluate two things separately: whether the tooling behaves correctly, and whether
the instructions help an agent deliver the requested change. Neither proves the other.

## Tooling regression run

Run `node --test scripts/agent-harness.test.mjs` for focused runner checks, then
`pnpm agent:verify` for the complete repository gates. The runner tests use temporary
Git repositories and real child processes with a local test launcher; they require
no model service, network, browser, or maintainer-only notes.

The suite covers successful commands, failure at either stage, missing/throwing
launchers, termination signals, incomplete reports during execution, separate report
paths, source edits/deletions, ignored artifacts, invocation outside the checkout,
and symlink invocation. It also reproduces a change in the first command that a later
command would restore: verification must stop before that later command runs.

This tests the launcher boundary. The real `pnpm agent:verify` run tests the actual
workspace commands. Check the overall report status, not just individual exit codes.

## Skill and workflow trials

For a proposed instruction change, choose a small completed issue or reproducible
failure as the evaluation case. Keep its starting revision, user request, fixtures,
acceptance checks, model/settings, and tool availability the same for baseline and
candidate runs. Use separate clean checkouts and sessions so the candidate does not
inherit the baseline's diagnosis. These trials are manual and are not run by CI.

Use cases from the work domfx actually needs:

| Case                                 | Evidence to inspect                                                                                                    |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| TypeScript or core change            | Correct caller-visible behavior, independent expectations, preserved package boundaries, and no speculative public API |
| GPU numerical or shader defect       | First incorrect pipeline stage identified; justified precision/layout; independent oracle and real browser results     |
| Capture or geometry defect           | Explicit CSS/raster/viewport mapping; original target remains usable; reproducible browser checks                      |
| GSAP seek/reverse or disposal defect | Deterministic controls; scoped cleanup; caller-owned state preserved; correct skill selection                          |
| Small contributor-document change    | Proportional context and verification; no renderer changes or irrelevant specialist loading                            |

Keep some comparable issues out of instruction tuning and use them only for final
comparison. Do not give the implementation agent the expected patch or a prior
diagnosis. A maintainer should inspect whether the resulting change satisfies the
original contract and whether any changed tests weakened it. Tooling success and
an agent's own quality rating are insufficient grading signals.

Record acceptance criteria passed/failed/not-run, review defects by severity,
unnecessary changes, retries, elapsed time, and tokens/cost only if actually available.
Repeat meaningful comparisons before claiming a quality or speed improvement; one
successful run or a larger rule catalog does not establish that improvement.

Change one failure-driven part of the harness at a time. Keep it only when the
observed benefit justifies the extra instructions, runtime, and maintenance.

## #184 workflow exercise

For a representative small UI correction, run its focused check while editing, then
run `pnpm agent:verify` once the source is settled. The smoke step consumes the build
from that same run; a source or identity change requires a new run with its reason
recorded. For an interrupted task, resume from the continuation record, compare its
revision/diff and test boundary, then perform the listed next action rather than
replaying a session transcript.

On 2026-10-25, the integrated smoke selection expanded from 22 to 54 development/
production cases. The prior 22-case run took 41.6 s and the 54-case run took 57.8 s
using existing built output; four representative restored UI cases then passed in
8.5 s. These runs establish the exercised sequence and expanded coverage, not a
general speedup: coverage differs, and timing needs comparable repeated measurements.

## Current limits

- Runner regressions do not measure skill-trigger accuracy or agent coding quality.
- Builds and numerical tests alone do not execute WebGPU. The harness now runs the
  [browser suite](browser-verification.md); its existing scenarios do not cover every
  browser, geometry, lifecycle transition, or visual regression.
- Source checkpoints do not make verification hermetic or tamper-proof. Dependencies,
  ignored local files, and edits restored within a command are outside their guarantee.
- The local runner inherits command execution; it has no general watchdog or automatic
  retry. Playwright bounds browser/server execution, and CI has a job timeout.
  An interrupted run is incomplete.

See the [2026 research comparison](references.md#2026-harness-research) for the basis
of this evaluation approach.
