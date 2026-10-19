# Releases

The first alpha uses manual Changesets preparation, a normal reviewed release PR,
and deliberate publication of verified tarballs. Automatic version PRs can wait
until several releases establish a useful routine; there is no generated-release
validator. All packages currently remain `private: true`. The dispatch-only
publication workflow is disabled and has no hosted preparation or registry job.
Repository visibility and npm publication are separate maintainer actions.

## Packages and versions

- `@domfx/core`, `@domfx/browser` and `@domfx/gsap` use the selected `@domfx` scope. The maintainer reports creating the organization
  with account `g0m1namm`; verify actual publish permissions for all three packages
  before approval. Another package named `domfx` does not determine ownership of
  these scoped names.
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

Tooling, fixture-only and contributor-doc changes need no package bump. Keep changesets
out of private notes: they are public release documentation.
If `release:status` reports changed packages without a changeset, record a deliberate
no-release change with `pnpm changeset --empty`.

## Available now

| Command                  | Purpose                                                                |
| ------------------------ | ---------------------------------------------------------------------- |
| `pnpm changeset`         | Record a package change; no version bump or publication                |
| `pnpm release:status`    | Inspect pending version changes without applying them                  |
| `pnpm release:artifacts` | Inspect package file lists after building; no tarballs or publication  |
| `pnpm release:rehearse`  | Rehearse standalone/GSAP tarball consumers, SSR, types and GPU cleanup |
| `pnpm release:check`     | Run checks, production build, release status and artifact inspection   |

Artifact inspection allows only package metadata, README, license, changelog and
compiled JavaScript/declarations. It checks that every declared export is present.
It does **not** prove shader execution, fresh-consumer installation, SSR safety or
API readiness. Those remain separate release gates.

## Local artifact rehearsal

The [consumer quickstart](QUICKSTART.md) documents the local installation path and
the standalone/GSAP setup modules in `examples/quickstart/`. The rehearsal copies
those exact modules into its fresh consumers and exercises them through public APIs.

Install Chromium once with `pnpm --filter @domfx/gpu-tests exec playwright install chromium`,
then run `pnpm release:rehearse`. It builds and packs the current core, browser and
GSAP libraries without changing versions or publishing. A desktop session and a
WebGPU-capable Chromium are required. `DOMFX_BROWSER_EXECUTABLE` optionally selects
an existing Chromium executable. Missing GPU/browser support fails the rehearsal.

The command creates two temporary consumers outside the repository, both using the
same local tarballs. The standalone consumer installs no GSAP; the other explicitly
installs GSAP with strict peer validation. A local core-tarball override resolves
the packed internal version without a registry release. This is tarball consumption,
not workspace linking. Consumers use stock Vite with no source aliases or TypeGPU
plugin, and compile their actual fixture under strict NodeNext and Bundler resolution
with declaration checking enabled. The existing core/browser SSR and export checks
run from the standalone install; the optional adapter also imports without browser globals.

Production checks use public `attachFire`/`bindFire` APIs with real capture and GPU
rendering: nonempty pixels, forward/backward seek, zero/restored intensity, changed
silhouette refresh, controlled unsupported-composition failure and explicit retry,
retained controls/binding, repeated disposal, original-target interaction and reattachment.
Binding cleanup must preserve a caller-owned timeline sibling. Cleanup checks observe
removed/zero-sized canvases and released target ownership; they do not measure total
VRAM or replace the fixtures' resource-accounting and lifecycle stress checks.

The printed temporary directory retains `report.json`, tarballs, command logs, installed
consumers, production builds and per-stage PNGs. The report records artifact SHA-256s,
SHA-512 registry-integrity values, actual tar file inventories/manifests, resolved install
paths, credential-free source repository/revision/tree identity, dirty state, lockfile and
production asset hashes, Node/browser/GPU environment and checks.
Archive that directory when retaining release evidence; the OS may remove temporary files.
On a consumer browser failure, retain its `failure.png` and the report's native-selection
focus, pointer-target and layout observations when the heading check was reached.
Artifact inspection checks required exports, transformed shader metadata, the existing
file allowlist, fixture/test paths and common private-key/token signatures. This is a
bounded accidental-content check, not a comprehensive secret or Git-history audit.

A passing run covers these Vite/Chromium consumers on the recorded GPU. It does not
establish broad browser/bundler support, physical device-loss recovery or publication
readiness. Run `pnpm agent:verify` separately for the full repository gate.

## Exact-artifact handoff

Publication is disabled: `.github/workflows/publish.yml` intentionally has no hosted
preparation, upload or registry job. A hosted Linux build cannot stand in for the locally
GPU-verified tarballs. On the WebGPU-capable machine, start from a clean checkout of the
approved revision, run the local rehearsal, then verify the retained directory before
transporting it:

```sh
approved_commit="$(git rev-parse HEAD)"
evidence_directory=/path/printed/by/release-rehearse
transport_directory=/path/outside/checkout
pnpm release:rehearse
pnpm release:handoff "$evidence_directory" "$approved_commit"
mkdir -p "$transport_directory"
tar -C "$(dirname "$evidence_directory")" -czf "$transport_directory/domfx-tested-evidence.tgz" "$(basename "$evidence_directory")"
(
  cd "$transport_directory"
  shasum -a 256 domfx-tested-evidence.tgz > domfx-tested-evidence.tgz.sha256
)
```

Transport both archive files through an approved maintainer channel. At the receiving clean
checkout of the same approved revision, inspect the transport hash, unpack it and recheck the
unchanged evidence:

