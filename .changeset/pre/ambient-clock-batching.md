---
'@domfx/core': patch
'@domfx/browser': patch
---

Add explicit manual/ambient attachment clock modes and ambient pause/resume controls.
Batch parameter writes into one render commit per dirty target per animation frame
through a shared document scheduler, reusing captured rasters. Manual remains the
default.

Breaking change: control writes update readable values immediately but no longer
render synchronously. Await the next animation frame before reading rendered output.
