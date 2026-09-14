---
'@domfx/browser': patch
---

Retire shared renderers immediately on device loss, invalidate all affected attachments
and pending refreshes, and prevent queued or late GPU preparation from resuming work.
Keep pending reservations until late cleanup finishes without disturbing a replacement
service or unrelated page animation. No automatic device recreation is introduced.
