import type * as BrowserEffects from '@domfx/browser';
import type {
  BurnedPaperEffectHandle,
  ColorAttachmentOptions,
  ColorEffectHandle,
  EffectHandle,
  EffectReason,
  FrostEffectHandle,
} from '@domfx/browser';

import type { EffectOptionName, EffectWritableField } from './effect-extent.js';
import type { Effect } from './effects.js';

export interface EffectStatus {
  lifecycle: 'initializing' | 'active' | 'suspended' | 'unavailable';
  reason?: EffectReason;
}

export interface EffectEnvironment {
  blockedReason(): EffectReason | undefined;
  onChange(callback: () => void): () => void;
}

/** Browser policy; the caller owns its Resume latch and notifies changes with update(). */
export function createEffectEnvironment({
  document,
  reducedMotion,
  needsResume = () => false,
}: {
  document: Document;
  reducedMotion: MediaQueryList;
  needsResume?: () => boolean;
}) {
  const navigator = document.defaultView?.navigator;
  const hasGpu = Boolean(navigator && 'gpu' in navigator && navigator.gpu);
  const listeners = new Set<() => void>();

  return {
    blockedReason(): EffectReason | undefined {
      if (!hasGpu) {
        return 'no-webgpu';
      }
      if (reducedMotion.matches || needsResume()) {
        return 'reduced-motion';
      }
      return document.hidden ? 'target-not-visible' : undefined;
    },
    onChange(callback: () => void) {
      listeners.add(callback);
      document.addEventListener('visibilitychange', callback);
      reducedMotion.addEventListener('change', callback);
      return () => {
        listeners.delete(callback);
        document.removeEventListener('visibilitychange', callback);
        reducedMotion.removeEventListener('change', callback);
      };
    },
    update() {
      for (const listener of listeners) {
        listener();
      }
    },
  } satisfies EffectEnvironment & { update(): void };
}

type WithoutHost<T> = T extends unknown ? Omit<T, 'host'> : never;
// Site-only controls; the loader forwards only the selected effect's owned fields.
type CreationOptions = ColorAttachmentOptions & Partial<Record<EffectOptionName, number>>;
type EffectOptions = WithoutHost<CreationOptions>;
type EffectFactory = (target: Element, options: CreationOptions) => EffectHandle;
type EffectLoader = (effect: Effect) => Promise<EffectFactory>;

interface SlotOptions {
  host: HTMLElement;
  environment: EffectEnvironment;
  loader?: EffectLoader;
  onChange?: (status: EffectStatus) => void;
}

let browserModule: Promise<typeof BrowserEffects> | undefined;
async function loadEffect(effect: Effect): Promise<EffectFactory> {
  browserModule ??= import('@domfx/browser');
  const api = await browserModule;
  return (target, options) => {
    const {
      flameReach,
      emberDensity,
      coatingDepth,
      mistReach,
      mistOpacity,
      dripReach,
      dripDensity,
      scorchDepth,
      ashReach,
      emberGlow,
      contourSpread,
      fragmentTravel,
      plumeReach,
      bandDepth,
      echoReach,
      fringeReach,
      color,
      ...shared
    } = options;
    switch (effect.exportName) {
      case 'attachFire':
        return api.attachFire(target, { ...shared, color, flameReach, emberDensity });
      case 'attachFrost':
        return api.attachFrost(target, { ...shared, color, coatingDepth, mistReach, mistOpacity });
      case 'attachSlime':
        return api.attachSlime(target, { ...shared, color, coatingDepth, dripReach, dripDensity });
      case 'attachBurnedPaper':
        return api.attachBurnedPaper(target, { ...shared, scorchDepth, ashReach, emberGlow });
      case 'attachHalftone':
        return api.attachHalftone(target, { ...shared, color, plumeReach, bandDepth });
      case 'attachElectricity':
        return api.attachElectricity(target, { ...shared, color, contourSpread });
      case 'attachKinetic':
        return api.attachKinetic(target, { ...shared, color, fragmentTravel });
      case 'attachContourEchoes':
        return api.attachContourEchoes(target, { ...shared, color, echoReach });
      case 'attachBrushFringe':
        return api.attachBrushFringe(target, { ...shared, color, fringeReach });
      default:
        return api[effect.exportName](target, { ...shared, color, plumeReach, bandDepth });
    }
  };
}

/** Narrows the selected effect's public handle before a preview writes its own control. */
export function setEffectWritableControl(
  effect: Effect,
  handle: EffectHandle,
  field: EffectWritableField,
  value: number,
) {
  switch (effect.id) {
    case 'frost':
      if (field.name === 'mistOpacity') {
        if (!isFrostEffectHandle(handle)) {
          throw new Error('Frost handle is missing mistOpacity');
        }
        handle.mistOpacity = value;
      }
      return;
    case 'burned-paper':
      if (field.name === 'emberGlow') {
        if (!isBurnedPaperEffectHandle(handle)) {
          throw new Error('Burned paper handle is missing emberGlow');
        }
        handle.emberGlow = value;
      }
      return;
    default:
      throw new Error(`No writable control ${field.name} on ${effect.id}`);
  }
}

