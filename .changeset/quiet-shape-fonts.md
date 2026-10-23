---
'@domfx/browser': patch
---

Avoid repeated font fetches during effect recapture: skip embedding for shapes and images, and reuse validated font data for unchanged, readable top-level font declarations. Preserve fresh text, style and image capture.
