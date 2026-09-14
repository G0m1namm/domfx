---
'@domfx/browser': patch
---

Automatically refresh observed target size, paint, image and font changes using coalesced, generation-safe captures. Preserve placement-only raster reuse, cancel queued observation on disposal, and report capture failures without retries. Document explicit-refresh limits and reject source-mutating capture styles before they can create feedback loops.
