---
'@domfx/browser': patch
'@domfx/core': patch
'@domfx/gsap': patch
---

All public `@domfx` packages now share one version, so use the same version of every `@domfx` package. `@domfx/core` is installed automatically and no longer appears in the install steps. All three packages set `"sideEffects": false`, so bundlers can drop unused modules.
