# Changesets

Run `pnpm changeset` for consumer-facing library changes. Select only affected
library packages, select `patch` while unpublished, and describe the user-visible result. Commit the generated file
with the implementation. Tooling, lab-only and contributor-doc changes do not
need a package release; use `pnpm changeset --empty` when release status requires
an explicit no-release record for changed package files.

Packages remain private. Changesets can rehearse library version/changelog updates,
but does not commit or tag automatically. The lab is excluded from version planning.

See [RELEASING.md](../RELEASING.md) for policy and gates. Do not run publish commands.
