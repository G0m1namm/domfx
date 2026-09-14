---
'@domfx/browser': patch
---

Avoid capture, canvas and GPU allocation for initial reduced motion. Live reduced-motion
changes release output and invalidate pending work without automatically restarting when
the preference changes back. Add `motion: 'static'` for deterministic time-zero decoration
with no ambient animation.
