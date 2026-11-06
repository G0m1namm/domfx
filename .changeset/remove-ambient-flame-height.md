---
'@domfx/browser': minor
'@domfx/core': minor
---

Remove the `'ambient'` clock spelling and Fire's `flameHeight`. Use `clock: 'auto'` for identical timing. Omit `flameHeight` for the Default appearance, or use `flameReach` to size flames relative to the target; custom pixel-sized flames are no longer possible. The old values now throw `invalid-clock-mode` and `invalid-fire-parameter`. Fire with nothing set renders exactly as before.
