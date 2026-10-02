---
# gstack: design-md-format=spec
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
    fontSize: clamp(2.5rem, 5.3vw, 4.75rem)
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
The approved 2026-09-29 annular scroll story supersedes the earlier framed, split and broad silver-plate compositions. The user supplied Letters as the hero proportion reference.

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

1. **Header:** wordmark, native Examples and Docs links, and View source with a GitHub icon. Keep all destinations available on mobile.
2. **Hero:** “Effects that follow your HTML.” Supporting copy: “Add GPU effects to real elements. Your text stays selectable. Your links keep working.” Fold “Keep the HTML” into a native selection instruction. Useful actions are Try the live elements and Read the quickstart; experimental/unpublished status stays quiet.
3. **Hero proportions:** centered heading at 20% of viewport height (14% with smaller type at heights up to 800px); the central ring starts at 72%. Preserve the approved 4:3 asset canvas. The center is 500–650px wide; adjacent pieces are 82% and 64% of that size, offset horizontally by 360px/660px and vertically by 85px/155px. Desktop reveals five pieces; narrower viewports crop the outer pieces.
4. **Scroll story:** one GSAP-owned scene pins for 5.4 viewport heights, preserving the opening’s original 0.72-viewport travel. The center PNG moves to the viewport center and shrinks to at most 480px, leaving 32px horizontal clearance on phones and reserving vertical room for copy and the dock on shorter screens. A genuine SVG with the same traced silhouette replaces it at exactly the same bounds. A live “Keep the HTML.” heading follows, scaled from 40px on phones to 112px on desktop on a single line. An 18–24px two-line explanation sits below it, followed by one quieter 14px instruction to select the text or adjust the controls. No redundant onward-scroll link is needed. Image/SVG headings reveal by line at top-left; two short paragraphs enter slightly later at bottom-right. Copy settles for a reading interval, then exits upward independently of the centered artwork. Entrances use power2.out, exits power1.in, and shape crossfades sine.inOut, with 0.25s scrub catch-up. The final live heading stays visible as the scene unpins and joins document scroll. Direct stage links land instantly in the reading interval and support keyboard navigation and reverse scrolling.
5. **After the pin:** the approved A layout introduces “Put Fire on your timeline.” with `@domfx/gsap` highlighted in the description. An unequal two-panel row pairs the timeline and focused binding code with initial configuration; a full-width panel explains timeline controls. “Bring your own edge.” closes with Quickstart and native disclosures for complete GSAP and standalone setup. Thin, static gradient borders span the full length of the card edges and adoption divider. The footer reprise remains decorative and static.
6. **Effect ownership:** five hero images, one SVG, one native text heading and the quickstart link have independent lifetimes under the existing shared Fire controller. Artwork uses bounded 256px local capture surfaces and positive proportional scaling to stay within capture budgets at DPR 1/2. The SVG uses solid silver vector paint because URL-based SVG gradients are outside the current capture contract.
7. **Scroll-card intensity:** `maximum × clamp(1 − abs(cardCenter − H/2) / ((H + cardHeight)/2), 0, 1)`. It peaks at center and decreases symmetrically; scroll updates while paused without recapture.
8. **Fallback:** without JavaScript, with reduced motion, or below 800px viewport height (680px on desktops at least 1100px wide), the story is an ordinary document with all three stages in reading order. No pinning or hidden content. Toolbar instructions appear only after initialization; original content and guide links remain complete. No invented registry command or performance claims.

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

### Examples and toolbar

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
on failure. None requests removal without installation. Fire concisely links to installation and standalone docs and requires matching unpublished
artifacts/source supporting all selected settings. Verified release versions will replace
this setup only after registry consumer proof. Prompt never loads the GPU package.

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

- Marketing uses eight authored targets with one shared clock and Pause/Resume.
  Attach only visible targets; respect pause and off choices on return. Verify grouped
  rendering on the actual GPU; individual-preview evidence does not establish its cost.
- Keep CSS responsible for ordinary UI transitions: roughly 120–180ms for hover/focus
  and 200–300ms for small disclosures. Do not attach GPU effects to every hover state.
- Animate effect time/intensity through public controls. A manual attachment can use
  the optional GSAP binding and a caller-owned timeline. Keep one owner for those
  controls; direct input and scroll playback must not compete.
- Preserve native scrolling. For the scrolling card, map viewport position to public intensity;
  scrolling backward must reproduce the earlier intensity. Provide an equivalent seek control for keyboard and touch users.
  The approved homepage story is a bounded 5.4-viewport pin with direct stage links; never intercept wheel/touch scrolling. Reduced motion and short viewports remove pinning entirely.
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
[GSAP adapter](packages/gsap/README.md) and [domain glossary](CONTEXT.md).

## Acceptance for a UI implementation

- The static page is complete with JavaScript or WebGPU unavailable.
- Keyboard users can navigate, operate controls and see focus. Controls have roughly
  44px target areas. Disabled and unavailable states remain understandable.
- Home effects autoplay only while visible and respect explicit Pause/Off choices,
  including scrolling away/back and navigation restoration. Reduced motion must not
  silently restart when the preference changes back.
- Homepage examples use one effect controller and independent attachment lifetimes; a separate GSAP context owns only scroll choreography.
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