```sh
approved_commit=<approved-commit>
checkout_directory=/path/to/clean/checkout
transport_directory=/path/outside/checkout
(
  cd "$transport_directory"
  shasum -a 256 -c domfx-tested-evidence.tgz.sha256
  tar -xzf domfx-tested-evidence.tgz
)
git -C "$checkout_directory" switch --detach "$approved_commit"
(
  cd "$checkout_directory"
  pnpm release:handoff "$transport_directory/domfx-tested-evidence" "$approved_commit"
)
```

This is read-only: it compares the evidence's normalized repository identity, commit and
Git tree to the current checkout, rehashes every retained tarball with SHA-256 and SHA-512,
and requires both fresh-consumer reports and their GPU/recipe proof. The rehearsal and
handoff both require clean source checkouts; the handoff does not repack tarballs or turn
policy decisions into approval. If it fails, retain the report, tarballs, logs and failure
screenshots; a source or hash mismatch requires a new rehearsal from the approved source,
while a transport failure may be recovered only by restoring the unchanged archived evidence
and rerunning this command.

This technical handoff holds, rather than resolves, release-policy, package-version, license,
ownership, credential and registry decisions. Those gates require their separate review before
any publication path is enabled.

For a local version rehearsal, use a disposable checkout and run
`pnpm changeset version`, followed by `pnpm install --lockfile-only` and
`pnpm format`. This consumes changesets and edits versions/changelogs; never run it
casually in a shared working tree. No version bump is part of this initial setup.

## Prepare the first alpha manually

Finish the implementation checks before freezing release artifacts. Use a clean
release branch from the reviewed `main` commit; do not version a shared dirty tree.
The first-alpha changeset requests `0.1.0` for all three libraries. Later releases
remain independent and Changesets updates affected internal dependencies.

```sh
pnpm changeset pre enter alpha
pnpm changeset version
pnpm install --lockfile-only
pnpm changeset --empty
pnpm format
pnpm release:status --since origin/main
pnpm release:check
```

The empty changeset records metadata-only version/changelog/lockfile preparation
so the ordinary PR check passes after release changesets are consumed; it requests
no extra bump. Preserve real consumer-facing changesets in feature PRs. Review the
actual versions, pre-state, changelogs and packed dependency graph. Keep `alpha`
prerelease mode until deliberately graduating; never publish this alpha as `latest`.

In that release PR, remove `private` only from the three approved libraries,
retain `publishConfig.access: public`, and change Changesets access to `public`.
Root, fixtures, website and any other package stay private. This preparation does not
publish; publication remains a separate approval of tested bytes.

## Alpha readiness and the deferred feedback round

Before approval, require public API/ownership review, licenses and redistribution
rights, content/history review, `pnpm agent:verify`, website checks and fresh packed
consumer proof. Review the [browser/device record](engineering/browser-support.md)
without turning a fixture pass into broad support or performance claims.

For the first **experimental alpha only**, independent developer validation moves
after publication: the public install/docs route must exist before that round can
test it. This exception does not waive technical, license or maintainer readiness.
Reconcile the existing #35/#36/#41 acceptance records when presenting the release;
do not mark independent onboarding, cleanup or developer value proved yet.
After registry/docs proof, the maintainer may post a LinkedIn alpha invitation and
collect comments/issues, with one opt-in round of three developers if available.
Measure the complete install → own heading → own timeline → seek/reverse → cleanup
journey only in actual sessions. The 2–5 minute target is a hypothesis, not a CI
budget or a measured claim. No automated outreach or telemetry is required.

## Held publication approval

There is no executable publication workflow or approved registry procedure. Do not set
`DOMFX_PUBLISH_ENABLED`, dispatch the disabled workflow, configure a trusted publisher or
run `--publish`. #36 must resolve the separate readiness, ownership, package-version,
license, credential and registry decisions before a new publication path is designed and
reviewed. That later path must consume the archived evidence above without rebuilding or
repacking it, verify the same clean revision and hashes, and stop for inspection if a
partially published version, integrity value or alpha tag differs. Published versions are
immutable; repair any bad release with a new version.

## Verify the public installation route

From the matching released checkout, download the tested evidence directory and run:

```sh
pnpm release:verify:registry <tested-evidence-directory> <approved-commit>
```

This verifies registry integrity against approved bytes and installs exact released
versions into fresh standalone/GSAP consumers **without local core overrides**.
It records resolved versions, lockfile hashes, SSR/types, stock Vite, real GPU and
lifecycle evidence; standalone still must not install GSAP. It fails if packages
are missing or dependencies/peers cannot resolve. It is separate from local tarball proof.

Only after that pass, update site installation/upgrade instructions and the concise
Prompt with exact verified versions and public docs. Run the exact rendered recipe
on a real selectable heading and caller-owned timeline; retain button interaction,
seek/reverse, unavailable/reduced-motion and early/late cleanup checks. Verify public
source/docs links anonymously. Then invite feedback. Until then the site says
unpublished and links to matching local artifacts, never an invented npm command.

References: [Changesets configuration](https://changesets.dev/guide/config),
[npm trusted publishing](https://docs.npmjs.com/trusted-publishers/).

GPU checks remain local for routine development. Before a release run
`pnpm test:gpu:full`, `pnpm test:web`, `pnpm test:visual` and `pnpm release:rehearse`.
The publication workflow is disabled and performs no hosted preparation. Routine website
smoke is not publication GPU evidence.
