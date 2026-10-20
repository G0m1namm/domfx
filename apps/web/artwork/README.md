# Optical silver artwork

Approved on 2026-10-20 for the marketing site and documentation Image preview.
The five transparent PNGs live in [`src/assets/brand`](../src/assets/brand).

| Shape        | Placement                                 | Generation prompt                           |
| ------------ | ----------------------------------------- | ------------------------------------------- |
| Washer       | Image cards and social image              | [Prompt](prompts/washer-optical.json)       |
| Split        | Fire card                                 | [Prompt](prompts/split-optical.json)        |
| Open ring    | Slime card                                | [Prompt](prompts/open-ring-optical.json)    |
| Asterisk     | Animated closing section above the footer | [Prompt](prompts/asterisk-optical.json)     |
| Pierced ring | Documentation Image preview               | [Prompt](prompts/pierced-ring-optical.json) |

Use thin smoked blue-grey optical surfaces, soft silver reflections, clean rims,
and restrained violet, magenta and pale-yellow glints. Follow the
[material template](material-template.txt) and an approved image as the visual anchor.
Keep actual alpha outside each shape and through its openings; avoid thick opaque
chrome, forced rainbow bands, detached specks and irregular edges.

[manifest.json](manifest.json) records exact dimensions and SHA-256 hashes. Each
prompt records the full request, reference roles and reference image hashes.
The built-in GPT image tool did not expose a model version or seed. Reference
proofs and rejected candidates are local exploration artifacts, not website assets.

Per the maintainer's cleanup request, superseded illustrations, unused social and
card artwork, and rejected Nested/Stack SVGs are removed from the working tree.
Git history retains their earlier assets and generation records. New iterations
should use the retained optical PNGs as references and preserve active sources.

Effect targets remain raster images; genuine inline SVG examples remain vectors.
Verify real Fire output and image alpha at DPR 1/2, unavailable WebGPU and reduced
motion after changing an image target. Supporting artwork remains static with empty
alternative text; effect lifetimes belong to the website controllers.

The flat washer mark is [`public/brand-mark.svg`](../public/brand-mark.svg), with a
small-size cut in [`public/favicon.svg`](../public/favicon.svg). Surface colors are
in [`packages/site/src/styles/brand.css`](../../../packages/site/src/styles/brand.css). The
[selected design](../../../DESIGN.md#approved-optical-silver-brand-direction)
governs placement and the stronger closing effect.
