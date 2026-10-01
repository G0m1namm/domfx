# domfx website

A separately built, static Astro site. It consumes the built `@domfx/browser`
export and never imports the lab or library sources. Astro renders the content,
links, code samples and original SVG artwork at build time; a small browser script
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

## Draft contract

This is the local implementation draft for [#38](https://github.com/G0m1namm/domfx/issues/38).
The approved shared showcase plan refines that draft; [DESIGN.md](../../DESIGN.md)
defines its graphite/silver shell and attached toolbar panels. Publication and
performance claims remain separate gates; this change does not authorize deployment.

The header has native Examples/Quickstart and View source links. The hero offers
Try the live elements and Read the quickstart, with quiet unpublished status and
native text-selection instructions. A cropped ring arrangement leads into a pinned PNG → SVG → live text story, then the approved GSAP integration panels and setup handoff. The title description highlights
`@domfx/gsap`; a timeline schematic and binding sample sit beside creation settings,
followed by timeline controls. “Bring your own edge.” provides the primary quickstart
link and native disclosures for complete GSAP and standalone examples. Lab/support
are secondary links. Full-length static gradient borders retain the material identity. `/examples` redirects to `/#examples`.

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
without installation. Fire explains the unpublished tarball workflow, core override,
browser lifecycle, ambient clock, motion and verification. Public documentation is pinned
to c2b12318f410375ddf995eeda944670d823319f2, which lacks flameHeight: agents must obtain
compatible local artifacts/source or report the blocker, never invent an install/API.
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
