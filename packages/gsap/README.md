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
Unavailable, stale and reduced-motion attachments retain the browser package's existing
rendering policy. Attachment disposal immediately detaches all of its bindings; binding
an already disposed attachment throws before creating a tween.
Binding disposal is idempotent and retains the last controls. By default it borrows the
attachment. Set `disposeEffect: true` to transfer attachment cleanup to the binding:
both binding disposal and context revert then dispose the effect. Synchronous validation
failure leaves ownership with the caller. Bindings created inside `gsap.context()`
participate in its normal revert behavior; siblings created outside the context remain
owned by the caller. Context cleanup also unregisters the attachment disposal listener.

For an asynchronous operation that returns an attachment, register cleanup synchronously
with `bindFireAsync()`. This helper requires explicit `disposeEffect: true` ownership so
it can dispose a result arriving after teardown:

```ts
import { bindFireAsync } from '@domfx/gsap';

const context = gsap.context(() => {
  const pending = bindFireAsync(loadAttachment(), timeline, {
    time: 5.5,
    intensity: 0.25,
    duration: 4,
    disposeEffect: true,
  });
  void pending.ready.catch(reportSetupError);
});
context.revert(); // Safe even before loadAttachment() resolves.
```

`loadAttachment()` is caller code returning `Promise<EffectHandle>`. The returned
binding exposes `dispose()` immediately and `ready: Promise<void>` for completion.
It binds when the handle promise resolves; it does not additionally await `effect.ready`.
On revert or disposal, pending setup becomes permanently cancelled. A late result is
disposed without creating a tween, even if the context is reused. Successful async
bindings are removed by the original context's cleanup, retaining their last controls.
Rejected promises propagate through `ready`; binding setup failure also disposes the
owned result. The helper adds no cancellation to the caller's underlying operation.
Use `context.revert()` for cleanup: GSAP's bare `context.kill()` does not run custom
cleanup callbacks.

Run `pnpm demo` and open `/gsap.html` for the built-export consumer and its Play,
Seek, Reverse and separate disposal controls. `pnpm agent:verify` exercises it in
development and production, including real GPU output, scheduler batching, rejection
and cleanup. This is local Vite/Chromium coverage, not a broad bundler/browser guarantee.

MIT licensed; GSAP retains its own license and is not relicensed by this package.
