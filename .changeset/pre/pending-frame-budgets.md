---
"@domfx/browser": patch
"@domfx/core": patch
---

Reserve pending capture, GPU and output estimates before attachment allocations. Enforce per-target and Document budgets across concurrent initialization and refresh, reconcile actual frame sizes, and release reservations with their resources. Add the typed `target-budget` reason; budget failures preserve the original target and reject affected refresh promises.
