---
'@domfx/core': patch
'@domfx/browser': patch
---

Add explicit `refresh()` to effect handles. Refresh hides stale output immediately,
coalesces pending revisions, and resolves after a requested-or-newer replacement commits.
Failures and invalidation reject pending refreshes; late frames release their resources
without painting. Existing `ready` behavior is preserved. Custom implementations of
`ManualEffectHandle` or `EffectHandle` must now implement `refresh(): Promise<void>`.
