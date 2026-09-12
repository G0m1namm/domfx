---
'@domfx/core': patch
'@domfx/browser': patch
'@domfx/gsap': patch
---

Detach GSAP bindings when their attachment is disposed. Context cleanup disposes an
attachment only with explicit `disposeEffect: true` ownership. Add `bindFireAsync()`
to register cleanup before a pending attachment resolves, release late results, and
prevent tween insertion after teardown while preserving caller timelines and siblings.

Breaking change for custom handle implementations: `ManualEffectHandle` now requires
`onDispose(callback)`, returning an unsubscribe function and notifying once on disposal
(immediately for an already disposed handle). Browser-created handles implement it.
Binding an already disposed handle now rejects synchronously.
