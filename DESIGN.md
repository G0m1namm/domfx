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
The Gallery/Setup and optical silver sections below define the current marketing
site. Earlier dated layouts remain historical context and do not override them.

**Mode per surface:** Home introduces the library through five live effect cards
and setup guidance; `/effects/` is the complete gallery. Documentation supports
reading and interactive API exploration. Private fixtures support diagnosis.

**References:** The approved Gallery/Setup composition below follows the
maintainer's Aceternity, Pencil and Canvas UI references, with original domfx copy,
assets and behavior. Earlier editorial and annular explorations are superseded.

- An open graphite hero and generous spacing establish structure.
- Silver controls and narrow colored accents support expressive live effects.
- The interface remains understandable before effects start.
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
that the live effect remains the focal point. The picker may expose one main decorative
color for every effect except Burned paper; an unset picker preserves each effect's
original colors, including Fire's warm colors.
Use a compact square swatch beside the color value and an icon-only reset with an
accessible label. Keep both targets at least 44 CSS pixels; the swatch must not
stretch across the settings panel. Marketing previews and docs share this control.

Main headings, paragraphs, labels and code use solid text. The approved exception is
`@domfx/gsap` in the post-example title description: use a static brand gradient
with a lightened violet stop so every part of the name stays readable. Buttons use dark text
on silver. Use a dark focus ring on silver and the accent focus ring on graphite.
Normal text must meet 4.5:1 contrast; large text and meaningful control boundaries
must meet 3:1. Check rendered hover/focus/disabled states and any metallic fill
variation. Decorative hairlines may be quieter; they must not identify controls
on their own. Status always includes text, not color alone.

## Typography

For CSS units and responsive verification, follow the [UI conventions](engineering/ui-conventions.md).
Pixel dimensions in this document describe the approved default-scale appearance;
they do not require pixel units in CSS. Preserve that appearance when choosing relative units.

Cabinet Grotesk supplies the moderate-weight display voice; General Sans keeps
body copy and controls readable. JetBrains Mono is reserved for source code and
measurements. Section titles use the display family at 2–3rem, without oversized
heavy poster lettering. Keep prose near 60–68 characters per line.

The display font-size token records the desktop upper bound. Current CSS applies it
as `clamp(2.5rem, 5.3vw, 4.75rem)`; the Google Labs token schema
accepts a single dimension, not a CSS math expression. This format migration does
not change the approved type scale or homepage composition.
The current expression is an existing implementation, not a template for new fluid
text; future changes must pass the conventions' text-resizing checks.

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

Use one fixed site header, type system and neutral palette across marketing and
documentation. `/examples` redirects to `/effects/`. Keep responsive gutters,
centered content and ordinary document scrolling. Stack preview/control panes and
preserve meaningful labels on narrow screens; no page-wide horizontal overflow
at 320px.

### Home

