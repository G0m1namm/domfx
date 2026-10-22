---
'@domfx/browser': patch
---

Release the SDF executor's offset uniform with its prepared frame, preventing allocation growth across repeated preparations. Bundle the pinned, patched executor so packed consumers receive the same cleanup, and account for its observed 4-byte uniform in the frame ledger.
