# Issue tracker: GitHub

[GitHub Issues](https://github.com/G0m1namm/domfx/issues) is the source
of truth for scope, decisions, acceptance evidence, blockers, and completion.
Run `gh` inside the clone so it resolves the repository from Git remotes.
Before writes, inspect `git remote -v` and
`gh repo view --json nameWithOwner --jq .nameWithOwner`; verify the resolved repository
matches the task's intended tracker (the canonical backlog above for domfx work).
For forks or multiple remotes, use `--repo <owner>/<repo>` when needed to select that
verified target. Replace API placeholders with the same verified owner and repository.
If access fails, check the active GitHub account and repository access before
concluding the repository is missing. Keep credentials out of output.

## Operations

- Read: `gh issue view <number> --json number,title,body,labels,comments`.
- Discover: `gh issue list --state open --limit 100 --json number,title,labels`;
  paginate when necessary and read full bodies/comments for selected work.
- Create/edit: write the exact multiline Markdown to a temporary file and use
  `gh issue create` or `gh issue edit` with `--body-file <path>`.
  Search for overlapping work first. Read back mutations to confirm the result.
- Comment: `gh issue comment <number> --body-file <path>`.
- Labels/claims: `gh issue edit <number> --add-label <label>`
  or `--add-assignee @me`; use [triage-labels.md](triage-labels.md).
- Resolve ambiguous issue/PR references using `gh api repos/<owner>/<repo>/issues/<number>`:
  the `pull_request` field identifies a PR. Read its diff with `gh pr diff` when relevant.

**PRs as a request surface: no.** Incoming PRs are not automatically part of the
triage queue. Explicitly requested PR reviews still apply.

## Work and completion

Create one implementation issue per independently verifiable vertical slice. Include
contracts, scope, approved test boundaries, non-goals, blockers, and observable
acceptance checks. A contributor must be able to work from the issue and tracked
files alone. A multi-ticket parent specification gets `spec`; implementation slices
get the applicable readiness state. Do not duplicate an existing backlog.

For code changes, link the implementation PR to its issues using closing references.
Keep implementation issues open until the change is merged and acceptance evidence
is recorded. A local commit or completed worker is not a merged result. Exploration
and decision issues may close when their documented deliverable/decision and evidence
are complete. A design proposal needs the user’s actual decision before being
recorded as approved. Publication and releases retain their own gates.

## Wayfinding operations

- **Map:** create one `wayfinder:map` issue with Destination, Notes, Decisions so far,
  Not yet specified, and Out of scope. Decisions live in child tickets; the map links them.
- **Child:** create the decision issue with its `wayfinder:<type>` label. Get its numeric
  database ID with `gh api repos/<owner>/<repo>/issues/<child> --jq .id`; link it using
  `gh api --method POST repos/<owner>/<repo>/issues/<map>/sub_issues -F sub_issue_id=<id>`.
- **Block:** get the blocker’s database ID and call
  `gh api --method POST repos/<owner>/<repo>/issues/<child>/dependencies/blocked_by -F issue_id=<id>`.
  A database ID is not an issue number or GraphQL node ID. Create issues before wiring links.
- **Query:** list map children using the paginated `issues/<map>/sub_issues` API route.
  Inspect open blockers using `issues/<child>/dependencies/blocked_by`. Select open,
  unclaimed tickets with satisfied dependencies, in map order.
- **Fallback:** only when the API feature is unavailable, keep a linked child task list
  on the map, `Part of #<map>` on children, and explicit `Blocked by` links on children.
  Query the linked issues to establish readiness. Permission/auth failures are not a
  reason to silently switch to a local tracker.
- **Claim:** the coordinator assigns a ticket to the driving developer before dispatch,
  records which session/worktree owns it, and checks for an existing claim. An assignee
  is a coordination signal, not an atomic lock; two sessions using one account must
  reconcile claims before doing duplicate work.
- **Resolve:** post the decision and evidence as a resolution comment, close the completed
  decision ticket, and add its named link and one-line result to the map. Distinguish
  completed decisions from tickets closed as out of scope.

Implementation ticket graphs use the same dependency links. Before dispatch, read
the linked blockers and verify their required result, not just their closed state.
Workers may run concurrently in separate worktrees; the coordinator serializes
integration, updates issues from current state, and verifies the integrated result.
