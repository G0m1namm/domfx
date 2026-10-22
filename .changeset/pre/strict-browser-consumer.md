---
'@domfx/browser': patch
---

Keep internal renderer declarations out of the browser root attachment API so strict
TypeScript consumers do not need WebGPU ambient types. Preserve the existing public
signatures and verify packed Node imports, declarations and dependency/export boundaries.
