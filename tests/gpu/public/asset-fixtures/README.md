# Capture asset fixtures

These original fixtures are MIT licensed with domfx. They contain no third-party
font or image artwork.

- `split.png`: 40 × 40 RGBA PNG, opaque red in columns 0–19 and opaque blue in
  columns 20–39. Generated with Python's `struct` and `zlib` modules.
- `block.ttf`: original TrueType test font, generated with FontTools 4.65.0.
  Units per em: 1000. Glyphs: `.notdef`, space and `A`. Each advance is 1000;
  `A` is a filled rectangle from (100, 0) to (900, 800). Ascender/descent: 800/−200.
  The deliberately unusual `A` makes system-font fallback visibly different.

`browser-tests/assets.spec.ts` serves these bytes through controlled delayed
responses and a separate loopback origin, including responses with and without
CORS permission. Invalid byte responses test image/font decode rejection. An SVG
image and an ArrayBuffer-backed FontFace test explicit unsupported outcomes.

The suite saves separate live-target and returned-frame PNGs for delayed image,
background and font fixtures. It decodes those screenshots and compares pixels,
allowing at most 99 differing pixels above an eight-channel-level tolerance at
text/image edges, while requiring substantial nonwhite paint. Reports record the
actual browser and checks. These fixtures establish Chromium behavior at DPR 2;
they do not establish universal font, animated image, SVG image, or CSS support.
