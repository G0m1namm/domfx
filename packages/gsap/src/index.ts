import { gsap } from 'gsap';

import type { EffectHandle } from '@domfx/core';

export interface FireBindingOptions {
  /** Absolute destination time in seconds. */
  readonly time: number;
  /** Destination intensity, clamped to [0, 1] before interpolation. */
  readonly intensity: number;
  /** Linear interpolation duration in seconds, including zero. */
  readonly duration: number;
  /** GSAP insertion position; omitted appends to the caller's timeline. */
  readonly position?: gsap.Position;
  /** Transfer attachment cleanup to this binding, including context revert. Defaults to false. */
  readonly disposeEffect?: boolean;
}

/** All effects share the same snapshot-binding options. */
export type EffectBindingOptions = FireBindingOptions;

export interface FireBinding {
  /** Remove the owned child and dispose an explicitly owned attachment. Idempotent. */
  dispose(): void;
}

export type EffectBinding = FireBinding;

/** Bind a manual attachment's current controls to a caller-owned GSAP timeline. */
export function bindFire(
  effect: EffectHandle,
  timeline: gsap.core.Timeline,
  options: FireBindingOptions,
): FireBinding {
  if (effect.clock !== 'manual') {
    throw new Error('GSAP binding requires a manual attachment');
  }
  if (effect.lifecycle === 'disposed') {
    throw new Error('GSAP binding requires a live attachment');
  }
  if (
    !Number.isFinite(options.time) ||
    !Number.isFinite(Math.fround(options.time)) ||
    !Number.isFinite(options.intensity) ||
    !Number.isFinite(options.duration) ||
    options.duration < 0
  ) {
    throw new Error('invalid-gsap-binding-options');
  }

  let disposed = false;
  // Setters also run when seek suppresses callbacks. The attachment owns batching;
  // an onUpdate copy would leave controls stale during the default timeline.seek().
  const controls = {
    get time() {
      return effect.time;
    },
    set time(value: number) {
      if (!disposed) {
        effect.time = value;
      }
    },
    get intensity() {
      return effect.intensity;
    },
    set intensity(value: number) {
      if (!disposed) {
        effect.intensity = value;
      }
    },
  };
  const child = gsap.fromTo(
    controls,
    { time: effect.time, intensity: effect.intensity },
    {
      time: options.time,
      intensity: Math.min(1, Math.max(0, options.intensity)),
      duration: options.duration,
      ease: 'none',
      paused: true,
      immediateRender: false,
      lazy: false,
    },
  );
  let unsubscribe: (() => void) | undefined;
  function dispose() {
    if (disposed) {
      return;
    }
    disposed = true;
    unsubscribe?.();
    child.kill();
    if (options.disposeEffect) {
      effect.dispose();
    }
  }

  try {
    unsubscribe = effect.onDispose(dispose);
    timeline.add(child, options.position);
    const position = child.startTime();
    child.paused(false);
    // smoothChildTiming can move an unpaused child to the host's current playhead.
    // Reinsert at the resolved position so binding an advanced host still seeks correctly.
    if (child.startTime() !== position) {
      timeline.add(child, position);
    }
    gsap.context()?.add(() => dispose);
  } catch (error) {
    dispose();
    throw error;
  }

  return { dispose };
}

export interface AsyncFireBinding extends FireBinding {
  /** Settles after binding or late-result cleanup; rejects if attachment or binding setup fails. */
  readonly ready: Promise<void>;
}

export type AsyncEffectBinding = AsyncFireBinding;

/** Own a pending attachment; register context cleanup before its promise settles. */
export function bindFireAsync(
  attachment: Promise<EffectHandle>,
  timeline: gsap.core.Timeline,
  options: FireBindingOptions & { readonly disposeEffect: true },
): AsyncFireBinding {
  if (options.disposeEffect !== true) {
    throw new Error('Async GSAP binding requires explicit attachment ownership');
  }
  let disposed = false;
  let effect: EffectHandle | undefined;
  let binding: FireBinding | undefined;

  function dispose() {
    if (disposed) {
      return;
    }
    disposed = true;
    binding?.dispose();
    effect?.dispose();
  }

  gsap.context()?.add(() => dispose);
  const ready = attachment.then((result) => {
    effect = result;
    if (disposed) {
      result.dispose();
      return;
    }
    try {
      binding = bindFire(result, timeline, { ...options, disposeEffect: false });
    } catch (error) {
      dispose();
      throw error;
    }
  });

  return { ready, dispose };
}

/** Generic name for the compatible, creation-time snapshot binding. */
export const bindEffect = bindFire;

/** Generic name for the owned, cancellable asynchronous snapshot binding. */
export const bindEffectAsync = bindFireAsync;
