---
'@domfx/browser': patch
---

Reduce repeated asset work during effect recapture. Skip fonts for shapes and images, reuse validated unchanged fonts, and retain fresh raster data within a bounded HTTP-aware cache. Preserve changed content and image reloads. Fix temporary image cleanup that retained detached fallback nodes in Chromium.
