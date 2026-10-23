# GSAP ownership

Start from the complete [GSAP walkthrough](https://domfx.dev/docs/gsap/).
Use a manual effect and native `timeline.to(effect, { time, intensity, duration })`
calls for normal sequencing. Only `gsap` and `@domfx/browser` are needed; no plugin
registration, ticker or `onUpdate` copy is required. Time and duration are seconds.
Use `ease: 'none'` for linear effect time. Sequential native tweens read their start
values through normal GSAP behavior, including seeks, reverse and repeat/yoyo.

Register resource cleanup before font/setup waits, as described in the entry skill.
After `ready`, check the disposed flag and effect state before playback. Keep the
original DOM usable while unavailable; avoid hiding the host before setup succeeds.
`immediateRender: false` on the walkthrough's paused fade avoids an early hide.

## Own only your sequence

When the component creates its own timeline, teardown can revert that timeline to
restore its DOM animation state, then dispose its effect. An `effect.onDispose`
listener can stop owned animation immediately; unsubscribe it during cleanup.

When a timeline is borrowed, retain references to the child tweens or nested timeline
you add and kill/revert only those owned animations. Preserve the parent timeline,
its playback state, callbacks and sibling animations. Do not kill, clear or revert
the borrowed timeline or change global GSAP state. Dispose only the effect you own.
Use one writer per effect property; stopping an intensity tween does not stop a
separate time tween or release the effect's resources.

A synchronous `gsap.context()` callback can return resource cleanup, invoked by
`context.revert()`. The context does not automatically capture future promise
continuations. A tween or timeline being killed does not itself dispose an effect.

## Optional snapshot helpers

Read the [binding reference](https://domfx.dev/docs/api/gsap/#snapshot-bindings)
only when fixed starting values or scoped binding cleanup are wanted. Inspect the
installed `@domfx/gsap` declarations before importing `bindEffect`/`bindEffectAsync`
or their compatible Fire-named aliases.

- `bindEffect(effect, timeline, options)` snapshots both controls when created.
  Bindings created together do not inherit earlier segments' destinations. Native
  `.to()` sequences are the default for chained transitions.
- Helpers require manual time and animate private proxy children.
  `gsap.killTweensOf(effect)` and native cross-binding overwrite do not select those
  children. Call `binding.dispose()` to remove the binding and its subscription.
- A binding borrows the effect by default. `disposeEffect: true` explicitly transfers
  effect cleanup to the binding. Binding disposal retains last controls and never
  owns the caller's timeline or its siblings. Effect disposal detaches its bindings.
- `bindEffectAsync(promise, timeline, { ..., disposeEffect: true })` returns immediate
  `dispose()` and `ready: Promise<void>`. Register it synchronously; cancellation
  disposes a late effect instead of creating a tween. Observe rejection from `ready`.
  This helper waits for the supplied effect promise, not additionally for `effect.ready`,
  and does not cancel the underlying async operation.
