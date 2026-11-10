import { shallowRef, toValue, watchEffect, type MaybeRefOrGetter, type ShallowRef } from 'vue';

import type { EffectHandle } from '@domfx/browser';

/**
 * Owns one effect while the component is mounted. Reactive values read by `options`
 * are creation-only: a change disposes the effect and attaches a fresh one.
 * `controls` returns writable values, such as intensity, applied to the live effect.
 */
export function useDomfxEffect<O, E extends EffectHandle>(
  host: MaybeRefOrGetter<HTMLElement | null>,
  target: MaybeRefOrGetter<HTMLElement | null>,
  options: () => O,
  create: (target: HTMLElement, host: HTMLElement, options: O) => E,
  controls: () => Partial<E> = () => ({}),
): Readonly<ShallowRef<E | undefined>> {
  const effect = shallowRef<E>();

  watchEffect(
    (onCleanup) => {
      const hostElement = toValue(host);
      const targetElement = toValue(target);
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

  // Reruns when a control or the effect changes; each write draws a frame.
  watchEffect(() => {
    if (effect.value) {
      Object.assign(effect.value, controls());
    }
  });

  return effect;
}
