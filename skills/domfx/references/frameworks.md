# React and Vue

Start from the tested [React and Vue recipes](https://domfx.dev/docs/frameworks/)
(Spanish: `https://domfx.dev/docs/es/frameworks/`). Copy the hook or composable into
the app as app-owned code; there is no domfx framework package to install.

- One hook or composable owns one effect. It registers cleanup synchronously, then
  waits for fonts, then attaches only if the component is still mounted.
- Both take one config object: `host`, `target`, `attach` (such as `attachFire`),
  `options` (creation-only plain values; a changed value replaces the effect),
  `controls` (writable values written to the live effect; never recreate for them)
  and `refreshOn` (values that restyle the host; a change calls `refresh()`).
- Both return `lifecycle` and `reason`. Style a fallback from `lifecycle` instead of
  hiding the target; branch on `reason`, never on `reasonDetail`.
- React: requires React 19.2+ (`useEffectEvent`). Options are compared by value, so
  inline objects need no `useCallback`. Do not assign to the returned effect: the
  React Compiler treats hook return values as immutable. StrictMode's double mount
  leaves one effect. Keep `'use client'` on the component for Next.js App Router.
- Vue: pass getters (`() => ({ flameReach })`) so prop changes are tracked.
- Target subtree changes refresh automatically; add host, ancestor or stylesheet
  inputs to `refreshOn`.
- Effects are client-only. With SSR frameworks, attach after mount as the recipes do.
- For GSAP, call the walkthrough's `cleanup()` from the same teardown
  (`useEffect` or `useGSAP` cleanup in React, watcher cleanup or `onBeforeUnmount` in Vue).
