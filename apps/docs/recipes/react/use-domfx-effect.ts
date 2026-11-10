import { useEffect, useState, type RefObject } from 'react';

import type { EffectHandle } from '@domfx/browser';

/**
 * Owns one effect while the component is mounted. A new `create` function disposes
 * the effect and attaches a fresh one, so memoize it with its creation-only options.
 */
export function useDomfxEffect<E extends EffectHandle>(
  hostRef: RefObject<HTMLElement | null>,
  targetRef: RefObject<HTMLElement | null>,
  create: (target: HTMLElement, host: HTMLElement) => E,
): E | undefined {
  const [effect, setEffect] = useState<E>();

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
      setEffect(undefined);
    };
  }, [hostRef, targetRef, create]);

  return effect;
}
