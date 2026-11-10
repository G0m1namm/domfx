import { useEffect, useRef, useState, type RefObject } from 'react';

import type { EffectHandle } from '@domfx/browser';

/**
 * Owns one effect while the component is mounted. A new `create` function disposes
 * the effect and attaches a fresh one, so memoize it with its creation-only options.
 * `controls` holds writable values, such as intensity, applied to the live effect.
 */
export function useDomfxEffect<E extends EffectHandle>(
  hostRef: RefObject<HTMLElement | null>,
  targetRef: RefObject<HTMLElement | null>,
  create: (target: HTMLElement, host: HTMLElement) => E,
  controls: Partial<E> = {},
): E | undefined {
  const [effect, setEffect] = useState<E>();
  // React treats values returned from hooks as immutable, so writes go through a ref.
  const live = useRef<{ effect: E; written: Partial<E> }>(undefined);

  useEffect(() => {
    const host = hostRef.current;
    const target = targetRef.current;
    if (!host || !target) {
      return;
    }
    let disposed = false;
    let current: E | undefined;

    void document.fonts.ready.then(async () => {
      if (disposed) {
        return;
      }
      current = create(target, host);
      live.current = { effect: current, written: {} };
      setEffect(current);
      await current.ready;
      if (!disposed && current.lifecycle !== 'active') {
        console.info(current.reason);
      }
    });

    // Runs on unmount, before re-creating, and between StrictMode's double mount.
    return () => {
      disposed = true;
      current?.dispose();
      live.current = undefined;
      setEffect(undefined);
    };
  }, [hostRef, targetRef, create]);

  // Runs after every render and writes only changed controls; each write draws a frame.
  useEffect(() => {
    const entry = live.current;
    if (!entry) {
      return;
    }
    for (const key of Object.keys(controls) as (keyof E)[]) {
      if (!Object.is(entry.written[key], controls[key])) {
        Object.assign(entry.effect, { [key]: controls[key] });
        entry.written[key] = controls[key];
      }
    }
  });

  return effect;
}
