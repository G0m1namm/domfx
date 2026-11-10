import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

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

/** Owns one effect while the component is mounted. Works with React 18 and later. */
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

  // The latest config, read by effects without making it a dependency. Effects run
  // in order, so this updates first. On React 19.2+, useEffectEvent can replace it.
  const latest = useRef({ attach, options, controls, refreshKey });
  useEffect(() => {
    latest.current = { attach, options, controls, refreshKey };
  });

  const report = useCallback((effect: E) => {
    if (live.current?.effect === effect) {
      setState({ effect, lifecycle: effect.lifecycle, reason: effect.reason });
    }
  }, []);

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
      const config = latest.current;
      // Omit<O, 'host'> plus host is O, which TypeScript cannot prove for a generic O.
      current = config.attach(targetElement, { ...config.options, host: hostElement } as O);
      Object.assign(current, config.controls);
      live.current = {
        effect: current,
        written: { ...config.controls },
        refreshKey: config.refreshKey,
      };
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
  }, [host, target, optionsKey, report]);

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
  }, [refreshKey, report]);

  return state;
}
