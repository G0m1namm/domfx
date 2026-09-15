---
"@domfx/core": patch
"@domfx/browser": patch
---

Add explicit `retry()` to effect handles. Concurrent requests share one teardown and
initialization attempt, recheck admission conditions, and preserve controls and disposal
subscriptions. Old work releases resources before recovery; disposed or disconnected
handles cannot revive, and replacement target ownership is preserved.

Custom implementations of `ManualEffectHandle` or `EffectHandle` must now provide
`retry(): Promise<void>`; callers using the built-in attachment receive it automatically.