function isFrostEffectHandle(handle: EffectHandle): handle is FrostEffectHandle {
  return 'mistOpacity' in handle;
}

function isBurnedPaperEffectHandle(handle: EffectHandle): handle is BurnedPaperEffectHandle {
  return 'emberGlow' in handle;
}

/** Applies the optional shared decorative color without replacing the current effect. */
export function setEffectColor(effect: Effect, handle: EffectHandle, color: string | undefined) {
  if (effect.id === 'burned-paper') {
    throw new Error('Burned paper does not support color');
  }
  if (!isColorEffectHandle(handle)) {
    throw new Error(`${effect.name} handle is missing color`);
  }
  handle.color = color;
}

function isColorEffectHandle(handle: EffectHandle): handle is ColorEffectHandle {
  return 'color' in handle;
}

async function prepareTarget(target: Element) {
  const images = Array.from(target.querySelectorAll('img'));
  if (target.tagName === 'IMG') {
    images.push(target as HTMLImageElement);
  }
  await Promise.all([target.ownerDocument.fonts.ready, ...images.map((image) => image.decode())]);
}

function blockedStatus(reason: EffectReason): EffectStatus {
  return {
    lifecycle: reason === 'target-not-visible' ? 'suspended' : 'unavailable',
    reason,
  };
}

/** Owns one host's pending and ready effect, including obsolete async work. */
export function createEffectSlot({
  host,
  environment,
  loader = loadEffect,
  onChange,
}: SlotOptions) {
  let revision = 0;
  let disposed = false;
  let pending: EffectHandle | undefined;
  let handle: EffectHandle | undefined;
  let status: EffectStatus = { lifecycle: 'suspended' };
  let blockedReason = environment.blockedReason();
  let requested: { target: Element; effect: Effect; options: () => EffectOptions } | undefined;

  function publish(next: EffectStatus) {
    status = next;
    host.dataset.status = next.lifecycle;
    if (next.reason) {
      host.dataset.reason = next.reason;
    } else {
      delete host.dataset.reason;
    }
    onChange?.(next);
  }

  function release() {
    revision += 1;
    const previous = pending ?? handle;
    pending = undefined;
    handle = undefined;
    previous?.dispose();
  }

  async function attach() {
    if (disposed || !requested) {
      return;
    }
    release();
    blockedReason = environment.blockedReason();
    if (blockedReason) {
      publish(blockedStatus(blockedReason));
      return;
    }
    const { target, effect, options } = requested;
    const request = revision;

    function isCurrent() {
      if (disposed || request !== revision) {
        return false;
      }
      const reason = environment.blockedReason();
      if (reason || !target.isConnected) {
        blockedReason = reason;
        release();
        publish(blockedStatus(reason ?? 'target-not-visible'));
        return false;
      }
      return true;
    }

    publish({ lifecycle: 'initializing' });
    try {
      const [factory] = await Promise.all([loader(effect), prepareTarget(target)]);
      if (!isCurrent()) {
        return;
      }
      const settings = options();
      if (!isCurrent()) {
        return;
      }
      const next = factory(target, { ...settings, host });
      if (!isCurrent()) {
        next.dispose();
        return;
      }
      pending = next;
      await next.ready;
      if (!isCurrent()) {
        next.dispose();
        return;
      }
      pending = undefined;
      handle = next;
      publish({
        lifecycle: next.lifecycle === 'disposed' ? 'suspended' : next.lifecycle,
        reason: next.reason,
      });
    } catch {
      if (!disposed && request === revision) {
        release();
        publish({ lifecycle: 'unavailable' });
      }
    }
  }

  function show(target: Element, effect: Effect, options: () => EffectOptions) {
    if (disposed) {
      return Promise.resolve();
    }
    requested = { target, effect, options };
    return attach();
  }

  function clear() {
    requested = undefined;
    release();
    publish({ lifecycle: 'suspended' });
  }

  const unsubscribe = environment.onChange(() => {
    if (environment.blockedReason() !== blockedReason) {
      void attach();
    }
  });

  return {
    show,
    clear,
    get handle() {
      return handle;
    },
    get status() {
      return status;
    },
    dispose() {
      if (disposed) {
        return;
      }
      disposed = true;
      unsubscribe();
      clear();
    },
  };
}

export type EffectSlot = ReturnType<typeof createEffectSlot>;
