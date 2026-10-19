---
# gstack: design-md-format=spec
version: alpha
name: domfx
description: A precise graphite interface with restrained metallic accents and expressive effects on real HTML.
colors:
  primary: "#C2C5DB"
  on-primary: "#191920"
  background: "#14151B"
  surface: "#1D1F27"
  raised: "#292A35"
  text: "#E8EAF3"
  text-muted: "#AEB1C1"
  border: "#454754"
  control-border: "#8E91A8"
  silver: "#C2C5DB"
  metal-highlight: "#E8EAF3"
  metal-shadow: "#9296AD"
  violet: "#6153B7"
  magenta: "#F047FE"
  accent: "#E6DC6A"
  success: "#9ED9AD"
  warning: "#F2CA82"
  error: "#FFA4A4"
typography:
  display:
    fontFamily: Cabinet Grotesk
    fontWeight: 500
    fontSize: 4.75rem
    lineHeight: 1.08
    letterSpacing: -0.035em
  body:
    fontFamily: General Sans
    fontWeight: 400
    fontSize: 1.0625rem
    lineHeight: 1.6
  label:
    fontFamily: General Sans
    fontWeight: 500
    fontSize: 0.875rem
    lineHeight: 1.45
    letterSpacing: 0em
  mono:
    fontFamily: JetBrains Mono
    fontSize: 0.875rem
    lineHeight: 1.55
    fontFeature: tnum
rounded:
  sm: 6px
  md: 8px
  lg: 10px
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  compact: 12px
  md: 16px
  lg: 24px
  xl: 32px
  2xl: 48px
  3xl: 64px
  4xl: 96px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.md}"
  button-primary-hover:
    backgroundColor: "{colors.metal-highlight}"
  input:
    borderColor: "{colors.control-border}"
    rounded: "{rounded.sm}"
  preview:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
  nav-link:
    textColor: "{colors.text-muted}"
---

# domfx design direction

## Overview

**Creative North Star:** A precise graphite interface whose real HTML comes alive,
with metal concentrated in controls, narrow lines and background accents.

**Product context:** domfx is an experimental GPU edge-effect library for frontend
developers. `apps/web` is its Astro marketing site and examples playground;
`tests/gpu` contains private regression fixtures; the website is the sole demo surface. This document defines the approved
visual target, not a claim that implementation or GPU verification is complete.

**Mode per surface:** Home persuades through a working demonstration and is also the examples canvas.
Example links navigate to authored elements on that page. Code and setup support reading. Private fixtures support inspection and diagnosis.