The approved [Gallery/Setup composition](#marketing-gallery-exploration) and
[optical silver brand direction](#approved-optical-silver-brand-direction) define
the current homepage and complete gallery. They replace the editorial first
viewport, three-example Fire showcase, floating toolbar and annular scroll story.
The hero uses a left-aligned headline and Humans/Agents setup panel, followed by
five effect cards, setup, GSAP, native HTML, FAQ and Afterglow. Effect controls live
in preview dialogs and documentation, rather than a shared homepage toolbar.

Marketing uses the approved public-launch copy. Release metadata, package
publication and deployment remain separate workflows. Only implemented catalog
effects appear; native scrolling is never pinned or intercepted.

### Documentation

The user approved in-site documentation on 2026-09-30, using ultrastorage.dev and
Fancy Components' introduction as layout references. Keep the graphite palette,
Cabinet Grotesk headings, General Sans reading text and JetBrains Mono code. Group
a sticky desktop sidebar into Getting started, Guides, Effects, Reference and Help; pair it with
a clear reading column, quiet breadcrumbs, ruled section headings and readable
code. On mobile, use native collapsible navigation and internally scrollable code.
Documentation stays complete without JavaScript or GPU output. Introduction,
installation, standalone, GSAP, API, support and troubleshooting are local routes;
repository links remain secondary source evidence.

The documentation header uses Starlight's Pagefind search, styled as the same
icon-only 44px button with an accessible label, shortcut tooltip and Cmd/Ctrl+K.
The marketing dialog keeps grouped effect and docs results, using the same
Pagefind docs index, including generated effect references. Without JavaScript,
the docs sidebar remains the index.

On 2026-10-20, the maintainer approved the Starlight migration after a desktop/mobile
comparison and a revision to preserve the previous look. Retain the centered
1320px shell, 240px sidebar, reading column, quiet breadcrumbs, ruled headings,
17px reading text, right-aligned header actions and full-width footer. Starlight
supplies the sidebar disclosures, table of contents and previous/next navigation;
restyle these with the existing fonts and graphite tokens.

On 2026-10-19, the maintainer requested API presentation informed by Canvas UI and
shadcn/ui documentation. Lead with usage, then use consistent semantic tables for
creation options, writable controls, read-only state, methods and GSAP options.
Keep property explanations beside their types and defaults, mark required values,
and provide native section links. Retain the existing fonts and graphite tokens;
wide tables scroll inside keyboard-focusable regions on mobile. All effects are
covered by the shared API reference.

The effect references have individual addressable pages under a native collapsible
Effects navigation group. Reuse the canonical options and controls tables on each
page; keep effect-specific settings separate. Link references from gallery previews
and include them in documentation search. Preserve the existing API section anchors
as links to the expanded references.

Later on 2026-10-19, the maintainer requested a stronger documentation architecture
and a live preview on every effect reference. The sidebar follows the reading path:
Getting started, Guides, Effects, Reference and Help (Upgrading, Browser support,
Troubleshooting). Effects starts with an All effects overview grouped by category;
the sidebar groups the 21 references into native Energy, Material and Pattern
disclosures, opening only the current category. Pagination follows the same order.

Each effect reference opens with one live preview directly below its description,
followed by a facts strip (category, function, options type, package), section links,
the reference tables and same-category links. The Standalone guide uses the same
preview for Fire. The preview follows the toolbar control language: aligned rows
with a label column, a Text/SVG/Image segmented subject switch, thin silver sliders
with numeric readouts, Fire's flame height marked as a creation option, a text status
indicator and a 44px Pause/Resume icon button with an accessible name. A live settings
snippet mirrors the controls and offers Copy with a manual-selection fallback. Previews
attach only while visible, release on pagehide, respect reduced motion, never clip
the host's output and leave the original subject and disabled controls in place
without JavaScript or WebGPU. They are demonstrations, not verification evidence.

The GSAP guide includes a compact interactive sequence in English and Spanish,
using the same graphite preview and control styling. Keep the original clickable
target beside Play/Pause, Restart, Reverse and a labeled seconds slider. Show
timeline position, effect time and intensity separately, with two stages: the
container appears over 0.5 seconds, then effect time and intensity change together
over four seconds. Start paused; seeking pauses playback. Keep the executed
sequence and displayed source aligned, with readable code and explanations when
JavaScript or GPU output is unavailable. Respect reduced motion and release owned
animations and effects when the lesson leaves view or the page closes.

Documentation uses the same fixed site header component as the marketing pages
(wordmark, Effects and Docs links, search and the GitHub link) without the animated
pattern line. Content edges align with the header. The sticky
sidebar fits the viewport below the header, contains its own scrolling and opens
scrolled to the current page.

Navigation on smaller screens follows shadcn/ui, Payload, Sanity and GSAP: at phone
widths the shared header keeps search and a 44px Menu button for Home, Effects, Docs and Star on GitHub, so primary
navigation outranks the GitHub call to action. Below 1152px, docs add a sticky sub-bar
under the header with a Docs drawer below 800px and an On this page
dropdown. From 1152px, On this page is a sticky right rail. Its links are generated
from each page's h2/h3 headings on the server and mark the current section while
scrolling. Header menus and the Docs drawer use native popovers; On this page uses
a native disclosure. All remain usable without JavaScript. A 44px back-to-top link
appears after one viewport of scrolling and returns focus to the content.

Docs pages end the way the same references do: page actions, then Previous/Next, then
a site footer. The page actions are muted, underlined links to edit the page's source
on GitHub and to open an issue prefilled with the page title and path. They stand in
for a "Was this helpful?" widget, which would need a backend. The footer spans the
docs shell below the sidebar, content and rail. It uses the homepage's brand block,
Build/Explore/domfx groups (from one shared list) and a copyright, MIT and credit
strip. Docs leave out the Afterglow CTA, the animated closing artwork, the gradient edge and
the text Back to top link; the floating button already covers that. Footer links keep
44px targets. On phones, Build and Explore share a row and GitHub and npm share the
next one. The last row stays clear of the floating button.

### Effect previews

The gallery's preview dialog preserves the selected card's subject and offers
Text, SVG and Image targets, intensity and playback controls, attachment code and
zoom inspection. The full interaction and accessibility contract is recorded in
[Gallery/Setup](#marketing-gallery-exploration). The documentation preview follows
the labeled-row control language described above. Do not restore the retired
homepage toolbar or its None/Fire-only selector.

Load GPU code only when rendering is permitted; wait for fonts and relevant
images. Visible attachments have independent lifetimes. Offscreen and hidden-page
output is released, failures leave original content usable and obsolete async work
must not revive replaced layers. Reduced motion suppresses automatic output;
ending reduction requires explicit Resume on marketing pages.

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

The current family is defined by [Approved optical silver brand direction](#approved-optical-silver-brand-direction).
Active transparent PNGs and generation provenance are documented in
[the artwork guide](apps/web/artwork/README.md). The earlier annulus, split shell,
layer relay and open junction family is retired and removed; Git history preserves
its sources. Keep genuine inline SVG examples as vectors, letterforms flat and
artwork static. Test image alpha and live effect output after changing a target.

The current footer uses Afterglow, grouped links and a compact credit strip as
specified in the Gallery/Setup section below. Do not restore the former gradient
edge or prototype dock.

## Components

- **Buttons:** solid silver primary fill, brighter hover, visible keyboard focus,
  a subtle pressed state, and clear disabled text. Keep the label and geometry stable.
- **Navigation:** consistent destinations and labels on both routes; underline or
  another non-color cue marks the current page. Required links remain usable if GPU
  effects are unavailable. Header links use CSS hover/focus states without Fire attachments.
- **Selectors and sliders:** associated labels and readable values; selected state
  uses fill or underline plus semantic state. Focus treatment must remain distinct.
- **Selects:** use the shared native select component for settings: graphite fill,
  a padded Phosphor chevron, silver hover and yellow keyboard focus. Keep at least
  44px targets and native keyboard/mobile picker behavior. Disabled controls remain
  legible; forced-color mode restores the browser arrow.
- **Effect settings:** the maintainer selected compact layout A on 2026-10-24 for
  marketing dialogs and docs previews: aligned label, control and value columns,
  with settings visible together. Share slider track, thumb, focus and target-area
  styling across both surfaces. Stack rows on narrow screens. Choose each setting's
  control and value format according to what it represents; the layout does not
  require every setting to use a percentage slider.
  Keep API property labels literal in EN/ES. Geometric percentages show their
  element-relative basis; Slime density uses named levels backed by numeric values.
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

**Approach:** Expressive catalog effects on bounded targets; functional motion elsewhere.
The header and closing artwork share one cycle. Gallery and dialog targets retain
independent lifetimes, original content and accessible preview controls.
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
| Short hero title             | Autoplay while visible, with visitor-controlled pause     | Public effect functions; retain the real heading and readable letter interiors                           |
| SVG or transparent image     | Edge effect reveals holes and silhouette                  | Use bounded, decoded assets and a supported host; keep image alternatives                                |
| Ordinary rectangular photo   | Edge effect around the photo's outer shape                | An opaque photo produces a rectangle; isolating the pictured subject requires an asset with transparency |
| Example button or card       | Demonstrate that the original control remains usable      | Effect layer stays decorative and pointer-transparent; required navigation stays plain                   |
| Scrolling target             | Effect follows its source while time stays fixed or plays | Supported placement tracking handles bounded rectangular scrolling hosts                                 |
| Scroll-driven intensity/time | Scrub one manual effect through a short section           | App-owned public controls; not a built-in scroll API                                                     |

### Motion and ownership

- Marketing attaches only visible targets. The header and closing artwork share
  time and playback; cards and dialogs own independent attachments. Verify actual
  GPU output; individual-preview evidence does not establish grouped rendering cost.
- Keep CSS responsible for ordinary UI transitions: roughly 120–180ms for hover/focus
  and 200–300ms for small disclosures. Do not attach GPU effects to every hover state.
- Animate effect time/intensity through public controls. A manual attachment can use
  the optional GSAP binding and a caller-owned timeline. Keep one owner for those
  controls; direct input and scroll playback must not compete.
- Preserve native scrolling and links; never intercept wheel/touch scrolling.
  Any future scroll-driven control needs equivalent keyboard and touch access.
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
the effect APIs expose only the approved optional main decorative color, not the
brand palette. New controls or effects need separate library work and verification;
keep proposals distinct from implemented catalog effects.

Implementation contracts live in the [browser package](packages/domfx/README.md),
[GSAP adapter](packages/gsap/README.md) and [domain glossary](GLOSSARY.md).

## Acceptance for a UI implementation

- The static page is complete with JavaScript or WebGPU unavailable.
- Keyboard users can navigate, operate controls and see focus. Controls have roughly
  44px target areas. Disabled and unavailable states remain understandable.
- Home effects autoplay only while visible and respect explicit Pause/Off choices,
  including scrolling away/back and navigation restoration. Reduced motion must not
  silently restart when the preference changes back.
- Card selection preserves its authored subject; Text/SVG/Image, intensity,
  playback, zoom, copied code and cleanup work on real content. Header and closing
  artwork stay synchronized without sharing attachment lifetimes.
- Verify 360, 768 and 1440px layouts, 200% browser zoom, and actual DPR 1/2 output.
  Content and controls must stay usable even when capture budgets force static fallback.
- Static metallic accents remain visually distinct from actual warm Fire output.
  The approved single-color picker does not imply additional palette or
  support/performance claims.
- Astro remains the website framework. Neither app imports the other. Keep fixture
  styles and all diagnostic checks intact; lab redesign is a separate task.
- Implementation passes `pnpm agent:verify` plus website tests and applicable manual
  checks. Record the tested environment and distinguish unavailable GPU from success.

## Decisions Log

On 2026-10-02, the user selected **editorial direction B** for
[homepage #89](https://github.com/G0m1namm/domfx/issues/89): a creative ruled layout
with image, SVG and text examples together in the hero, carried through the sections
below the fold. This historical composition is superseded by Gallery/Setup below; exploration
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
interactive. The maintainer approved this visual direction on 2026-10-18.

### Approved Kinetic bloom direction

One silver-violet light pulse sweeps clockwise around the target and sheds small
geometric fragments. Intensity increases the pulse width, brightness, violet wake,
and fragment size and reach. Keep one Kinetic bloom option. The maintainer approved
this visual direction on 2026-10-18.

### Slime exploration direction

On 2026-10-18, the maintainer redirected the Lava exploration to Slime: a solid
colored rim and gravity-driven droplets. On 2026-10-19, the maintainer replaced
the inward fade with a solid coating and defined inner and outer boundaries;
antialiasing is limited to contour coverage. Retain the slow stretching motion
and remove incandescent cracks and heat shading. The maintainer approved the
solid green coating and drip motion on 2026-10-19.

Preserve the accepted buildup, pinch-off, falling drops and neck retraction.

### Approved Burned paper direction

The maintainer approved Burned paper on 2026-10-19: a dark charred rim, uneven
brown scorching and sparse orange-hot seams. Intensity spreads the coating
inward across the target; the outer material rim stays below one CSS pixel to
preserve spacing between letters. Keep the original content intact.

### Approved Dither direction

The maintainer approved the fine ordered-dot effect on 2026-10-19. Small fixed-grid
silver-violet dots form an edge coating and rising wisps; intensity increases dot
density, inward coverage and reach. Keep it free of letters and symbols, with the
original content intact. Larger halftone variants are not part of this approved
pass.

### Approved pattern effects

The maintainer approved Halftone, Stipple, Scanlines, Crosshatch, Diamond lattice
and Contour echoes on 2026-10-19. Preserve their distinct silver-violet marks and
shared silhouette-following intensity controls alongside the original Dither.
These are visual approvals; current verification requirements live in
CONTRIBUTING.md and HARNESS.md.

### Marketing gallery exploration

On 2026-10-19, the maintainer selected Gallery as the marketing prototype direction,
with Spotlight's alternating two-wide and three-across card arrangement. Keep card
metadata focused on effect names and categories; remove the promotional taglines.
Use official Phosphor icons, cleaner controls and Lab Mono labels.
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
glow and animated silver Asterisk, placed above the closing headline and installation
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

Opening a card preserves its text, SVG or illustration in the preview. Offer Text,
SVG and Image as three labeled target options, matching the documentation controls.
Keep card artwork within its available space on phones; balance narrow category
filters across two columns and let the dialog scroll on short screens.

The next refinement reduces hero height with a two-column desktop composition:
headline and supporting copy on the left, Humans/Agents setup tabs on the right.
Stack these on mobile. Give the hero 128px of top padding on desktop and 112px
from tablet down, plus 16px of bottom padding before the collection’s own spacing.
Humans offers the package install command and gallery link.
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
expose credentials for a private repository. On phones, hide the header GitHub CTA and
show it beside “Find your effect” in the Humans hero panel, with the same star
label and count behavior. Keep the GitHub link in the mobile menu.

The approved preview gives the effect subject a larger default size
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

The header and Afterglow Asterisk use the same pattern sequence and
one shared time and intensity cycle, including fade-out, effect switch and fade-in.
The Asterisk joins the current phase when it enters view; release its attachment
when offscreen without restarting the header. The footer playback control pauses or
resumes all automatic marketing effects, including cards and supporting examples.
Preserve that page pause when an offscreen example is recreated; dialog playback
remains independent. The header has no playback button. Use a compact shared
header: 64px on desktop and 56px on phones, retaining 44px control targets. Respect reduced motion and retain the paused state when
that preference changes back.

On 2026-10-19, the maintainer approved integrating the selected marketing design
into the official website. `/` contains the five featured effects and Setup story;
`/effects/` contains the complete filtered gallery. Both use Immersive cards,
Afterglow, Lab Mono labels, Phosphor icons, shared search and zoomable previews.
Render content on the server so the site remains readable without JavaScript.
Keep prototype sources and rejected variants outside the production build.

### Approved optical silver brand direction

On 2026-10-20, the maintainer selected the silver material preview, superseding the
older illustration placements and the proposed burnt-metal artwork direction.
Use thin smoked blue-grey optical surfaces, soft silver reflections, clean rims,
and restrained violet, magenta and pale-yellow glints. Avoid opaque chrome and
irregular generated edges. Retain five shapes: Washer, Split, Open ring, Asterisk
and Pierced ring. Exclude Nested, Stack and the rejected replacement studies.

Use Washer for image cards, Split for Fire, Open ring for Slime and Pierced ring
for the docs Image subject. Replace the large closing domfx wordmark above the
footer with the silver Asterisk; do not add it to the GSAP timeline illustration.
Keep the header and closing Asterisk on the same pattern and time cycle, with a
stronger closing effect: multiply its intensity ramp by 1.6, capped at 1, and
brighten only its decorative canvas by 1.5. The header retains its existing intensity.

Keep the preview's subtle heat floors and Afterglow background. The GSAP timeline's
Ignite bar retains its original violet gradient, `linear-gradient(100deg, #6153b778,
#6153b730)`, instead of the proposed warm heat gradient. Keep text and controls in
the existing UI palette, genuine inline SVG examples intact, and original artwork
and generation provenance recorded. On the maintainer's subsequent cleanup request,
remove superseded visual files, including rejected shapes and unused illustrations,
favicons and social art; Git history preserves the old sources. This direction is
implemented in the marketing site and docs Image preview.

### Approved site-wide share card

On 2026-10-20, the maintainer approved the 1200×630 Frost share card for #124.
Use the existing graphite background, Cabinet Grotesk heading, General Sans body,
flat domfx/washer mark and approved homepage copy. The illustration is the optical
silver Washer with a real Frost effect capture. Use this one static image across
marketing and docs; each page supplies its own social title.
