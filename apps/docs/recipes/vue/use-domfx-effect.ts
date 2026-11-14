import {
  shallowRef,
  toValue,
  watch,
  watchEffect,
  type MaybeRefOrGetter,
  type ShallowRef,
} from 'vue';

import type { EffectHandle } from '@domfx/browser';

export interface DomfxEffectConfig<
  O extends { readonly host: HTMLElement },
  E extends EffectHandle,
  P extends Omit<O, 'host'>,
> {
  /** Positioned element that holds the effect canvas. */
  host: MaybeRefOrGetter<HTMLElement | null>;
  /** Element the effect captures and decorates. */
  target: MaybeRefOrGetter<HTMLElement | null>;
  /** An attach function, such as attachFire. */
  attach: (target: HTMLElement, options: O) => E;
  /** Creation-only values. A change to a value read here replaces the effect.
   * The Record rejects keys the attach function does not accept. */
  options?: () => P & Record<Exclude<keyof P, keyof O>, never>;
  /** Writable values, such as intensity, applied to the live effect. */
  controls?: () => NoInfer<Partial<E>>;
  /** Values that restyle the host or its ancestors. A change calls refresh(). */
  refreshOn?: MaybeRefOrGetter<unknown>;
}

export interface DomfxEffectState<E extends EffectHandle> {
  effect: Readonly<ShallowRef<E | undefined>>;
  /** Undefined until the effect is ready. */
  lifecycle: Readonly<ShallowRef<E['lifecycle'] | undefined>>;
  /** Why the effect is unavailable or suspended. */
  reason: Readonly<ShallowRef<E['reason']>>;
}

/** Owns one effect while the component is mounted. */
// `const P` keeps literal options such as clock: 'auto' from widening to string.
export function useDomfxEffect<
  O extends { readonly host: HTMLElement },
  E extends EffectHandle,
  const P extends Omit<O, 'host'>,
>({
  host,
  target,
  attach,
  options,
  controls,
  refreshOn,
}: DomfxEffectConfig<O, E, P>): DomfxEffectState<E> {
  const effect = shallowRef<E>();
  const lifecycle = shallowRef<E['lifecycle']>();
  const reason = shallowRef<E['reason']>();

  const report = (current: E) => {
    if (effect.value === current) {
      lifecycle.value = current.lifecycle;
      reason.value = current.reason;
    }
  };

  watchEffect(
    (onCleanup) => {
      const hostElement = toValue(host);
      const targetElement = toValue(target);
      const creation = options?.();
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
        lifecycle.value = undefined;
        reason.value = undefined;
      });

      void document.fonts.ready.then(async () => {
        if (disposed) {
          return;
        }
        // Omit<O, 'host'> plus host is O, which TypeScript cannot prove for a generic O.
        current = attach(targetElement, { ...creation, host: hostElement } as O);
        Object.assign(current, controls?.());
        effect.value = current;
        await current.ready;
        report(current);
      });
    },
    { flush: 'post' },
  );

  // Reruns when a control or the effect changes; each write draws a frame.
  watchEffect(() => {
    if (effect.value) {
      Object.assign(effect.value, controls?.());
    }
  });

  // Target changes refresh automatically; host and ancestor styles do not.
  watch(
    () => toValue(refreshOn),
    () => {
      const current = effect.value;
      if (!current) {
        return;
      }
      // Rejects after disposal or a failed capture; lifecycle and reason report it.
      void current
        .refresh()
        .catch(() => {})
        .then(() => report(current));
    },
    { flush: 'post' },
  );

  return { effect, lifecycle, reason };
}
