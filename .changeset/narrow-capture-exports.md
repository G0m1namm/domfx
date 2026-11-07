---
'@domfx/browser': minor
'@domfx/core': minor
---

Move `captureElement` and `CaptureFrame` to `@domfx/browser/experimental`, which is unstable and can change in any release. `@domfx/core` no longer exports `CaptureFrame` or `classifyAlpha`, and now has no runtime exports. `CaptureError` and `CaptureErrorCode` stay in the main `@domfx/browser` entry.
