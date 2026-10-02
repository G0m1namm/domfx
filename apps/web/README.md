# domfx website

A separately built, static Astro site. It consumes the built `@domfx/browser`
export and never imports the lab or library sources. Astro renders the content,
documentation pages, links, code samples and original SVG artwork at build time; a small browser script
loads the effect package only when motion and WebGPU permit it. No UI framework,
server adapter, remote font requests or analytics are required. Cabinet Grotesk,
General Sans and JetBrains Mono are self-hosted with their licenses in `public/fonts`.
The homepage is also the examples canvas; `DESIGN.md` defines the approved
annular scroll story and restrained metallic accents.

From the repository root:

```sh
pnpm web          # Build the library, then start Astro
pnpm build:web    # Build the library and apps/web/dist
pnpm preview:web  # Serve the existing static build locally
pnpm test:web     # Build and test development and production in Chromium
```

Install the test browser with `pnpm --filter @domfx/web exec playwright install chromium`.
The browser suite saves screenshots, its JSON report, and failure traces in
`.scratch/web/`. It requires a working WebGPU Chromium backend for the rendering
checks; fallback tests alone are not rendering evidence. It uses separate ports
4322 and 4323, with foreground Astro servers owned by Playwright.

`browser-tests/documentation.spec.ts` reads the exact rendered standalone/GSAP
disclosures, bundles them with public built package exports using Vite, and runs
them on the website origin in both projects. Only caller-provided target/host DOM
and test exports surround the unchanged code text. The suite checks real GPU pixel
changes, ambient time, GSAP forward/backward seeking, native button interaction,
unavailable/reduced-motion behavior, and pagehide cleanup before and after readiness.
The GSAP entrance fades the host so native content and Fire share opacity;
fading the target independently violates the current composition contract.
The Vite and GSAP adapter development dependencies belong to this verification.

To run just this acceptance check against the production site:

```sh
pnpm build:web
pnpm --filter @domfx/web exec playwright test browser-tests/documentation.spec.ts --project=production
```

Link checks crawl the homepage and documentation pages, resolve native routes
and fragments, and assert the repository destinations for source evidence, lab and license. External availability
requires a separate live GitHub check; the deterministic suite makes no network
availability claim. Private repository destinations require authenticated access.

## Draft contract

