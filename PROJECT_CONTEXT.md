# domfx: read this first

## Product

A framework-agnostic GPU effects engine for arbitrary DOM, with GSAP as the first-class animation adapter. First audience hypothesis: creative developers making expressive headline/logo/button/hero effects while preserving semantic, interactive DOM.

Initial path: target → captured alpha → signed distance field → procedural fire edge → GSAP control. One fixture proves the first path; five target classes and two simultaneous targets validate the preview. This is not a text-only product.

## Design status

The architecture was refined using Matt Pocock's `grill-with-docs` and a separate AI respondent. Those reviews are reasoned planning proposals, not customer validation. Read `docs/architecture-proposal.md` for the current complete contract and `docs/grilling-review.md` for the Q&A and challenges. The proposal supersedes the original scaffold assumptions. The browser spike's latest verification is in `docs/evidence/monorepo/README.md`; its capture contracts, numerical helpers and experimental renderer are implemented, but no stable attachment API is claimed.

## Working decisions

- Implemented pnpm monorepo: `packages/core`, `packages/domfx` and `apps/lab`; optional GSAP and website workspaces when needed. The future app requires product discovery. See ADR 0005. Packages remain private; registry names and licensing are not decided.
- Explicit target silhouette; alpha threshold 128/255, coverage preserved, inner contours included. Opaque container means container silhouette.
- One canvas per target in a caller-supplied positioned HTML host; one shared GPU service/device per Document. Preview validates translate/positive scale and nested scrolling; universal CSS composition is future work.
- Core owns lifecycle/parameters. Browser adapters own DOM capture/placement; renderer owns upload/SDF/GPU cleanup and receives no Element.
- Live placement, observed or explicit raster refresh. Known dirty content hides the old effect until replacement succeeds. Pause time, not alignment.
- Explicit ambient/manual clocks; deterministic time/seed/intensity. GSAP uses manual mode, owned child tweens and explicit context cleanup. Never kill a caller-owned timeline.
- Unavailable GPU/capture leaves usable ordinary DOM. Reduced motion defaults to no effect. SSR-safe imports and idempotent cleanup.

## Stack correction and evidence

The 2026-09-07 spike uses TypeGPU 0.12.4 + `@typegpu/sdf` 0.12.0 and corrected `@zumer/snapdom` 2.24.15, with the lockfile updated. Real capture/upload/JFA/readback passes a Float64 oracle; deterministic GPU fire and a GSAP ownership example also pass. The earlier shader-metadata blocker was Vite's demo root missing the root configuration; explicit `--config vite.config.ts` fixes both development and production builds.

`pnpm check` now checks source/demo types and four numerical tests. Browser evidence separately covers five captured target classes, overflow/shadow/background and untransformed-paint guards, full-raster GPU oracle checks, fixed-time fire, GSAP seek/context cleanup, warm rebuild timing and explicit disposal. These are bounded fixture results on one machine, not general lifecycle/support claims. Browser/native transport and vGPU remain later adapters; no second backend or plugin registry now.

## Next work

The approved execution backlog is [.scratch/preview/README.md](.scratch/preview/README.md): 40 linked tickets. Monorepo migration is implemented; next verify a packed consumer and automate the browser fixtures. Read ADRs 0001–0005, the MVP spec and [migration verification](docs/evidence/monorepo/README.md) before implementation. The sequence then exposes the reusable attachment, optional GSAP adapter and bounded capture/placement/lifecycle behavior. Preserve five-target/two-live-target coverage; failed gates need a fix or explicit design revision, not silent scope reduction.

Outstanding preview gates include broader capture cases, full transform/scroll alignment, two simultaneous live targets, lifecycle races/concurrent resource reservations, clean-profile startup and steady-state device/browser budgets, accessibility/dynamic reduced motion and three intended developers' value feedback. The passed fixture-specific capture/SDF checks and warm measurements do not close these broader gates. `@typegpu/sdf` retains a 16-byte uniform per preparation until root destruction; account for and resolve/bound this before accepting a long-lived refresh service.
