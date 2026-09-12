# @domfx/gsap

Optional, private workspace binding for a manual domfx attachment and a caller-owned
GSAP 3.15 timeline. The package name is provisional; nothing is published to npm.
GSAP is a peer dependency supplied by the consumer. Core and browser imports remain
GSAP-free. This adapter imports only core types and GSAP, with no browser/GPU internals.

```ts
import { gsap } from 'gsap';

import { attachFire } from '@domfx/browser';
import { bindFire } from '@domfx/gsap';

const effect = attachFire(target, { host, clock: 'manual', time: 1.5, intensity: 0.85 });
await effect.ready;
const timeline = gsap.timeline({ paused: true });
const binding = bindFire(effect, timeline, {
  time: 5.5,
  intensity: 0.25,
  duration: 4,
  position: 0,
});

timeline.seek(2); // time = 3.5 seconds, intensity = 0.55; paints on the next frame.
timeline.play();
timeline.reverse();
binding.dispose(); // Removes only the binding's tween, retaining the last controls.
timeline.kill(); // The caller owns the timeline and any other animations in it.
effect.dispose(); // The caller also owns the attachment.
```

`bindFire(effect, timeline, options)` snapshots both starting controls at binding
time and linearly interpolates them to the required `time` and `intensity` over
`duration` seconds. Destination time must be finite and float32-representable;
finite destination intensity clamps to `[0, 1]` before interpolation. Duration
must be finite and nonnegative; zero applies the destination at the insertion point.
`position` accepts GSAP's number/label/relative position syntax and defaults to
appending to the timeline. Ambient attachments, including paused ambient attachments,
throw before any animation is created. Invalid numerical options also throw synchronously.

The binding creates a paused child tween, adds it to the host, and unpauses the child.
The host retains its playback state, callbacks and siblings. Default callback-suppressed
`seek()`, backward seeking, playback and reverse all write the attachment's public
setters. The attachment's existing scheduler batches writes on the next frame and
reuses its raster; the adapter adds no ticker listener, animation-frame loop or capture.
It does not register a plugin or change global GSAP settings.

Use one animation owner for an attachment's controls at a time. Starting values are
fixed when binding; later direct writes do not redefine the animation's start.
Binding before `ready` is supported because initialization reads the latest controls.
Unavailable, stale, reduced-motion and disposed attachments retain the browser
package's existing rendering policy. Dispose the binding when it is no longer needed;
attachment disposal alone does not remove animations from the caller's timeline.
Binding disposal is idempotent and does not restore starting values or dispose the
attachment. Bindings created inside `gsap.context()` participate in its normal revert
behavior; siblings created outside the context remain owned by the caller.

Run `pnpm demo` and open `/gsap.html` for the built-export consumer and its Play,
Seek, Reverse and separate disposal controls. `pnpm agent:verify` exercises it in
development and production, including real GPU output, scheduler batching, rejection
and cleanup. This is local Vite/Chromium coverage, not a broad bundler/browser guarantee.

MIT licensed; GSAP retains its own license and is not relicensed by this package.
