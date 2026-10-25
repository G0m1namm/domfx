---
'@domfx/browser': patch
---

Keep opt-in relative captures at exact DPR and rasterize supported bounded source paint independently of effect padding, preserving PNG silhouettes and procedural phase as extent changes. Reject escaping direct and boxless text before bounded rasterization, while allowing logical font rectangles inside the finite source guard. Existing allocation gates and omitted-option output remain unchanged.
