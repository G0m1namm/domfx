# domfx website

A static Astro marketing site and effect gallery consuming built `@domfx/browser`
exports. It never imports library source or GPU fixtures. Cabinet Grotesk, General
Sans and Lab Mono are self-hosted with licenses; documentation retains JetBrains
Mono. No UI framework, remote font service or analytics is required.

`DESIGN.md` records the approved Gallery/Setup composition, Immersive cards and
Afterglow closing section, including responsive and motion contracts.

## Development and verification

From the repository root:

```sh
pnpm web
pnpm build:web
pnpm preview:web
pnpm agent:verify
pnpm test:web
```

Install Chromium with `pnpm --filter @domfx/web exec playwright install chromium`.
The browser suite owns ports 4322/4323 and saves reports/screenshots/traces in
`.scratch/web/`. Actual effect checks require a WebGPU Chromium backend. Routine
smoke checks explicitly disable WebGPU and prove usability, not rendering.
See [browser verification](../../engineering/browser-verification.md).
The [gallery performance baseline](../../engineering/gallery-performance.md)
documents `pnpm measure:homepage`, current workloads and measurement limits.
The [editorial baseline](../../engineering/homepage-performance.md) is historical.

## Page composition

`src/layouts/Marketing.astro` renders both `/` and `/effects/`. The homepage shows
five selected effects followed by setup, GSAP, native HTML, FAQ and closing content.
The gallery shows every entry in `@domfx/site/effects`, with category filters.
Filtered cards share a uniform size. `/examples` redirects to `/effects/`.
Content and documentation links remain available without JavaScript. The Agents
command is explicitly a preview of an unpublished consumer skill.

`effect-card.astro`, `marketing-story.astro`, `marketing-closing.astro` and
`site-search.astro` own their markup. Phosphor icons use the official sprite paths
and include the upstream license. `marketing.css` implements the selected design;
prototype alternatives are local-only and absent from the production route graph.

## Effects and interaction ownership

`src/scripts/marketing.ts` owns the page's listeners, intersection observers,
attachments and one manual animation frame loop. Cards attach on visibility and
release their output offscreen or while a dialog is open. Fonts and relevant image
decoding finish before capture; revision/request guards discard obsolete work.

The header and closing Asterisk share one pattern sequence, time and intensity
ramp. The closing playback control pauses both; the header has no playback button.
Offscreen Asterisk output is disposed;
re-entry joins the current cycle. Hidden pages release attachments and recreate
visible output on return without advancing the shared cycle. Reduced motion
removes output and requires explicit Resume after the preference clears.

Global search includes every effect and documentation sections. Preview dialogs
preserve the selected card’s subject and offer Text, SVG and Image targets,
intensity, pause, attachment code, hover inspection,
keyboard zoom/pan and touch dragging. Zoom transforms the captured target and its
canvas together. Dialog-local clipboard status supplies a manual-copy fallback.
Missing WebGPU or failed capture leaves the original content usable. Page teardown
releases owned resources; back/forward cache restoration initializes a fresh owner.

The GitHub action reads the public repository star count with a static fallback.
On phones it moves from the compact header to the Humans hero panel, beside
“Find your effect.” The hero has 128px top padding on desktop and 112px from tablet
down, plus 16px before the collection’s own spacing.
The consumer skill preview is not a claim that the skill has been published.
Package publication and website deployment remain separate workflows.

## Documentation and artwork

[`apps/docs`](../docs) owns the Starlight documentation under `/docs/`;
`/docs` redirects to `/docs/introduction/`. `pnpm build:web` combines both apps in
`apps/web/dist`, and `pnpm web` serves both through the website's development origin.
Docs retain native navigation, keyboard-scrollable code and source evidence without
loading marketing animation code. `src/content/examples.ts` supplies complete public
API examples.

Run `pnpm test:docs` for the docs app's production browser suite, including rendered
standalone/GSAP examples, live effects, shared Pagefind search and native route,
fragment and repository-link checks. Website smoke checks keep docs routes readable
in development and production; the remaining website suite covers marketing behavior.

The selected marketing optical silver PNGs live in `src/assets/brand/`; gallery
cards use Washer, Split and Open ring, and the closing section uses Asterisk.
The docs Image preview uses [Pierced ring](../docs/src/assets/brand/pierced-ring.png).
[artwork/README.md](artwork/README.md) records prompts, provenance and source hashes.
Superseded visual files are removed; preserve active sources during future iteration.

Browser checks cover responsive/no-JavaScript content, keyboard search and zoom,
clipboard feedback, filter layout, font readiness, shared pattern timing, reduced
motion and effect cleanup at DPR 1/2. Visual baselines require deliberate review
after layout changes. Website checks do not establish broad device/browser support.
