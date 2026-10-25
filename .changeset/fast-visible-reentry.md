---
'@domfx/browser': patch
---

Recover visible stale effects after fast viewport re-entry when a delayed native
intersection callback misses the offscreen position. Retain paused/manual time
and capture once on recovery without polling hidden targets.
