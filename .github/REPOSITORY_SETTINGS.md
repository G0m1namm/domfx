# Repository settings

Owner: `G0m1namm/domfx`. Source visibility and npm publication are separate decisions.

## Configured

- Repository stays private; `main` is the default and only long-lived branch.
- Squash merges only, using the PR title and body; delete merged branches automatically.
- Issues enabled, wiki disabled; contributor instructions live in tracked Markdown.
- Dependabot vulnerability alerts enabled. No automatic merge or publishing credentials.
- Private security/conduct contact documented in `SECURITY.md` and `CODE_OF_CONDUCT.md`.
- Actions default to read-only permissions and cannot approve PRs. Private-fork
  workflows are disabled and cannot receive write tokens, secrets or variables.
- CI uses pinned actions, an explicit read-only token, no persisted checkout
  credentials, frozen installs and a ten-minute timeout. Superseded runs are cancelled.

## Before public launch

- [ ] Review tracked content and history for secrets, private notes and redistribution
      rights. Keep `PROJECT_CONTEXT.md`, `/docs/` and `.scratch/` out of Git;
      remove historical copies of private notes before publication. Retain both MIT notices.
- [ ] Owner explicitly approves changing visibility to public.
- [ ] Enable GitHub private vulnerability reporting; keep the existing email
      channel available. Do not solicit sensitive reports through public issues.
- [ ] Require approval for **all external contributors** before fork PR workflows run.
- [ ] Obtain a successful `Check / workspace` run; local checks do not replace
      server-side enforcement.
- [ ] Enable a ruleset targeting `main`: require PRs, resolved conversations,
      linear history and the successful workspace check; block force pushes and
      deletion. Select the actual check from a successful run before requiring it.
      Require no peer approvals while there is only one maintainer; require one
      independent approval once a second reviewer is available. Keep any emergency
      admin bypass explicit and limited.
- [ ] Enable available free secret scanning/push protection; review security settings.

Enable visibility-dependent settings at launch. Hooks alone cannot protect `main`.

Packages remain `private: true` until packed-consumer, browser and release gates pass.
Future PRs add squash commits; do not keep rewriting public history into one commit.

References: [GitHub rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets),
[Actions permissions](https://docs.github.com/en/rest/actions/permissions).
