# Repository settings

Owner: `G0m1namm/domfx`. Source visibility and npm publication are separate decisions.

## Current GitHub settings

Read-only REST snapshot: 2026-10-18 20:53 UTC. Source-controlled workflow settings and
maintainer policy are listed separately below.

- Repository is private; `main` is the default and only currently advertised branch.
- Squash merges only; merge commits and rebase merges disabled. Merged branches are
  deleted automatically.
- Issues enabled, wiki disabled.
- Description set to `GPU edge effects for live DOM elements`. Topics configured:
  `animation`, `browser`, `gsap`, `typescript`, `webgpu`. Homepage is left unset
  until a verified public deployment exists.
- Actions default to read-only permissions and cannot approve PRs. Action SHA pinning
  is enforced (`sha_pinning_required: true`).

## Source configuration and maintainer policy

- `main` is the only intended long-lived branch. Squash commits use the PR title and body.
  Contributor instructions live in tracked Markdown.
- Dependabot vulnerability alerts are part of the maintenance routine. Keep automatic
  merge and publishing credentials disabled; verify alert status at launch.
- Private security/conduct contact is documented in `SECURITY.md` and
  `CODE_OF_CONDUCT.md`.
- Keep private-fork workflows disabled and without write tokens, secrets or variables;
  verify the live fork setting before launch.
- CI uses pinned actions, an explicit read-only token, no persisted checkout
  credentials and frozen installs. The workspace job has a fifteen-minute limit.
  CI installs Chromium for a small website smoke suite with WebGPU unavailable;
  full GPU, visual and performance suites remain local. Superseded runs are cancelled.

## Before public launch

- [ ] Review tracked content and history for secrets, private notes and redistribution
      rights. Keep `PROJECT_CONTEXT.md`, `/docs/` and `.scratch/` out of Git.
      Assess reachability and sensitivity of historical notes: distinguish harmless
      historical documentation from sensitive material. Do not rewrite history or
      force-push merely to remove non-sensitive notes or clutter; reserve destructive
      remediation for confirmed secrets, credential leaks, privacy exposure, or
      redistribution violations — each requiring explicit owner authorization. Retain
      both MIT notices.
- [ ] Owner explicitly approves changing visibility to public.
- [ ] Enable GitHub private vulnerability reporting; keep the existing email
      channel available. Do not solicit sensitive reports through public issues.
- [ ] Require approval for **all external contributors** before fork PR workflows run.
      (Setting returns 422 while private; enable when public.)
- [ ] Obtain a successful `Check / workspace` run; local checks do not replace
      server-side enforcement.
- [ ] Enable a ruleset targeting `main`: require PRs, resolved conversations,
      linear history and the successful workspace check; block force pushes and
      deletion. Select the actual check from a successful run before requiring it.
      Require no peer approvals while there is only one maintainer; require one
      independent approval once a second reviewer is available. Keep any emergency
      admin bypass explicit and limited. (Rulesets API returns 403 on private Free plan;
      enable immediately after visibility becomes public.)
- [ ] Enable available free secret scanning/push protection; review security settings.

Enable visibility-dependent settings at launch. Hooks alone cannot protect `main`.

Only core, browser and GSAP have public publication metadata for the alpha candidate;
other workspaces stay private. Candidate metadata does not authorize publication.
The [exact-artifact release gates](../RELEASING.md) still apply.
Future PRs add squash commits; do not keep rewriting public history into one commit.

## Maintenance routine

- **Scope**: Updates to npm dependencies, GitHub Actions, tooling, and vendored skills.
- **Owner and cadence**: Maintainer-owned. Routine updates are reviewed monthly; Dependabot
  vulnerability alerts and security advisories are triaged promptly upon arrival.
- **Checks required**:
  - `pnpm check` (formatting, linting, workspace boundaries, tooling tests, packed contract
    types, typechecks, unit tests) on every change.
  - Website smoke suite (`pnpm test:web:smoke`) and full website checks (`pnpm test:web`)
    when web or framework dependencies change.
  - Local GPU test suite (`pnpm test:gpu` / `pnpm test:gpu:full`) whenever rendering, capture,
    or GPU dependencies change (e.g. TypeGPU, SnapDOM, Playwright, Chromium).
  - Frozen lockfile verification: `pnpm install --frozen-lockfile` must pass in CI.
  - Action updates must be pinned to full immutable commit SHAs with reviewed diffs.
  - `pnpm test:tooling` checks repository tooling conventions;
    `scripts/conventions.test.mjs` checks that formatting and linting exclude vendored
    skill directories. For skill updates, review the manifest, frontmatter, resource
    links, licenses, and invocation policies as described in
    [engineering/agent-workflow.md](../engineering/agent-workflow.md).
- **Automation policy**: Dependabot vulnerability alerts provide passive security monitoring.
  No automated dependency-update bot (such as Dependabot version updates or Renovate) is
  currently configured. Review updates manually for now; revisit automation if maintenance
  overhead or update frequency warrants it.

References: [GitHub rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets),
[Actions permissions](https://docs.github.com/en/rest/actions/permissions).
