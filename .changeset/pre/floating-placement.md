---
'@domfx/browser': patch
---

Use Floating UI for effect placement while retaining capture padding, clipping and positive axis-aligned scale. Position updates share the document scheduler, preserve paused/manual output, and ignore obsolete asynchronous coordinates after refresh, suspension or disposal. Initial output waits for valid hidden-layer geometry before presentation.
