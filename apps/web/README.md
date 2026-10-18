# domfx website

A static Astro marketing site and public examples canvas consuming built
`@domfx/browser` exports. It never imports library source or GPU fixtures.
Cabinet Grotesk, General Sans and JetBrains Mono are self-hosted with licenses.
No UI framework, remote font service or analytics is required.

The approved editorial homepage from #89 replaces the annular pinned story.
`DESIGN.md` records the layout, palette, responsive and motion contracts.

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

## Homepage composition

`HomeHero.astro` renders the 26/74 editorial opening: install command and statement
above three proportionate examples and a silver controls panel. Desktop/tablet
header plus hero occupy 100dvh. Phones and short windows use ordinary document flow.
Image, real inline SVG and selectable text share actual Fire controls. Example labels
sit above their panels, and native anchors address each original element.
`/examples` continues to redirect to `/#examples`.

The centered GSAP introduction uses original Prism folds preset 10 with a still-image
fallback. `prism-background.ts` owns one decorative WebGL surface, independently of
domfx, at up to one million pixels, DPR 1.5 and 30fps. Motion requires explicit
activation. Offscreen/hidden/reduced-motion states pause and context loss restores the
still. Optional rendering code loads on first visibility, and cleanup releases
programs, shaders, frames and observers.

`IntegrationFeatures.astro` renders three spacious alternating rows with graphite
copy panels and silver/violet/yellow illustration backgrounds. On mobile, text precedes
each visual. The last visual is a real, initially paused GSAP player. Its controls
include play/pause/reverse, keyboard-native seeking, speed, Repeat and Yoyo. Seeking
pauses. Reduced motion preserves frame exploration and disables continuous playback.
Offscreen/hidden pages pause without automatic resumption. The player demonstrates
GSAP timeline controls; it does not claim to be a new library effect.

Setup retains complete native GSAP and standalone disclosures from
`src/content/examples.ts`. An editorial footer provides native resource navigation,
MIT and Back to top. Fire is the first implemented effect. Homepage marketing uses
the selected published-package wording requested by the user; release metadata,
publication and deployment remain separate workflows.

## Shared effect ownership

`src/scripts/site.ts` retains one manual clock and four independent attachments:
image, SVG, text and installation action. PNG/SVG use bounded 256px local capture
surfaces with positive proportional scaling. Fonts and relevant image decoding finish
before attachment. Fire defaults to 70% intensity, 32px flame height, seed 314 and
0 seconds. Only visible targets attach. None and offscreen/hidden/teardown conditions
dispose owned resources. Pause retains time; selecting Fire retains playback choices.

The silver hero panel exposes Effect, Intensity and Pause/Resume directly. Quieter
Effect settings, Motion and Prompt controls sit underneath. Their nonmodal panels
open upward without moving content; Escape restores focus and outside clicks
dismiss without stealing focus. Controls preserve numeric/range synchronization,
repeat range, local and authoritative system reduced motion. Preferences survive
navigation with session storage and an in-memory fallback. Ending reduced motion
requires explicit Resume. Per-target revision guards prevent late async work from
reviving obsolete effects. One failed target leaves other targets and native content
usable. Prompt copies the displayed settings snapshot and supplies manual-copy
instructions when clipboard writes fail.

The installation action retains symmetric viewport intensity mapping:
`maximum × clamp(1 - abs(cardCenter - H/2) / ((H + cardHeight)/2), 0, 1)`.
Updates coalesce into animation frames and change public properties without recapture.

## Documentation and artwork

`/docs` redirects to `/docs/introduction`. Static guides cover installation,
standalone/GSAP use, API, support and troubleshooting. They retain grouped native
navigation, keyboard-scrollable code and source evidence, and do not load homepage
animation/GPU code. Public library contracts derive from `QUICKSTART.md` and the
versioned browser support record. `documentation.spec.ts` executes the exact rendered
standalone/GSAP examples against public built exports in development and production,
including GPU output, seeking, unavailable/reduced-motion behavior and cleanup.
Link checks crawl native routes, fragments and repository destinations.

Original approved PNGs remain in `src/assets/illustrations/`; the annulus is the image
example and its traced contour is genuine inline SVG. Astro generates a 768px image
derivative. [artwork/README.md](artwork/README.md) preserves prompts, provenance and
source hashes. Do not overwrite original artwork during future iteration.

Browser tests cover responsive/static content, keyboard controls, clipboard fallback,
lazy player loading, shared effect lifecycle and actual grouped Fire output at DPR 1/2.
Visual baselines are platform/backend-specific and require deliberate review after
layout changes. Website checks do not establish broad device or browser support.
