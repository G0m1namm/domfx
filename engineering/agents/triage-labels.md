# Triage labels

Use GitHub open/closed state for completion. Category labels are `bug` and
`enhancement`. Triaged implementation issues have one category and one readiness
state; `blocked` is an additional dependency marker.

| Role                 | Label             | Meaning                                                                              |
| -------------------- | ----------------- | ------------------------------------------------------------------------------------ |
| Needs triage         | `needs-triage`    | Scope or claim needs evaluation.                                                     |
| Needs information    | `needs-info`      | Required information is missing.                                                     |
| Ready for agent      | `ready-for-agent` | Independently executable scope with acceptance checks; blockers still gate starting. |
| Ready for human      | `ready-for-human` | Requires a human decision, participation, or implementation.                         |
| Declined             | `wontfix`         | Declined with a recorded reason.                                                     |
| Blocked              | `blocked`         | Prerequisite acceptance gates remain unresolved.                                     |
| Parent specification | `spec`            | Multi-ticket decision record; not an implementation queue item.                      |

Wayfinding maps use `wayfinder:map`. Their decision tickets use one of
`wayfinder:research`, `wayfinder:prototype`, `wayfinder:grilling`, or `wayfinder:task`.
These carry wayfinding labels rather than implementation readiness labels.

Clear `blocked` only when its prerequisite gates pass. A ready label never overrides
an unresolved blocker or missing evidence. Closed-as-not-planned dependencies do not
prove that their required result was delivered; reconcile their dependents first.