**Reference sites:** [Squark](https://squark.cloud/) is the primary composition
reference, approved by the user after reviewing home and examples mockups.
[ShaderGradient](https://shadergradient.co/customize) informs attached panels, clear control groups, and label/value/slider rows. [Magic UI](https://magicui.design/) informs clarity; [React Spring](https://www.react-spring.dev/)
informs the emphasis on interaction. Use original domfx content, assets and brand.
The 2026-10-03 editorial homepage supersedes these earlier composition references; its approved layout is specified under Home. The annular story remains historical context.

- A centered, moderate-weight headline leads into one large working demonstration.
- An open graphite hero, partially cropped silver rings and generous space establish structure.
- Silver controls and narrow colored accents give the dark shell a material identity.
- The interface is complete and understandable before effects start.
- No decorative eyebrows or announcement pills above headings.

## Colors

**Strategy:** Restrained neutrals with metallic accents. Dark graphite keeps the
warm Fire effect legible during inspection; silver is a material accent rather
than the page's dominant field. Avoid broad silver hero sheets and chrome lettering.

Use the front-matter tokens for the marketing shell. The private fixtures' diagnostic legends
and captured fixtures retain their existing colors unless separately verified.
Map tokens to the existing CSS variable names during implementation; no shared
component package is required by this document.

Silver occupies most of a metallic accent. Violet, magenta and pale yellow form
short transitions along thin edges. Use subtle, static grain or stippling beside
the main demonstration, away from copy and controls. Keep the contrast low enough
that the live effect remains the focal point. Do not imply that these CSS colors
are customizable Fire colors; the current effect has its own warm palette.

Main headings, paragraphs, labels and code use solid text. The approved exception is
`@domfx/gsap` in the post-example title description: use a static brand gradient
with a lightened violet stop so every part of the name stays readable. Buttons use dark text
on silver. Use a dark focus ring on silver and the accent focus ring on graphite.
Normal text must meet 4.5:1 contrast; large text and meaningful control boundaries
must meet 3:1. Check rendered hover/focus/disabled states and any metallic fill
variation. Decorative hairlines may be quieter; they must not identify controls
on their own. Status always includes text, not color alone.

## Typography

Cabinet Grotesk supplies the moderate-weight display voice; General Sans keeps
body copy and controls readable. JetBrains Mono is reserved for source code and
measurements. Section titles use the display family at 2–3rem, without oversized
heavy poster lettering. Keep prose near 60–68 characters per line.

The display font-size token records the desktop upper bound. Preserve its responsive
application as `clamp(2.5rem, 5.3vw, 4.75rem)` in CSS; the Google Labs token schema
accepts a single dimension, not a CSS math expression. This format migration does
not change the approved type scale or homepage composition.

Sources: [Cabinet Grotesk](https://www.fontshare.com/fonts/cabinet-grotesk),
[General Sans](https://www.fontshare.com/fonts/general-sans), and
[JetBrains Mono](https://www.jetbrains.com/lp/mono/). Self-host the needed WOFF2
weights and include their licenses. Preload the principal display font, use
`font-display: swap`, and wait for target fonts before capturing effect silhouettes.
System fallbacks preserve loading behavior; they are not the intended identity.
Generated mockups approximate these faces; they are not exact font specimens.

Lab fixture fonts remain fixture-specific. Do not restyle captured test content
through a global heading or button selector.

## Layout

Use one marketing header, type system and neutral palette on `/`. The legacy
`/examples` route redirects to the homepage examples. Keep a centered content width around 1200px with 24–40px desktop
and 16px mobile gutters. The framed shell may extend beyond the inner content.
Use the spacing scale for related controls and 64–96px between major sections.
The home hero is centered; supporting sections are left-aligned. Do not center every section.

Keep the hero free of rails and decorative junctions. Crop the ring arrangement at the viewport edges rather than shrinking all five illustrations onto narrow screens. Avoid dense
background grids and repeated boxes around every paragraph. At smaller widths,
wrap navigation and toolbars in reading order, stack preview/control panes, and
preserve meaningful labels. No page-wide horizontal overflow at 360px.

### Home

The approved 2026-10-03 editorial homepage supersedes the annular pinned story.
Keep the existing graphite palette, self-hosted fonts and original annulus artwork.

1. **Header and first viewport:** one 44px header and a hero that together occupy
   100dvh on desktop/tablet. Use ordinary document flow below 600px width or in
   windows shorter than 760px. Native Examples, Docs and View source remain available.
2. **Editorial hero:** a 26% install column and 74% statement column above a 74%
   examples panel and 26% silver controls panel. Preserve the approved display copy
   and text sizes. The install panel says “Use domfx on its own or with GSAP.” above
   a selectable `npm install @domfx/browser` command and clipboard button. Copy
   confirms success or provides manual-copy instructions.
3. **Three live examples:** image, genuine inline SVG and native selectable text
   appear together in descending large/medium/small proportions. Labels sit above
   the examples. All three use actual Fire output through the existing shared
   controller, with independent visible-target lifetimes. PNG/SVG capture surfaces
   remain 256px wide and scale positively and proportionally within their panels.
4. **Controls:** bottom-align the shared Effect, Intensity, Pause/Resume and settings
   controls in the silver panel. Stack the primary controls on desktop and wrap them
   on mobile. Use solid ink labels and a graphite playback button for contrast.
   The examples use the height previously occupied by the inline controls.
5. **Audience introduction:** centered “For creative developers.” with the portfolio,
   launch page and interactive story use cases, standalone/GSAP copy and an
   “Explore the docs” CTA. Keep MIT wording in the footer. Original Prism folds preset 10 is a
   decorative WebGL background, distinct from domfx effects. A still thumbnail is
   always available. Load below the fold, cap rendering to one million pixels,
   DPR 1.5 and 30fps; animation requires explicit opt-in, pauses offscreen/hidden,
   and respects system and local reduced motion. Context loss returns to the still.
6. **Integration features:** three generous alternating rows informed by
   save.design's features layout: text remains graphite, while the timeline diagram
   sits on silver, binding code on violet and interactive player on pale yellow.
   Desktop uses approximately 35% copy and 65% visual space. Mobile stacks copy
   before the visual. Keep gradient lines only where they clarify the cue/code.
7. **Player:** a real, initially paused GSAP sequence with Play, Pause, Reverse,
   seek, speed, Repeat and Yoyo. Scrubbing pauses. Offscreen/hidden pages pause;
   reduced motion disables continuous playback and preserves still-frame seeking.
   This is a GSAP controls demonstration, not another library effect.
8. **Setup and footer:** “Start with one element.”, installation/support links and
   complete native GSAP/standalone disclosures. The editorial footer has grouped
   navigation, a large static domfx signature, MIT and Back to top.

Homepage marketing describes the selected npm packages as available, as explicitly
requested by the user. Library release metadata and publication gates remain owned
by the release workflow. Fire is the first effect; do not invent additional available
library effects. The new homepage preserves the public attachment contracts and
normal scrolling; it does not pin or intercept scroll input.

### Documentation

The user approved in-site documentation on 2026-09-30, using ultrastorage.dev and
Fancy Components' introduction as layout references. Keep the graphite palette,
Cabinet Grotesk headings, General Sans reading text and JetBrains Mono code. Group
a sticky desktop sidebar into Getting started, Guides and Reference; pair it with
a clear reading column, quiet breadcrumbs, ruled section headings and readable
code. On mobile, use native collapsible navigation and internally scrollable code.
Documentation stays complete without JavaScript or GPU output. Introduction,
installation, standalone, GSAP, API, support and troubleshooting are local routes;
repository links remain secondary source evidence.

On 2026-10-19, the maintainer requested API presentation informed by Canvas UI and
shadcn/ui documentation. Lead with usage, then use consistent semantic tables for
creation options, writable controls, read-only state, methods and GSAP options.
Keep property explanations beside their types and defaults, mark required values,
and provide native section links. Retain the existing fonts and graphite tokens;
wide tables scroll inside keyboard-focusable regions on mobile. Fire remains the
single interactive documentation example, with all effects covered by the shared
API reference.

### Examples and toolbar

The editorial homepage places the shared controls in its silver side panel:
a labeled native Effect selector, a visible Intensity slider and percentage,
and a graphite Pause/Resume button with its text retained on mobile.
A narrow brand gradient marks only the top edge. Quieter Effect settings, Motion
and Prompt controls sit underneath; their panels open above the bar, right-aligned
and bounded to 560px and the viewport gutters. This supersedes the inline and historical floating toolbar geometry
below while preserving its settings, lifecycle and accessibility behavior.

Native anchors address showcase elements. `/examples` still redirects to `/#examples`.
Only implemented effects appear; Fire is currently the sole effect. The shared
settings default to Fire, maximum intensity 70%, flame height 32px, seed 314, 1× speed, continuous motion and
an initial time of 0 seconds. Selecting Fire preserves Pause and reduced-motion preferences.

The fixed toolbar closely follows ShaderGradient's customize toolbar structure, adapted to
our graphite/silver palette and General Sans. A single 560px-wide shell (bounded by viewport
gutters) retains the same width when opened or closed. The bottom row has plain 18px text tabs:
Effect (accessible name includes the selection), Motion and Prompt. The active tab uses brighter, medium-weight
text rather than a filled tile. The effect choices wrap into additional rows as needed. A separate Pause/Resume
button sits at the right edge with an icon and visible label at viewport widths of 440px or more;
narrower screens use a 44px icon button with an accessible name and tooltip. The toolbar's 16px outer corners are an approved reference-specific
exception to the default 10px surface radius. The panel uses surface graphite, and the tab row uses raised graphite.

One nonmodal panel attaches directly above the tab row. Selecting another tab replaces it;
selecting the active tab closes it. Escape closes and restores trigger focus; outside clicks
close without stealing focus. Opening focuses the first control. Closing panels immediately
become inert. Repeated panel headings, visible close buttons and helper paragraphs are omitted;
region names, native controls, descriptions and focus states remain accessible.

Effect and Motion use aligned 44px rows: a 160px desktop label column (96px on mobile),
a numeric value and a thin slider, or an On/Off segmented switch. Effect has None/Fire,
maximum intensity (0–100%, 5% increments) and flame height (8–64px). Motion has speed
(0.1–2×), an optional repeat range, a paired start/end time slider with numeric fields,
and page reduced motion. Range controls remain visible and disabled when repeat is off,
like the reference. Start/end use 0.05-second increments with end strictly greater than start.
The preview and copied prompt share these authored settings; running Fire never rewrites the
prompt. Range changes restart at the selected start without changing playback state.
System reduced motion remains authoritative and is described accessibly, with a visible notice when active.

Prompt has an editable element target, settings summary, a 144px internally scrollable prompt
at 14px, Copy prompt and quickstart. Copy confirms only after success and offers manual selection
on failure. None requests removal without installation. Fire concisely links to installation
and standalone docs and uses the approved npm installation wording while preserving all
selected settings. Prompt never loads the GPU package.

Reserve clearance for the approximately 54px collapsed toolbar and safe area. Expanded panels
overlay without moving page content and scroll internally on short viewports. Panels enter with
a 320ms expo-like ease-out and exit in 160ms; reduced motion suppresses both transitions.
At narrow widths and zoom, wrapping and measured clearance take priority over a fixed height.

Visible attachments use one manual clock. Offscreen or hidden-page targets dispose
independently and return at retained settings. One failed target leaves the others
working and its original content usable. Async work must not revive replaced layers.
Session navigation/reloads preserve playback and the local motion preference, with
an in-memory fallback. Local or system reduced motion suppresses effect output and
introduced CSS transitions. The system preference is authoritative; ending reduction
requires explicit Resume. Load GPU code only when rendering is permitted and await
fonts and relevant decoded images before attaching.

## Elevation & Depth

Use flat graphite surfaces with thin borders. A faint button bevel or short offset
shadow can describe a metallic control. Avoid ambient glow, radial hero spotlights,
frosted panels and floating stacks of screenshot cards. Static texture is decorative
and must never intercept input or reduce legibility.

## Shapes

Controls are compact, with a small radius. A pill-shaped header action is an
intentional exception; do not apply the same pill shape to every control. The
preview has slightly softer corners. Do not clip an effect host's output through
rounded overflow; the decorative frame must respect the capture contract.

### Approved illustration family

Use the original split shell, layer relay and open junction PNGs in
`apps/web/src/assets/illustrations/`. Their material is thin smoothly bent sheet with
smoky dark optical depth, soft silver reflections and precise bright edges, informed
by [Vivid Motion's 3D Illustration System](https://dribbble.com/shots/27532349-3D-Illustration-System).
Cool blue-grey reflections and small violet/magenta/pale-yellow glints belong to the
approved artwork, not new UI color tokens. Avoid thick bright chrome, matte origami,
forced rainbow bands and glowing card surfaces. Preserve the original files and the
[exact prompts and reusable brief](apps/web/artwork/README.md) for future variants.

The approved sphere-free annulus is the hero and PNG effect target; its traced SVG preserves the same outer contour and opening. Split shell is retained as supporting artwork; the family also supplies static
resource-card art. Keep the SVG example as genuine inline vector geometry. Artwork
stays static. The quickstart link also serves as the existing scroll-intensity target; other supporting cards remain undecorated. Test image
alpha and actual Fire output after changing an effect target.

The footer has a brand block, Explore and Resources link groups, and a quieter MIT /
Back to top row. A 4px static silver–violet–magenta–pale-yellow gradient spans the inner
content width at its upper edge. Text and focus indicators remain solid. On mobile,
stack the brand above the two link groups and retain 44px links plus dock clearance.

## Components

- **Buttons:** solid silver primary fill, brighter hover, visible keyboard focus,
  a subtle pressed state, and clear disabled text. Keep the label and geometry stable.
- **Navigation:** consistent destinations and labels on both routes; underline or
  another non-color cue marks the current page. Required links remain usable if GPU
  effects are unavailable. Header links use CSS hover/focus states without Fire attachments.
- **Selectors and sliders:** associated labels and readable values; selected state
  uses fill or underline plus semantic state. Focus treatment must remain distinct.
- **Preview and cards:** original text remains selectable and real controls retain
  pointer and keyboard behavior. A framed fictional UI can contain real cards; do
  not add extra decorative wrappers around them.
- **Status:** preparing, active, paused and unavailable outcomes use plain language.
  Do not announce every frame. Unavailable output leaves a complete static page.
- **Code:** readable source, keyboard-scrollable where needed, real supported API
  calls and explicit cleanup. Source and setup links remain visible.

## Do's and Don'ts

- Do make the real live element the principal visual evidence.
- Do concentrate material color at narrow edges and background accents.
- Do use original assets, honest copy and consistent page chrome.
- Do preserve normal document scroll and persistent pause/off choices.
- Don't introduce eyebrows, fake social proof, unsupported effects or API claims.
- Don't turn every heading into chrome or every section into a large silver plate.
- Don't use page-wide purple washes, halos, animated noise or decorative motion.
- Don't replace the actual library demo with a video or generated screenshot.

## Motion

**Approach:** Expressive Fire on bounded targets; functional motion elsewhere.
**The authored showcase:** Visible authored targets share Fire time and settings,
and retain native selection and activation with a nearby pause control.
Use ease-out for entry, ease-in for exit and ease-in-out for movement. Hover/focus
transitions are roughly 120–180ms; disclosures 200–300ms. Preserve reduced-motion
behavior and avoid scroll hijacking or animating target paint every frame.

## Lab site

Use the same neutral shell with a smaller title and denser spacing. The visual
hierarchy should make “what is running, what can I change, what happened” obvious.

- **Header and run summary:** lab title, current run state and links to fixture pages.
  Keep Play, Seek, Reverse, Dispose all effects and Save experiment evidence easy to find.
- **Live gallery:** retain all five required target classes. Place each target's
  controls beside or immediately below its preview. Label the SVG/raster shared
  scrolling host and keep both targets inside it.
- **Per-target controls:** show time, intensity, playback and lifecycle state together.
  Put Refresh, Move/scale, Change content where applicable, and Dispose in a secondary
  action row. Label disposal precisely so it cannot be confused with pause.
- **Capture diagnostics:** group source capture, coverage mask, signed distance field
  and rendered fire in a consistently labeled strip or grid. Keep initial diagnostic
  snapshots distinguishable from current live output and its saved image.
- **Results:** put a readable check summary before the raw report. Raw JSON can use a
  disclosure, but failed checks and their reasons remain visible. Keep capture extent
  fixtures and their numerical gates available.

Show Preparing, Active, Paused, Refreshing, Stale, Unavailable, Disposed and run
PASS/FAIL as appropriate, with text as well as color. Playback, lifecycle and raster
health are separate concepts; a paused effect can still have a fresh raster.
Unavailable GPU output must never appear as a passing render check.

Style the lab shell separately from captured fixture content. Broad heading, button,
image or canvas selectors can change masks, dimensions and saved evidence. Preserve
fixture IDs, host relationships and required checks; validate deliberate fixture
changes through the browser suite. Keep the all-five gallery visible for verification
even if marketing shows one example at a time.

## Using domfx in its own UI

| Element or interaction       | Intended treatment                                        | Current boundary                                                                                         |
| ---------------------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Short hero title             | Autoplay while visible, with visitor-controlled pause     | Public `attachFire`; retain the real heading and readable letter interiors                               |
| SVG or transparent image     | Edge effect reveals holes and silhouette                  | Use bounded, decoded assets and a supported host; keep image alternatives                                |
| Ordinary rectangular photo   | Edge effect around the photo's outer shape                | An opaque photo produces a rectangle; isolating the pictured subject requires an asset with transparency |
| Example button or card       | Demonstrate that the original control remains usable      | Effect layer stays decorative and pointer-transparent; required navigation stays plain                   |
| Scrolling target             | Effect follows its source while time stays fixed or plays | Supported placement tracking handles bounded rectangular scrolling hosts                                 |
| Scroll-driven intensity/time | Scrub one manual effect through a short section           | Homepage maps card position to public intensity; this is app-owned, not a built-in scroll API            |

### Motion and ownership

- Marketing uses four authored targets with one shared clock and Pause/Resume.
  Attach only visible targets; respect pause and off choices on return. Verify grouped
  rendering on the actual GPU; individual-preview evidence does not establish its cost.
- Keep CSS responsible for ordinary UI transitions: roughly 120–180ms for hover/focus
  and 200–300ms for small disclosures. Do not attach GPU effects to every hover state.
- Animate effect time/intensity through public controls. A manual attachment can use
  the optional GSAP binding and a caller-owned timeline. Keep one owner for those
  controls; direct input and scroll playback must not compete.
- Preserve native scrolling. For the scrolling card, map viewport position to public intensity;
  scrolling backward must reproduce the earlier intensity. Provide an equivalent seek control for keyboard and touch users.
  The approved homepage uses ordinary scrolling and native example anchors; never intercept wheel/touch scrolling.
- Leave source content visible before initialization and after failure. Use the
  library's default reduced-motion policy; ordinary CSS motion must respect it too.
  Static decoration is an explicit `motion: 'static'` choice, not an animated override.
  A reduced-motion-suspended attachment needs disposal and explicit reattachment to
  recover; `resume()` does not restart it.
- Keep marketing targets small and defer inactive examples. Pause offscreen ambient
  playback; dispose examples when replaced or removed to release their resources.
  Pause retains an attachment and is not a resource-release mechanism.
- The app owns its attachments, animation bindings and timelines. Clean them up on
  navigation, replacement and teardown, including work that finishes after removal.

### Capture and composition

Keep effect hosts positioned and large enough for the bounded target and its effect.
Use supported translation and positive axis-aligned scale. Rotation, skew, perspective,
negative scale and arbitrary clipping are outside the current contract. Avoid rounded
overflow or masking ancestors that bypass the effect host. Do not put an effect on a
fixed or sticky navigation treatment without separate support verification.

Use decoded, same-origin assets where possible. A changing video is not a supported
live target, and a canvas requires an explicit refresh for each desired snapshot.
Avoid animating the target's paint every frame: animate effect controls or supported
placement instead. Theme changes and unobserved hover/focus paint changes require
explicit refresh. The metallic face and colored rim can start as CSS or artwork;
the current fire API does not expose this palette. Animated Vyse-inspired contours,
custom fire colors, glow, distortion or particles need separate library work and
verification. Keep those prospective effects distinct from working demonstrations.

Implementation contracts live in the [browser package](packages/domfx/README.md),
[GSAP adapter](packages/gsap/README.md) and [domain glossary](GLOSSARY.md).

## Acceptance for a UI implementation

- The static page is complete with JavaScript or WebGPU unavailable.
- Keyboard users can navigate, operate controls and see focus. Controls have roughly
  44px target areas. Disabled and unavailable states remain understandable.
- Home effects autoplay only while visible and respect explicit Pause/Off choices,
  including scrolling away/back and navigation restoration. Reduced motion must not
  silently restart when the preference changes back.
- Homepage examples use one effect controller and independent attachment lifetimes; a separate GSAP context owns only the interactive timeline player.
  None/Fire, intensity, seek, flame height, Pause/Resume, local/system reduced motion,
  Prompt and cleanup work on real content. None and Pause persist through scrolling
  and navigation restoration; native anchors do not select targets.
- Verify 360, 768 and 1440px layouts, 200% browser zoom, and actual DPR 1/2 output.
  Content and controls must stay usable even when capture budgets force static fallback.
- Static metallic accents remain visually distinct from actual warm Fire output.
  No new palette controls or support/performance claims are implied by the mockups.
- Astro remains the website framework. Neither app imports the other. Keep fixture
  styles and all diagnostic checks intact; lab redesign is a separate task.
- Implementation passes `pnpm agent:verify` plus website tests and applicable manual
  checks. Record the tested environment and distinguish unavailable GPU from success.

## Decisions Log

On 2026-10-02, the user selected **editorial direction B** for
[homepage #89](https://github.com/G0m1namm/domfx/issues/89): a creative ruled layout
with image, SVG and text examples together in the hero, carried through the sections
below the fold. The approved production contract is recorded above; exploration
prototypes and screenshots remain local and are not repository deliverables.
The user authorized Astro implementation of this direction and the later feature refinements.
The selected integration background is **10 — Prism folds**. On 2026-10-03,
the user approved production integration of the editorial hero, the later alternating
save.design-inspired features, and the real GSAP player. These replace the earlier
State of AI Design slide proposal and the annular production story. Taste skills guide
implementation polish; explicit approved layout and brand choices take precedence.

| Date       | Decision                                                     | Rationale                                                                                                                                                                                               |
| ---------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-22 | Squark-inspired home and examples direction approved         | Centered moderate-weight hero, immediate live demo and fine frame; domfx metal moves to accents rather than large silver fields.                                                                        |
| 2026-09-22 | Preserve behavior and Astro                                  | The approved mockups refine visual presentation; they do not replace the existing library or interaction contracts.                                                                                     |
| 2026-09-28 | Homepage is the examples canvas                              | Real homepage elements replace the fictional preview; one floating dock owns selection, playback, settings and code.                                                                                    |
| 2026-09-29 | Shared curated showcase and attached toolbar panels approved | Four authored targets share settings; native navigation, scroll-driven card intensity, and motion preferences remain visitor-controlled.                                                                |
| 2026-09-29 | Annular scroll story approved                                | Cropped five-ring hero, proportional PNG → SVG → live text progression, unpinned information cards and a matching footer reprise.                                                                       |
| 2026-09-30 | Post-example integration layout A approved                   | GSAP sequencing, initial settings, timeline controls and “Bring your own edge.” replace repeated example benefits; full-length gradient borders and highlighted `@domfx/gsap` identify the integration. |
| 2026-09-30 | In-site user documentation approved                          | Grouped navigation and reading layout use ultrastorage and Fancy Components as references while retaining domfx typography, palette and verified contracts.                                             |

The 2026-09-29 text-motion refinement follows user-provided recordings of Hungry Tiger, Telkom-OT and Iertqa: anchored artwork, independently moving copy, staggered reveals and a visible handoff to ordinary document scroll. Reference easing names are inferred, not recovered from their implementations.

### Approved Frost direction

Frost uses a mostly white, pale-blue granular coating that spreads inward across
image, SVG and text contours as intensity rises. Higher intensity also increases
white smoke height and brightness. Smoke has fine irregular wisps, accompanied by
small diamond-shaped white ice grains. The original content remains visible and
interactive. The maintainer approved this direction on 2026-10-18; automated and
full lifecycle verification remain deferred until the visual exploration is complete.

### Approved Kinetic bloom direction

One silver-violet light pulse sweeps clockwise around the target and sheds small
geometric fragments. Intensity increases the pulse width, brightness, violet wake,
and fragment size and reach. Keep one Kinetic bloom option. The maintainer approved
this direction on 2026-10-18; tests and full lifecycle verification remain deferred.

### Slime exploration direction

On 2026-10-18, the maintainer redirected the Lava exploration to Slime: a solid
colored rim and gravity-driven droplets. On 2026-10-19, the maintainer replaced
the inward fade with a solid coating and defined inner and outer boundaries;
antialiasing is limited to contour coverage. Retain the slow stretching motion
and remove incandescent cracks and heat shading. The maintainer approved the
solid green coating and drip motion on 2026-10-19 as the checkpoint before
exploring gloss and translucency. Tests and full lifecycle verification remain deferred.

The glossy Slime pass was approved on 2026-10-19: rounded wet highlights and
thickness-based green translucency sit inside the defined coating boundaries.
Preserve the accepted buildup, pinch-off, falling drops and neck retraction.

### Approved Burned paper direction

The maintainer approved Burned paper on 2026-10-19: a dark charred rim, uneven
brown scorching and sparse orange-hot seams. Intensity spreads the coating
inward across the target; the outer material rim stays below one CSS pixel to
preserve spacing between letters. Keep the original content intact. Tests and
full lifecycle verification remain deferred until visual exploration is complete.

### Approved Dither direction

The maintainer approved the fine ordered-dot effect on 2026-10-19. Small fixed-grid
silver-violet dots form an edge coating and rising wisps; intensity increases dot
density, inward coverage and reach. Keep it free of letters and symbols, with the
original content intact. Larger halftone variants are not part of this approved
pass. Tests and full lifecycle verification remain deferred.

### Approved pattern effects

The maintainer approved Halftone, Stipple, Scanlines, Crosshatch, Diamond lattice
and Contour echoes on 2026-10-19. Preserve their distinct silver-violet marks and
shared silhouette-following intensity controls alongside the original Dither.
This approves their visual direction; automated and full lifecycle verification
remain deferred until the effect exploration is complete.

### Marketing gallery exploration

On 2026-10-19, the maintainer selected Gallery as the marketing prototype direction,
with Spotlight's alternating two-wide and three-across card arrangement. Keep card
metadata focused on effect names and categories; remove the promotional taglines.
Phosphor icons, cleaner control primitives and Lab Mono are being evaluated locally.
The next local refinement uses a fixed full-width header with the same subtle 1px
border as cards and inputs, downward effect output below the divider, and more
space above the hero title and between the hero and collection filters. Remove
decorative card eyebrows, artificial numbering and redundant promotional copy.
The header rotation uses the Patterns collection except Star shimmer; lower
intensity to zero before switching effects, then ease intensity back up. Keep
this effect visible throughout scrolling, with a slightly longer downward reach.
Cards retain plain resting surfaces and gain subtle gray illumination on hover
or keyboard focus.
The next exploration keeps this header, hero and gallery shared across all variants.
Only the supporting content changes: setup-led, GSAP-led and compact benefit-led
approaches, with original domfx copy informed by Canvas UI’s adoption guidance.
The maintainer selected Setup (variant A) for the supporting content, with variant B’s
GSAP section: the timeline illustration, binding example and playback-method overview.
Keep the setup walkthrough first, followed by this GSAP section, the native HTML
example and FAQ. Name GSAP in the section heading and apply Fire only to the
word “GSAP”, keeping the surrounding heading text plain.
Use the selected Setup composition as the sole active prototype; retire the variation
switcher. Write marketing copy for the public npm launch: installation is available,
GSAP is optional, and the page must not describe packages as unpublished or direct
visitors to a local-only preview workflow. Browser and capture limits still apply.
This composition is approved for the production homepage and full effects gallery.

The maintainer selected Afterglow for the closing section. Keep its existing background
glow and animated domfx wordmark, placed above the closing headline and installation
actions. Follow with grouped footer links and a compact credit/copyright strip naming
Jherson Martelo Medina, plus Back to top. Use official Phosphor assets for interface
icons, with consistent sizing and accessible labels. Text links need visible resting
underlines, brighter text, and clear hover and keyboard-focus states.

Afterglow is fixed during the card-design exploration. On mobile, align Build and
Explore as equal columns; GitHub and npm share a separate row on those column
starts. Align copyright and Back to top on one row, with the creator credit below.
Card alternatives change only card composition; retain the approved desktop
two/three-column rhythm, shared filters, live effects and preview dialog.

The maintainer selected Immersive (B) as the final card composition. Keep the
alternating large/small composition for the complete gallery; category-filtered
results use equal-size tiles at each breakpoint, including a consistent scale for
matching preview types. Retire the card comparison toolbar.

The next refinement reduces hero height with a two-column desktop composition:
headline and supporting copy on the left, Humans/Agents setup tabs on the right.
Stack these on mobile. Humans offers the package install command and gallery link.
Agents previews `pnpm dlx skills add G0m1namm/domfx --skill domfx`, explicitly labeled
as a preview because the consumer skill is not published yet, alongside the API guide.
Publishing that skill remains separate work.

Move search from the gallery into the fixed header as an icon-only magnifying-glass
button with a 44px target, accessible label, shortcut tooltip and Cmd/Ctrl+K support.
Search effects and documentation in separately labeled groups within one
keyboard-accessible dialog; effect results open their live preview and documentation
results navigate to the matching page or section. Keep category filters above the
full effects gallery. The header GitHub CTA says “Star on GitHub” below 50 stars
and “Stars” with a count from 50 onward. Fetch public repository statistics and
retain the plain GitHub link if counts are unavailable; do not invent a count or
expose credentials for a private repository.

The next local preview refinement gives the effect subject a larger default size
and a wider inspection pane. Magnify the original subject and its live decorative
layer together, independently of intensity. Desktop hover temporarily inspects at
2× with pointer-directed panning; explicit controls provide 100–300% zoom and Fit
reset for keyboard and touch users. Arrow keys pan the focused preview; touch can
drag while zoomed. Keep the controls outside the magnified surface, reset on close,
and suppress automatic hover zoom and zoom transitions under reduced motion.

The marketing homepage shows only the first five effects: Electricity, Frost, Fire,
Dither and Slime, preserving the two-wide/three-across composition. Remove category
filters from this selection and place an “Explore all 21 effects” CTA underneath,
with the total derived from the catalog. A separate effects page owns the complete
gallery and its category filters, with uniform filtered tiles. Header and footer
Effects links lead there. Both pages share search and the zoomable effect preview;
homepage search can open every effect, including those beyond the five featured cards.
Keep setup, GSAP, native HTML and FAQ content on the marketing homepage.

The header and large Afterglow domfx wordmark use the same pattern sequence and
one shared time and intensity cycle, including fade-out, effect switch and fade-in.
The wordmark joins the current phase when it enters view; release its attachment
when offscreen without restarting the header. Either playback control pauses or
resumes both decorations. Respect reduced motion and retain the paused state when
that preference changes back.

On 2026-10-19, the maintainer approved integrating the selected marketing design
into the official website. `/` contains the five featured effects and Setup story;
`/effects/` contains the complete filtered gallery. Both use Immersive cards,
Afterglow, Lab Mono labels, Phosphor icons, shared search and zoomable previews.
Render content on the server so the site remains readable without JavaScript.
Keep prototype sources and rejected variants outside the production build.
