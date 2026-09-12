---
"@domfx/gsap": patch
---

Add the private optional GSAP binding for manual attachments. Caller-owned timelines
drive absolute time and intensity through the attachment scheduler, including seek
and reverse. Disposing a binding removes only its owned tween. Ambient clocks reject;
standalone core and browser consumers do not acquire a GSAP dependency.
