---
'@domfx/core': patch
'@domfx/browser': patch
'@domfx/gsap': patch
---

Add `clock: 'auto'` for automatic animation while preserving `'ambient'` and the
existing default `'manual'`. The read-only clock reports the supplied spelling.
Expose generic `bindEffect` / `bindEffectAsync` names and matching types alongside
the compatible Fire-named snapshot bindings. Document native GSAP property tweens
as the primary sequencing approach, with explicit effect cleanup.
