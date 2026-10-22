---
'@domfx/browser': patch
---

Suspend rendering and placement for hidden or offscreen targets. Freeze ambient time without catch-up, retain manual and paused time, and synchronize geometry before showing fresh output on re-entry. Invalidate pending refreshes on visibility loss and disconnect owned visibility observers on cleanup.
