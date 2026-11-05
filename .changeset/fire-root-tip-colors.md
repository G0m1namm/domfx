---
'@domfx/browser': patch
---

Add writable `rootColor` and `tipColor` to Fire, exclusive with `color`, with embers following the Tip color. Colors blend in gamma-encoded sRGB, so complementary pairs pass through gray at their midpoint. Fire without either color renders exactly as before.
