---
"@domfx/browser": patch
---

Refine GPU signed distances around disconnected overflow paint to satisfy the full-raster DPR 1/2 capture gate. Reuse existing GPU allocations and preserve alpha classification and target-local mapping. Document the verified padding and paint limits.
