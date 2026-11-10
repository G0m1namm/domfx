import { shallowRef, watchEffect, type Ref, type ShallowRef } from 'vue';

import type { EffectHandle } from '@domfx/browser';

/**
 * Owns one effect while the component is mounted. Reactive values read by `options`
 * are creation-only: a change disposes the effect and attaches a fresh one.
 */
export function useDomfxEffect<O, E extends EffectHandle>(
  host: Readonly<Ref<HTMLElement | null>>,
  target: Readonly<Ref<HTMLElement | null>>,
  options: () => O,
  create: (target: HTMLElement, host: HTMLElement, options: O) => E,
): Readonly<ShallowRef<E | undefined>> {
  const effect = shallowRef<E>();

  watchEffect(
    (onCleanup) => {
      const hostElement = host.value;
      const targetElement = target.value;
      const creation = options();
      if (!hostElement || !targetElement) {
        return;
      }
      let disposed = false;
      let current: E | undefined;

      // Runs on unmount and before re-creating, including while fonts are pending.
      onCleanup(() => {
        disposed = true;
        current?.dispose();
        effect.value = undefined;
      });

      void document.fonts.ready.then(async () => {
        if (disposed) {
          return;
        }
        current = create(targetElement, hostElement, creation);
        effect.value = current;
        await current.ready;
        if (!disposed && current.lifecycle !== 'active') {
          console.info(current.reason);
        }
      });
    },
    { flush: 'post' },
  );

  return effect;
}
