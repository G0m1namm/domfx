---
'@domfx/browser': patch
---

Keep manual and paused effect layers aligned through fractional layout shifts and positive axis-aligned target or ancestor scaling. Track placement using the shared Document scheduler without advancing time, recapturing, or redrawing unchanged output. Root transform-only inline style changes preserve fresh captured paint; descendant transforms and paint changes still require explicit refresh.