This is the local implementation draft for [#38](https://github.com/G0m1namm/domfx/issues/38).
The approved shared showcase plan refines that draft; [DESIGN.md](../../DESIGN.md)
defines its graphite/silver shell and attached toolbar panels. Publication and
performance claims remain separate gates; this change does not authorize deployment.

The header has native Examples/Docs and View source links. The hero offers
Try the live elements and Read the quickstart, with quiet unpublished status and
native text-selection instructions. A cropped ring arrangement leads into a pinned PNG → SVG → live text story, then the approved GSAP integration panels and setup handoff. The title description highlights
`@domfx/gsap`; a timeline schematic and binding sample sit beside creation settings,
followed by timeline controls. “Bring your own edge.” provides the primary quickstart
link and native disclosures for complete GSAP and standalone examples. Lab/support
are secondary links. Quickstart and support navigation open the native documentation
pages, which remain readable without JavaScript or GitHub authentication. Full-length static gradient borders retain the material identity. `/examples` redirects to `/#examples`.

## User documentation

`/docs` redirects to `/docs/introduction`. Seven static pages cover introduction,
local installation, standalone and GSAP usage, API essentials, the versioned browser
support record and troubleshooting. Markdown and Astro share one reading layout,
with grouped sticky navigation on desktop, a native collapsible menu on mobile,
current-page semantics, breadcrumbs and previous/next links. The approved reference
structure uses the existing design tokens and self-hosted fonts. No effect package
or homepage animation script loads on these reading pages.

The guides derive their contracts from `QUICKSTART.md` and
`engineering/browser-support.md`; changes to those contracts must update the site
summaries too. `src/content/examples.ts` supplies the same complete standalone/GSAP
source to the homepage and guide pages. The disclosure execution suite runs both
rendered locations against public packages. Keep unpublished status, artifact
compatibility and bounded support evidence explicit; do not replace local artifacts
with an invented registry command.

## Shared showcase and effect ownership

`src/scripts/site.ts` owns shared settings and eight independent public manual
attachments: five hero rings, the matching SVG, the live section heading, and the quickstart link. Defaults are Fire, 70% maximum intensity, 32px flame
height, seed 314, and time 1.5 seconds. Only visible targets attach, with one manual
animation clock. Pause freezes time; seeking pauses and sets all visible attachments.
None disposes every attachment. Selecting Fire preserves playback/motion choices.

The fixed toolbar has Fire/None, Motion, Pause/Resume and Prompt. One outer frame
contains plain 44px buttons; no persistent playback/target count or nested outlines.
Conditional notices appear above the dock. Effect and Motion
pair sliders with numeric fields and units. One nonmodal panel attaches above the
collapsed bar; categories toggle or replace it. Escape restores trigger focus; outside
clicks dismiss without stealing focus. Panels scroll internally, fit safe areas, and
overlay without moving content. Only the collapsed bar reserves page clearance.
Match theme and visitor target selection are removed. Toolbar instructions stay hidden
until initialization, and the page remains complete without JavaScript.

The quickstart link uses the selected intensity as its maximum. In CSS viewport pixels,
`factor = clamp(1 - abs(cardCenter - H/2) / ((H + cardHeight)/2), 0, 1)`.
Intensity is maximum times factor: zero fully offscreen, maximum centered, symmetric
on entry/exit. Scroll/resize updates coalesce into animation frames and write the
public intensity property without recapturing. Scrolling works while paused.

Local and system reduced motion hide output and stop UI transitions.
`src/scripts/scroll-story.ts` owns one GSAP context/ScrollTrigger, not effect time.
It pins the scene for 5.4 viewport heights, preserving the original opening distance.
Headings reveal by line; expanded paragraphs follow, hold for reading, and exit upward
while the artwork stays centered. The final text leaves with ordinary document scroll.
The timeline uses 0.25s scrub catch-up; stage anchors finish that catch-up immediately
and land in the reading intervals. Reduced motion, viewports under 800px tall
(680px on desktops at least 1100px wide), and no JavaScript expose the
full document in reading order. Cleanup reverts only this page’s context. The system
preference stays authoritative; ending reduction requires explicit Resume. Playback
and local motion preferences use session storage with an in-memory fallback. Fonts
and relevant image decoding precede capture. Per-target revision guards and cleanup
prevent late imports/captures from reviving obsolete layers. Offscreen, hidden-page,
navigation and hot-reload cleanup release resources; returning restores settings.
A target failure leaves its original content usable and successful previews running.

Prompt snapshots settings/time on opening and explicit edits, never on autoplay frames.
It accepts a project element description/selector, copies exactly the visible draft and
handles denied clipboard writes with manual-copy instructions. None requests cleanup
without installation. Fire links to the site's installation/standalone guides, identifies
its unpublished status and requires matching artifacts/source with flameHeight support.
It preserves selected settings, lifecycle, clock, fallback and verification instructions.
After registry proof, update setup with exact verified release versions and public docs.
No GPU package loads until rendering is permitted; Prompt works without it.

`browser-tests/` covers grouped rendering, settings and time, paused scroll intensity,
native links/text selection, panels/focus, asynchronous replacement, partial failures,
visibility/navigation cleanup, reduced motion, storage fallback, and static layouts.
Rendering checks record actual Chromium/GPU output at DPR 1/2; responsive checks use
360/768/1440px widths. Grouped performance and native 200% zoom require explicit
manual evidence; individual preview checks alone do not establish those results.

## Approved illustration family

`src/assets/illustrations/` contains the original approved transparent PNGs: split shell,
layer relay and open junction. The sphere-free annulus is the live PNG target, repeated in the hero and footer. Supporting illustration originals remain available for future cards. Astro generates 960px ring PNG derivatives;
explicit dimensions and contained rendering preserve aspect ratio and layout space.
The SVG target uses genuine smooth paths traced from the annulus alpha, with the same 4:3 viewBox and focus bounds. Solid silver paint stays inside the current capture contract.
Ring and SVG artwork use 256px local surfaces scaled proportionally, retaining the
visual design while keeping simultaneous captures within DPR 1/2 budgets.

[artwork/README.md](artwork/README.md) preserves the shared material brief, exact
per-image generation prompts, provenance and source hashes. Use an approved original
as a visual reference for future variants; preserve originals when producing edits.
The material is thin smoky reflective sheet with silver highlights and restrained
colored glints, inspired by Vivid Motion's reference with original domfx shapes.

The footer repeats the cropped ring composition, then groups Explore and Resources beside the brand, with MIT/Back to top links
below and a 4px material gradient across the content width. Mobile stacks the brand
above the link groups; the existing dock clearance keeps bottom links reachable.
