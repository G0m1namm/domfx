# domfx design direction

Shared visual guidance for the future marketing site (`apps/web`) and the existing
diagnostic lab (`apps/lab`). This document defines the intended UI; it does not
describe a completed redesign or expand the library's supported behavior.

## Direction

**A quiet, precise interface with a few expressive effects on real HTML.**

Use generous space, clear typography, thin borders and mostly neutral surfaces.
Concentrate gradients and motion around the examples that explain domfx. The page
should feel complete before any GPU effect starts.

The visual reference is [Oxc](https://oxc.rs/), reviewed in September 2026:
its dark neutral canvas, bounded page grid, fine dividers, spacious split hero,
large sans-serif headings and restrained luminous accents inform this direction.
Create original domfx compositions and assets; Oxc's branding, illustrations and
copy belong to Oxc.

Use a dark graphite shell with silver metallic focal elements and colored edges.
The user's Vyse references from Valorant establish the material direction: broad
silver faces with violet, magenta and pale yellow transitioning along their edges.
Oxc remains the layout reference. The five base colors below are sampled from the
user's supplied palette; supporting UI shades are derived for readability. Keep
this reference descriptive so contributors do not need the original attachments.
A light theme can follow when there is a concrete requirement and a separate
contrast pass.

## One identity, two purposes

| Surface   | Visitor's goal                                                      | Design emphasis                                                          |
| --------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Marketing | Understand what domfx does, see it working, find setup and examples | Spacious sections, concise explanation, one prominent live demonstration |
| Lab       | Inspect capture and rendering, reproduce behavior, save evidence    | Compact controls, stable fixtures, explicit state, readable diagnostics  |

Share typography, colors, spacing, focus treatment and control styling. Keep each
app's layout appropriate to its purpose. `apps/web` is planned and is not yet
scaffolded. Neither app imports the other; this document is enough shared structure
until implementation demonstrates a need for shared code.

## Visual foundations

### Color

| Token                    | Value     | Use                                            |
| ------------------------ | --------- | ---------------------------------------------- |
| `--color-bg`             | `#191920` | Deep graphite page canvas                      |
| `--color-surface`        | `#292A35` | Controls and inset panels                      |
| `--color-graphite`       | `#3B3C4A` | Palette graphite; raised and selected surfaces |
| `--color-border`         | `#505161` | Decorative dividers and panel boundaries       |
| `--color-control-border` | `#8E91A8` | Input boundaries that must be easy to identify |
| `--color-text`           | `#F2F3F8` | Headings and primary copy                      |
| `--color-silver`         | `#C2C5DB` | Palette silver; metal faces and secondary text |
| `--color-metal-light`    | `#E8EAF3` | Broad, soft metallic highlights                |
| `--color-violet`         | `#6153B7` | Palette violet; outer edge and material shadow |
| `--color-magenta`        | `#F047FE` | Palette magenta; narrow edge transition        |
| `--color-yellow`         | `#E6DC6A` | Palette pale yellow; inner edge highlight      |
| `--color-focus`          | `#E6DC6A` | Solid keyboard focus outline on dark surfaces  |
| `--color-success`        | `#9ED9AD` | Passing checks, paired with text               |
| `--color-warning`        | `#F2CA82` | Stale or unavailable states, paired with text  |
| `--color-danger`         | `#FFA4A4` | Failed checks and errors, paired with text     |

### Metallic surfaces and colored edges

Silver occupies most of each featured object. Use a broad, low-contrast reflection
across its face, with color restricted to a narrow rim or one exposed edge. The
direction across that edge is **violet → magenta → pale yellow → silver**. Violet
anchors the outer edge; yellow makes the short luminous transition into the metal.
Avoid equal-width rainbow stripes or a fully magenta/purple surface.

Starting CSS recipes (static visual treatments, independent of the GPU renderer):

```css
--gradient-metal: linear-gradient(125deg, #C2C5DB 0%, #E8EAF3 38%, #C2C5DB 68%, #9296AD 100%);
--gradient-edge: linear-gradient(110deg, #6153B7 0%, #F047FE 38%, #E6DC6A 70%, #C2C5DB 100%);
```

Use the metal gradient for a short display title or a featured illustration's main
face. Apply the edge gradient in a separate decorative border or contour layer;
orient it across the rim where possible. For a broad hero illustration, keep about
80–90% of its visible face silver and reserve the rest for the colored transition.
This is a composition guide, not a required pixel ratio. A narrow outer shadow and
soft highlight can suggest thickness; avoid heavy bevels, constant shimmering or
mirror-like reflections across the whole interface.

- **Titles:** predominantly silver lettering; use the colored edge on one short
  featured phrase. Ordinary headings stay solid. Keep letter interiors legible.
- **Images and SVG:** a silver subject with a colored contour or exposed upper edge,
  following its silhouette. Use original artwork; the references guide the material.
- **Primary action:** silver fill, dark text and a restrained colored rim. Hover may
  brighten the rim briefly; the label and button geometry stay stable.
- **Panels:** dark graphite with quiet borders. Reserve metallic treatment for a
  selected preview or hero object; diagnostic panels keep flat backgrounds.
- **Links and selection:** silver underlined links, brighter text on hover, and a
  pale-yellow active marker. Violet is decorative and is too dark for small text
  on the graphite shell. Do not use a multicolor gradient to communicate status.

Keep long copy, code, input labels and status text solid. Avoid a gradient wash
across the page or a glow on every card. Warm fire remains the current live effect;
the silver material and colored rim define the surrounding identity.

Use dark text (`#191920`) on silver or pale-yellow filled buttons. Use a dark focus
outline on light metallic surfaces and the yellow focus token on dark surfaces.
Verify actual rendered contrast,
including every gradient stop used behind text: at least 4.5:1 for normal text,
3:1 for large text and meaningful control boundaries. Decorative separators may
remain subdued. Status palettes and diagnostic image colors have different roles;
preserve the lab's mask/SDF legends.

### Typography

Start with `Inter, ui-sans-serif, system-ui, sans-serif`; use the system fallback
until Inter is deliberately added as a self-hosted asset. Use
`ui-monospace, SFMono-Regular, Consolas, monospace` for code and numerical values.
Keep text selectable and use tabular figures for changing measurements.

| Role                         | Size / line height                  | Weight  |
| ---------------------------- | ----------------------------------- | ------- |
| Marketing hero               | `clamp(2.5rem, 5vw, 4.5rem)` / 1.05 | 550–600 |
| Marketing section title      | `clamp(2rem, 3vw, 3rem)` / 1.15     | 550–600 |
| Lab page title               | 1.75–2.25rem / 1.2                  | 600     |
| Panel title                  | 1.125rem / 1.35                     | 600     |
| Body                         | 1rem / 1.6                          | 400     |
| Controls and supporting text | 0.875rem / 1.45                     | 400–500 |
| Code and measurements        | 0.8125–0.875rem / 1.55              | 400     |

Use slightly tight tracking for large headings (about `-0.03em`); keep body and
controls at normal tracking. Limit prose to about 60–68 characters per line.
Reserve uppercase monospaced eyebrows for short section labels. The lab's capture
fixture fonts, including the counter-bearing headline, remain fixture-specific.

### Space, geometry and responsive layout

- Spacing scale: 4, 8, 12, 16, 24, 32, 48, 64, 96px.
- Center the marketing page within 1200px and the lab within 1440px. Use side gutters
  of 24–40px on desktop and 16px on small screens.
- Marketing sections get 80–112px vertical space on desktop and 48–64px on mobile.
  Lab groups use 24–32px so related evidence remains close together.
- Use a 1px outer grid and section dividers. Corners are mostly square: 6px for
  controls, 10px for inset panels. Avoid nested rounded cards around every paragraph.
- Keep surfaces flat. Reserve shadows for floating menus and dialogs.
- Below roughly 800px, stack marketing hero columns and lab preview/control panes.
  At 360px, ordinary content and controls must fit without page-wide horizontal scroll.
- Keep diagnostic pixels and intentional scrolling fixtures faithful to their tests.
  Put wide code, tables and diagnostic views in labeled local scrolling regions;
  do not shrink fixture geometry to force a responsive layout.

## Marketing site

### Page structure

1. **Header:** domfx wordmark, Examples, Documentation, Lab and GitHub. Keep navigation
   short; show only destinations that exist. Use a labeled menu button on mobile.
2. **Split hero:** a plain statement on the left and a live HTML composition on the
   right. Suggested title: “Effects that follow your HTML.” Supporting copy explains
   that domfx adds GPU edge effects while the original content stays interactive.
   Primary action: “Explore examples.” Secondary action: “View on GitHub.”
3. **Selected examples:** a compact selector for Title, Button, SVG, Image and Card.
   Show one large preview at a time, with its source element, effect toggle and a
   short explanation of the demonstrated behavior. Keep navigation around it quiet.
4. **Control the effect:** a small code example beside play, pause and seek controls.
   Show the real attachment API and caller-owned animation model.
5. **Scroll demonstration:** one bounded example showing an effect staying aligned
   to an element during ordinary scrolling. Add scroll-driven playback only after
   the integration described below is implemented and verified.
6. **Status and next step:** concise experimental status, verified environment limits,
   links to setup, source and the lab. End with a simple footer.

The hero demonstration should use a short, real silver heading with a small
transparent metallic image or SVG nearby. Concentrate the violet/magenta/yellow
rim on that featured composition. Make the heading the first effect target; keep secondary
elements static until the visitor selects another example. Use a real button or
link in the examples so interaction is visible. Render claims and limitations as
ordinary text, independent of animation.

Packages are currently private and experimental. Link to repository setup instead
of presenting an npm installation command. Use only measured performance claims
with a linked environment and method; do not invent benchmarks or adoption figures.

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
| Short hero title             | Brief fire introduction or visitor-controlled playback    | Public `attachFire`; retain the real heading and readable letter interiors                               |
| SVG or transparent image     | Edge effect reveals holes and silhouette                  | Use bounded, decoded assets and a supported host; keep image alternatives                                |
| Ordinary rectangular photo   | Edge effect around the photo's outer shape                | An opaque photo produces a rectangle; isolating the pictured subject requires an asset with transparency |
| Example button or card       | Demonstrate that the original control remains usable      | Effect layer stays decorative and pointer-transparent; required navigation stays plain                   |
| Scrolling target             | Effect follows its source while time stays fixed or plays | Supported placement tracking handles bounded rectangular scrolling hosts                                 |
| Scroll-driven intensity/time | Scrub one manual effect through a short section           | Proposed app integration, not a built-in domfx scroll API; verify separately                             |

### Motion and ownership

- Marketing gets one animated focal point per viewport. Start with a short entrance
  of at most three seconds, then hold; offer explicit Play/Pause for longer playback.
  The lab's simultaneous five-target run is an intentional diagnostic exception.
- Keep CSS responsible for ordinary UI transitions: roughly 120–180ms for hover/focus
  and 200–300ms for small disclosures. Do not attach GPU effects to every hover state.
- Animate effect time/intensity through public controls. A manual attachment can use
  the optional GSAP binding and a caller-owned timeline. Keep one owner for those
  controls; direct input and scroll playback must not compete.
- Preserve native scrolling. For a future scroll-driven example, map progress through
  one section to a bounded manual timeline; scrolling backward must reproduce the
  earlier state. Provide an equivalent seek control for keyboard and touch users.
  Avoid scroll hijacking, long pinned sections and full-page parallax.
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

- The page is understandable and usable with JavaScript or WebGPU unavailable.
  Marketing preserves content and links; the lab explains unavailable diagnostics.
- Keyboard users can navigate, operate controls and see focus. Use semantic headings,
  labels and buttons; controls have a target area of about 44 × 44px. Announce relevant
  state changes without announcing every animation tick.
- Reduced motion leaves a complete static layout and never silently starts playback.
- At 360, 768 and 1440px widths, and 200% browser zoom, navigation, copy and controls
  remain usable; effect layers neither cover controls nor create page overflow.
- Featured objects remain mostly silver with color concentrated at their edges;
  gradients remain accents, text contrast passes, and active/failed states are clear
  without color alone. Original DOM stays selectable and interactive.
- Marketing demonstrates real supported behavior. The lab retains all required
  fixtures, numerical gates, independent controls, disposal and saved evidence.
- Capture/render changes pass `pnpm agent:verify` and applicable manual checks in
  development and production. Inspect real DPR 1/2 output, scrolling alignment,
  refresh, failure and cleanup; record the tested browser/GPU rather than implying
  universal support.

Implement the shared tokens and shell first, then the marketing hero and lab layout,
then optional scroll-driven examples. Review each stage against this document before
adding more motion or visual treatments.
