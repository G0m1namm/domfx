# React and Vue

Start from the tested [React and Vue recipes](https://domfx.dev/docs/frameworks/)
(Spanish: `https://domfx.dev/docs/es/frameworks/`). Copy the hook or composable into
the app as app-owned code; there is no domfx framework package to install.

- One hook or composable owns one effect. It registers cleanup synchronously, then
  waits for fonts, then attaches only if the component is still mounted.
- React: memoize `create` with `useCallback` and its creation-only options. StrictMode
  mounts twice in development; the recipe leaves one effect. Do not move attachment
  into render or a ref callback.
- Vue: reactive values read by `options` are creation-only and recreate the effect.
  Keep writable controls out of `options`.
- Pass writable controls (`intensity`, `color`, effect-specific setters) as the hook's
  or composable's `controls` argument; it writes them to the live effect. Never
  recreate the effect for them. In React, do not assign to the returned effect: the
  React Compiler treats hook return values as immutable.
- Await or catch `refresh()` after host, ancestor or stylesheet changes the capture
  does not observe. Target subtree changes refresh automatically.
- Effects are client-only. With SSR frameworks, attach after mount as the recipes do.
- For GSAP, call the walkthrough's `cleanup()` from the same teardown
  (`useEffect` or `useGSAP` cleanup in React, watcher cleanup or `onBeforeUnmount` in Vue).
