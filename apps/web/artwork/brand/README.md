# Brand material

The domfx brand material is burnt metal: grainy foil silver, with heat rising from
the lower edge. These files are its source assets. The rollout plan is in
[#126](https://github.com/G0m1namm/domfx/issues/126), with the original brief in
[the brand material spec](../../../../engineering/drafts/brand-material-spec.md).

Status: proposed on 2026-10-19. Crimson, red and orange in the heat ramp still need
approval before they are added to `DESIGN.md`. On 2026-10-20, the maintainer
requested a local preview before approving the ramp; production assets and design
rules remain unchanged until that decision.

## Files

| File              | What it is                                                     |
| ----------------- | -------------------------------------------------------------- |
| `logo-*.svg`      | The logo: the annulus washer, tilted to the illustration angle |
| `ring-bar-*.svg`  | Pierced ring, an effect card subject                           |
| `asterisk-*.svg`  | Eight-arm asterisk, an effect card subject                     |
| `stack-*.svg`     | New illustration: three washers floating in a column           |
| `split-*.svg`     | New illustration: a washer cut through and pulled apart        |
| `open-*.svg`      | New illustration: a washer with a quarter removed              |
| `nested-*.svg`    | New illustration: a small washer lifted out of a large one     |
| `heat-tokens.css` | Heat ramp tokens, heat floors and heat edges                   |

Each shape comes in two cuts:

- `*-burnt.svg` is the full material. Use it at 96px and up, and from 32px up for
  the logo.
- `*-flat.svg` is one color, with a seam where the face meets the side. Its colors
  come from `--mark` (default `#C2C5DB`) and `--ground` (default `#14151B`).

## How the material is built

Every burnt object uses the same four layers, in this order, clipped to the shape's
silhouette:

1. **Foil:** a horizontal band gradient of silvers, blurred with a 6px Gaussian.
2. **Heat:** a vertical black-to-white ramp, from below the object up to its upper
   third. It is broken up with fractal noise (base frequency `.008 .004`, two octaves),
   blurred with a 16px Gaussian, then gradient-mapped through the eleven heat stops.
   Values near white become transparent, so the top stays clean metal.
3. **Soft edges:**
   - a blurred dark shade over the side;
   - a faint dark falloff along the face edge;
   - a top-left sheen on the rim;
   - a soft reflection along the lower edge.
4. **Grain:** fine fractal noise, overlay-blended at 36%.

Every object lies on the logo's plane: rotated −18°, squashed to 0.52 of its height,
and 22 units thick (in a 400-unit canvas). Heat and foil run in screen space, so heat
always rises from the bottom of the frame, whatever the object's shape.

The SVGs are renderings of the material. Final art for stickers, avatars and
effect targets should be rendered in 3D from the brief in the spec, using
`logo-burnt.svg` as the material reference.
