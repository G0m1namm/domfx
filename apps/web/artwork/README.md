# Illustration family

The user approved this family on 2026-09-29: thin smoothly bent optical sheets,
smoky dark reflective faces, soft silver light, and restrained spectral glints.
The original PNGs live in [`src/assets/illustrations`](../src/assets/illustrations).
Keep these source files intact; Astro generates the smaller page PNGs at build time.

| Illustration  | Current use                                      | Exact generation prompt             |
| ------------- | ------------------------------------------------ | ----------------------------------- |
| Annulus       | Hero, focused PNG, footer; traced SVG silhouette | [Prompt](prompts/annulus.json)      |
| Split shell   | Supporting illustration                          | [Prompt](prompts/split-shell.txt)   |
| Layer relay   | Quickstart card                                  | [Prompt](prompts/layer-relay.txt)   |
| Open junction | Diagnostic lab card                              | [Prompt](prompts/open-junction.txt) |

A burnt-metal replacement family (Stack, Split, Open ring and Nested) is proposed
in [`brand`](brand/README.md). Until it is approved, this family stays in use.

## Generate consistently

1. Read the [shared material template](material-template.txt) and the closest exact
   prompt above. Use the approved original PNG as a visual material/lighting reference.
   Prompts alone do not lock a visual material; keep an approved image in the input.
2. For a new shape, replace only the subject and intended placement. For an adjustment,
   edit the existing PNG and explicitly preserve geometry, camera, material, lighting,
   alpha and palette except for the requested change. Use the built-in image tool with
   transparent output; do not flatten onto a dark background.
3. Compare against all three originals on #14151B and near-black at detail and
   160–240px sizes. Require thin surfaces, readable openings, restrained highlights
   and a coherent camera/light direction. Avoid thick bright chrome or neon rims.
4. Save a new version without overwriting the approved original. Store its full prompt,
   reference roles and source hash/dimensions in this directory, then update the page
   only after reviewing the candidate. Image generation is not bit-reproducible;
   the tool did not expose a model version or seed for this set.
5. Check actual alpha, capture bounds and transparent openings. Some original pixels
   have very low nonzero alpha; do not assume the PNG's nonzero-alpha bounding box
   is its meaningful silhouette. Preserve the original when optimizing derivatives.
   For effect targets, check Fire at DPR 1/2, None and reduced motion. Supporting
   illustrations remain decorative static images with empty alternative text.

The exact prompts came from three independent fresh-context agents using the same
material reference: [Vivid Motion's 3D Illustration System for ThreatPoint](https://dribbble.com/shots/27532349-3D-Illustration-System).
The reference informed material and lighting; the domfx shapes are original generated
artwork. Third-party reference images are not distributed in the website or repository.
Future runs can use the approved domfx originals as locally available anchors.
[manifest.json](manifest.json) records dimensions, SHA-256 hashes and provenance.

The genuine inline SVG example stays a vector. Do not embed one of these PNGs inside
an SVG and label it an SVG silhouette demonstration.

The annulus was approved after a user-supplied geometry reference: remove the central sphere, retain the optical-metal dish, and recolor reflections to the domfx palette. Its 1448×1086 transparent canvas is preserved without stretching. The inline SVG traces its outer and inner alpha contours with smooth quadratic paths; it contains no embedded raster.
