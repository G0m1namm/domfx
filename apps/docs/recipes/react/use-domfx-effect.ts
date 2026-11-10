import { useEffect, useEffectEvent, useRef, useState, type RefObject } from 'react';

import type { EffectHandle } from '@domfx/browser';

export interface DomfxEffectConfig<
  O extends { readonly host: HTMLElement },
  E extends EffectHandle,
> {
  /** Positioned element that holds the effect canvas. */
  host: RefObject<HTMLElement | null>;
  /** Element the effect captures and decorates. */
  target: RefObject<HTMLElement | null>;
  /** An attach function, such as attachFire. */
  attach: (target: HTMLElement, options: O) => E;
  /** Creation-only plain values. A changed value replaces the effect. */
  options?: NoInfer<Omit<O, 'host'>>;
  /** Writable values, such as intensity, applied to the live effect. */
  controls?: NoInfer<Partial<E>>;
  /** Values that restyle the host or its ancestors. A change calls refresh(). */
  refreshOn?: readonly unknown[];
}

export interface DomfxEffectState<E extends EffectHandle> {
  effect: E | undefined;
  /** Undefined until the effect is ready. */
  lifecycle: E['lifecycle'] | undefined;
  /** Why the effect is unavailable or suspended. */
  reason: E['reason'];
}

const idle = { effect: undefined, lifecycle: undefined, reason: undefined };

/** Owns one effect while the component is mounted. Requires React 19.2 or later. */
export function useDomfxEffect<O extends { readonly host: HTMLElement }, E extends EffectHandle>({
  host,
  target,
  attach,
  options,
  controls = {},
  refreshOn = [],
}: DomfxEffectConfig<O, E>): DomfxEffectState<E> {
  const [state, setState] = useState<DomfxEffectState<E>>(idle);
  // React treats values returned from hooks as immutable, so writes go through a ref.
  const live = useRef<{ effect: E; written: Partial<E>; refreshKey: string }>(undefined);
  // Creation options and refresh values are plain data, so a string detects changes.
  const optionsKey = JSON.stringify(options ?? {});
  const refreshKey = JSON.stringify(refreshOn);

  // Effect events read the latest props without making them effect dependencies.
  const report = useEffectEvent((effect: E) => {
    if (live.current?.effect === effect) {
      setState({ effect, lifecycle: effect.lifecycle, reason: effect.reason });
    }
  });

  const create = useEffectEvent((targetElement: HTMLElement, hostElement: HTMLElement) => {
    // Omit<O, 'host'> plus host is O, which TypeScript cannot prove for a generic O.
    const effect = attach(targetElement, { ...options, host: hostElement } as O);
    Object.assign(effect, controls);
    live.current = { effect, written: { ...controls }, refreshKey };
    return effect;
  });

  useEffect(() => {
    const hostElement = host.current;
    const targetElement = target.current;
    if (!hostElement || !targetElement) {
      return;
    }
    let disposed = false;
    let current: E | undefined;

    void document.fonts.ready.then(async () => {
      if (disposed) {
        return;
      }
      current = create(targetElement, hostElement);
      setState({ ...idle, effect: current });
      await current.ready;
      report(current);
    });

    // Runs on unmount, before re-creating, and between StrictMode's double mount.
    return () => {
      disposed = true;
      current?.dispose();
      live.current = undefined;
      setState(idle);
    };
  }, [host, target, optionsKey]);

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

  // Target changes refresh automatically; host and ancestor styles do not.
  useEffect(() => {
    const entry = live.current;
    if (!entry || entry.refreshKey === refreshKey) {
      return;
    }
    entry.refreshKey = refreshKey;
    // Rejects after disposal or a failed capture; lifecycle and reason report it.
    void entry.effect
      .refresh()
      .catch(() => {})
      .then(() => report(entry.effect));
  }, [refreshKey]);

  return state;
}
