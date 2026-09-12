# Releases

This is preparation tooling, not an enabled publishing pipeline. All packages
remain `private: true`; there are no publish scripts, registry credentials or
release workflows. Repository visibility does not change package visibility.

## Packages and versions

- `@domfx/core`, `@domfx/browser` and `@domfx/gsap` are provisional names. Confirm npm scope/name
  ownership before publication; then update manifests and Changesets references together.
- Version libraries independently. Changesets also updates affected internal dependents.
  The workspace root and apps stay private; website deployments are separate.
- While unpublished, use patch-only development increments: `0.0.1`, `0.0.2`,
  `0.0.3`. Select `patch` in Changesets for library changes and group tasks into
  deliberate development releases, not one version per task. Describe breaking
  changes explicitly even during this private development phase.
- Before the first public release, switch to SemVer: patch for compatible fixes, minor for compatible additions, major
  for breaking changes. During `0.x`, use minor for breaking changes and call them
  out explicitly; do not hide breaking changes in patches.
- First public testing should use an opt-in prerelease such as `0.1.0-alpha.0`
  with an `alpha` distribution tag, not `latest`. A prerelease is still public.

## Contributor workflow

For consumer-facing changes, run `pnpm changeset` and commit the generated Markdown
with the implementation. Describe observable behavior and migration steps, not
commit bookkeeping. A core/browser change may require both packages in the plan.
Commitlint validates commits; Changesets records release intent. Neither replaces the other.

Tooling, lab-only and contributor-doc changes need no package bump. Keep changesets
out of private notes: they are public release documentation.
If `release:status` reports changed packages without a changeset, record a deliberate
no-release change with `pnpm changeset --empty`.

## Available now

| Command                  | Purpose                                                               |
| ------------------------ | --------------------------------------------------------------------- |
| `pnpm changeset`         | Record a package change; no version bump or publication               |
| `pnpm release:status`    | Inspect pending version changes without applying them                 |
| `pnpm release:artifacts` | Inspect package file lists after building; no tarballs or publication |
| `pnpm release:check`     | Run checks, production build, release status and artifact inspection  |

Artifact inspection allows only package metadata, README, license, changelog and
compiled JavaScript/declarations. It checks that every declared export is present.
It does **not** prove shader execution, fresh-consumer installation, SSR safety or
API readiness. Those remain separate release gates.

For a local version rehearsal, use a disposable checkout and run
`pnpm changeset version`, followed by `pnpm install --lockfile-only` and
`pnpm format`. This consumes changesets and edits versions/changelogs; never run it
casually in a shared working tree. No version bump is part of this initial setup.

## Enable later, through a reviewed change

1. Confirm npm ownership/names, package contents and public API. Pass packed-consumer
   GPU, types/SSR, lifecycle and preview-readiness gates. Review private Git history.
2. Approve a release PR with versions/changelogs and passing CI. No publication from
   contributor PRs or ordinary feature merges; one `main` branch is enough.
3. Configure a restricted release workflow and npm trusted publishing. Explicitly
   choose public package access, remove `private` only from approved libraries and
   review the prerelease tag. Never give publishing permissions to test jobs.
4. Require maintainer approval for publication. Publish the tested artifacts, then
   create per-package tags and release notes for the exact released commit.
5. If publication partially fails, inspect the registry before retrying. Published
   versions are immutable: never reuse a version for different bytes. Correct a bad
   release with a new version and deprecate the affected one when appropriate.

Until those gates are approved, keep `access: restricted`, private package flags
and private tagging disabled. These are preparation safeguards, not authorization
to publish private npm packages. No npm account setup is automated here.

References: [Changesets configuration](https://changesets.dev/guide/config),
[npm trusted publishing](https://docs.npmjs.com/trusted-publishers/).
