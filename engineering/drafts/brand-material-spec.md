# feat(web): adopt the burnt-metal brand material

> Spec draft for G0m1namm/domfx. Labels: `spec`, `enhancement`. Not yet filed.
> Agreed with the maintainer on 2026-10-19. The logo was approved; the rest of the material is proposed.
> Source assets: [`apps/web/artwork/brand`](../../apps/web/artwork/brand/README.md).
> Visual reference: [domfx brand material](https://claude.ai/artifact/LDwXcHaYbwPMHtHyrtfXBq) (private).

## Problem

The site has no single brand material. Its visual language is spread across:

- a lightning-bolt favicon and a hexagon `silver-mark.svg`;
- a Phosphor asterisk after the wordmark;
- a family of glass illustrations;
- per-effect radial tints chosen one by one.

The new logo, a tilted annulus washer in burnt metal, has nothing around it to belong to.

The maintainer also rejected the glass illustrations (annulus, split shell, layer relay
and open junction). The site needs new illustrations, not a re-tint of the old ones.

## Solution

One material, used everywhere: **burnt metal**. It is grainy foil silver with heat
rising from the lower edge, colored by one eleven-stop heat ramp. The material comes
in four strengths:

| Strength     | Where it goes                                                                 |
| ------------ | ----------------------------------------------------------------------------- |
| Burnt object | The logo, stickers, social images, and illustrations at 96px and up           |
| Heat floor   | A short slice of the ramp rising from a surface's bottom edge; replaces tints |
| Heat edge    | The ramp as a thin line or bar                                                |
| Flat cut     | One color with a seam; below 32px, and wherever an effect is the subject      |

A new illustration family is cut from the logo's washer: **Stack**, **Split**,
**Open ring** and **Nested**. All four share the logo's angle, thickness and heat.

## User stories

1. As a visitor, I want the logo, illustrations and surfaces to look like one material, so that domfx reads as a single, premium brand.
2. As a visitor, I want heat colors only at the edges of surfaces, so that the live effect stays the main thing on screen.
3. As a visitor browsing the gallery, I want each effect's card to hint at that effect's own heat (Energy, Fire, Frost), so that I can tell effects apart before previewing them.
4. As a social or sticker viewer, I want the mark to stand alone as an object, so that it is recognizable without the wordmark.
5. As a contributor, I want heat colors as named tokens, so that I never hand-pick a tint again.
6. As a contributor making new art, I want one written recipe and render brief, so that new illustrations match the family.

## Implementation decisions

### Gate: approval first

Crimson `#B21A5C`, red `#EB3838` and orange `#F57A29` are new to the palette.
DESIGN.md says not to deviate without explicit approval. No slice below ships until
the maintainer approves the ramp and DESIGN.md records it.

### Heat tokens

The ramp runs from the hottest point at the bottom of a burn to clean metal:

| Token       | Name        | Hex       | Role                    |
| ----------- | ----------- | --------- | ----------------------- |
| `--heat-0`  | ice         | `#80B2FF` | Hottest point, Frost    |
| `--heat-1`  | cobalt      | `#3D47E6` | Energy                  |
| `--heat-2`  | violet      | `#4C2EB8` | Energy, Afterglow       |
| `--heat-3`  | plum        | `#38124C` | Thin dark band          |
| `--heat-4`  | crimson     | `#B21A5C` | Transition (new)        |
| `--heat-5`  | red         | `#EB3838` | Fire (new)              |
| `--heat-6`  | orange      | `#F57A29` | Fire (new)              |
| `--heat-7`  | straw       | `#EBD666` | Top of the heat, accent |
| `--heat-8`  | pale        | `#DBD9B2` | Fade                    |
| `--heat-9`  | cool metal  | `#C7C9D1` | Fade                    |
| `--heat-10` | clean metal | `#C2C4D1` | Untouched metal         |

These are material tokens. UI color tokens (graphite, surface, silver, violet, magenta,
accent yellow) do not change. Heat colors never fill text, controls or whole sections.

The full token block, including the composite floors and edges, is in
`apps/web/artwork/brand/heat-tokens.css`. It belongs in the shared site stylesheet so
that both the marketing and documentation routes can read it.

### Heat floors (replace the radial tints)

A heat floor is two stacked radial gradients at the bottom edge:

- the hotter stop, small and low;
- the cooler stop, wider.

Footprints match today's tints, and alpha stays within today's budget.

| Surface                                            | Today                          | Becomes                                     |
| -------------------------------------------------- | ------------------------------ | ------------------------------------------- |
| Effect card art, Energy category                   | violet `#6153b72c`             | `--floor-energy` (cobalt under violet)      |
| Effect card art, Fire                              | brown-orange `#bd6d3020`       | `--floor-fire` (red under orange)           |
| Effect card art, Frost                             | blue-grey `#84a6c32b`          | `--floor-frost` (ice under cool metal)      |
| Docs lab stage `--lab-tint`, Energy / Fire / Frost | same three tints               | the same three floors                       |
| Preview dialog scene                               | centered violet halo           | the previewed effect's floor, at the bottom |
| Afterglow (closing)                                | violet floor on graphite       | `--floor-afterglow` (cobalt under violet)   |
| Sequence score                                     | violet `#6153b71c` at top left | violet `--heat-2` at the same alpha         |

Some surfaces stay as they are, and the spec makes that explicit:

- **Slime** keeps its green. It is the effect's approved coating color, not heat.
- **Neutral surfaces** keep their metal floor: the default card art, the hover
  overlay and the proof stage.
- **The dialog** loses its centered halo. DESIGN.md already rules out halos and
  radial spotlights.

### Heat edges

- **Fire timeline bar** (the GSAP sequence score): replace the violet fill with
  `--bar-fire`, red cooling to straw left to right. Its label text stays the solid
  text color.
- **Footer edge:** DESIGN.md describes a 4px silver–violet–magenta–pale-yellow edge
  that the current CSS no longer draws. If the edge returns, it uses `--edge-heat`.
  Do not add it in this spec.

### Logo

- The header and footer wordmarks replace the Phosphor asterisk with the flat cut of
  the logo washer.
- The flat cut is the cut that fits beside type at header size. The burnt mark is
  for 32px and up, on brand surfaces.
- `favicon.svg` (bolt) is replaced by a hand-tuned flat cut at 16px and 32px.
- `silver-mark.svg` (hexagon) is replaced by the burnt logo.
- The wordmark type stays Cabinet Grotesk Medium.

### Illustrations

The glass PNGs are retired. Today only `annulus.png` is referenced by the site, as
the image subject on effect cards and the image target in the docs effect lab. The
other three PNGs are unreferenced.

| New illustration | Idea                                     | Takes over                                     |
| ---------------- | ---------------------------------------- | ---------------------------------------------- |
| Nested           | A small washer lifted out of a large one | The image subject on effect cards and docs lab |
| Stack            | Three washers floating in a column       | Quickstart and resource cards (layer relay)    |
| Split            | The washer cut through and pulled apart  | Supporting art (split shell)                   |
| Open ring        | A washer with a quarter removed          | Diagnostic lab card (open junction)            |

**Effect targets must be raster images.** The PNG effect contract tests image alpha
and Fire output, so the image subject has to be a transparent PNG rendered from the
3D master. Do not use the SVG rendering for it. A filter-heavy SVG `<img>` is not an
approved capture source. Decorative placements may use the SVGs until the 3D renders
land.

Keep the old PNGs, prompts and manifest in `apps/web/artwork`, marked as retired.
Their README requires preserving originals. Record each new render's prompt,
reference roles, dimensions and SHA-256 in the manifest, as for the old family.

**3D render brief.** Use `logo-burnt.svg`, then the approved logo render, as the
material reference:

> Use case: stylized-concept. Create ONE isolated 3D illustration for domfx, from the
> domfx logo washer. SUBJECT: [stack: three identical flat washers floating in a
> vertical column with even gaps | split: one washer cut along a diameter, the halves
> pulled a short distance apart | open ring: one washer with a quarter removed |
> nested: a small washer lifted out of the hole of a large one]. CAMERA: the logo
> angle, a near-orthographic view from above, the plane tilted so circles read at about
> half height and rotated 18 degrees counter-clockwise. MATERIAL: thin flat metal with
> softly rounded edges and fine grain. Grainy foil silver on top; heat tempering rises
> from the lowest edges, with ice blue #80B2FF and cobalt #3D47E6 at the very lowest
> edge, then violet #4C2EB8, a thin plum #38124C band, crimson #B21A5C, red #EB3838,
> orange #F57A29 and straw #EBD666, fading into clean silver #C2C4D1 near the top. Heat
> boundaries are soft and irregular, like annealed foil, never straight rainbow bands.
> Soft upper-left studio light. Transparent background and openings; no floor, shadow,
> text, glow, flame or particles.

### Shapes on effect cards

The pierced ring and the eight-arm asterisk stay **flat silver in the gallery**,
because the effect is the subject there. Their burnt versions are for brand surfaces
only: stickers, social cards and docs art. The "Aa" and "flow." letterforms always stay
flat silver; DESIGN.md rules out chrome lettering.

### Slices

Each slice is independently shippable after the approval gate:

1. **Tokens and rules.** Add the heat tokens and this material's rules to DESIGN.md and
   the shared stylesheet. No visual change yet.
2. **Heat floors and edges.** Swap the tints and the Fire bar for the tokens.
3. **Logo.** Flat cut in the header and footer, favicon, and replacement social mark.
4. **Illustration renders.** Render Nested, Stack, Split and Open ring in 3D; add them
   with provenance; retire the glass PNGs.
5. **Effect target swap.** Make the Nested PNG the image subject on cards and in the
   docs lab, then re-verify the effect output.

## Testing decisions

- Run `pnpm check` and `pnpm test:web:smoke` on every slice; finish agent runs with
  `pnpm agent:verify`.
- **Slices 2 and 3** change only appearance. Verify them in the browser on the home,
  effects and a docs effect page, at desktop and 375px:
  - card tints are visible but stay below the card subject;
  - text contrast is unchanged;
  - no halo remains in the dialog.
- **Slice 5** changes an effect target. Follow the artwork README checks:
  - real alpha and transparent openings;
  - capture bounds;
  - Fire at DPR 1 and 2, the None effect, and reduced motion;
  - the effect card and docs lab both attach and dispose cleanly.
- There are no new unit tests. The tokens are CSS, and the existing web smoke tests
  cover the routes.

## Out of scope

- Changing any effect's own colors or shaders. Fire, Frost, Energy and the others keep
  their library output; only the surfaces around them change.
- Animating the material, or adding noise or grain to page backgrounds. DESIGN.md
  rules out animated noise and decorative motion.
- A footer gradient edge, unless the footer redesign brings it back.
- Merchandise and sticker print specs (bleed, die lines), which are separate work.

## Further notes

- The SVG assets are renderings, generated from a local script during the logo
  exploration. The 3D renders become the source of truth once approved.
- No skill in the repo or the user's catalog covers branding. A Design System artifact,
  or Figma's design-library tooling, could hold these tokens later for agents.
