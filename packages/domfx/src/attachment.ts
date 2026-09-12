import type { CaptureFrame, ClockMode, EffectHandle, EffectReason } from '@domfx/core';

import { captureElement } from './browser.js';
import { GpuExperiment, type PreparedGpuFrame } from './gpu.js';
import { measureEffectPlacement, scaleToViewport } from './placement.js';
import { schedulerFor } from './scheduler.js';

export interface FireOptions {
  /** Positioned HTML container; target must be a strict descendant. */
  readonly host: HTMLElement;
  /** Defaults to manual for externally owned time. */
  readonly clock?: ClockMode;
  readonly seed?: number;
  readonly time?: number;
  readonly intensity?: number;
}

const owners = new WeakMap<Document, Set<Element>>();

function finite(value: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(Math.fround(value))) {
    throw new Error('invalid-fire-parameter');
  }

  return value;
}

/** Capture once; batch control writes and optional ambient time through one scheduler. */
export function attachFire(target: Element, options: FireOptions): EffectHandle {
  const document = target?.ownerDocument;
  const view = document?.defaultView;
  if (!view || !(target instanceof view.Element)) {
    throw new Error('invalid-effect-target');
  }
  if (!options || typeof options !== 'object') {
    throw new Error('invalid-fire-options');
  }

  const clock = options.clock === undefined ? 'manual' : options.clock;
  if (clock !== 'manual' && clock !== 'ambient') {
    throw new Error('invalid-clock-mode');
  }

  const { host } = options;
  if (
    !(host instanceof view.HTMLElement) ||
    host.ownerDocument !== document ||
    host === target ||
    !host.contains(target) ||
    !host.isConnected ||
    view.getComputedStyle(host).position === 'static'
  ) {
    throw new Error('invalid-effect-host');
  }

  const claimed = owners.get(document) ?? new Set<Element>();
  if ([...claimed].some((other) => other.contains(target) || target.contains(other))) {
    throw new Error('effect-target-owned');
  }

  const seed = finite(options.seed === undefined ? 0 : options.seed);
  let time = finite(options.time === undefined ? 0 : options.time);
  let intensity = Math.max(
    0,
    Math.min(1, finite(options.intensity === undefined ? 1 : options.intensity)),
  );
  scaleToViewport(target);

  const motion = view.matchMedia('(prefers-reduced-motion: reduce)');
  const scheduler = schedulerFor(document, view);
  const now = () => view.performance.now();

  let paused = clock === 'manual';
  let dirty = false;
  let lastTimestamp: number | undefined;

  let lifecycle: EffectHandle['lifecycle'] = 'suspended';
  let raster: EffectHandle['raster'] = 'refreshing';
  let reason: EffectReason | undefined;
  let reasonDetail: string | undefined;

  let service: GpuExperiment | undefined;
  let prepared: PreparedGpuFrame | undefined;
  let frame: CaptureFrame | undefined;
  let context: GPUCanvasContext | null = null;
  let initializing = true;
  const disposalCallbacks = new Set<() => void>();

  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'position:absolute;pointer-events:none;display:none;';
  claimed.add(target);
  owners.set(document, claimed);

  let ownsTarget = true;

  function releaseOwnership() {
    if (!ownsTarget) {
      return;
    }
    ownsTarget = false;
    claimed.delete(target);
  }

  const observer = new view.MutationObserver(() => stale());

  function stale() {
    if (lifecycle === 'disposed' || lifecycle === 'unavailable') {
      return;
    }

    raster = 'stale';
    lifecycle = 'suspended';
    reason = 'stale-raster';
    reasonDetail = undefined;
    canvas.style.display = 'none';
    scheduler.cancel(commit);
    lastTimestamp = undefined;
  }

  function cleanup() {
    scheduler.cancel(commit);
    lastTimestamp = undefined;

    observer.disconnect();
    target.removeEventListener('load', stale, true);
    view?.removeEventListener('resize', stale);
    document.removeEventListener('scroll', invalidate, true);
    document.removeEventListener('visibilitychange', invalidate);
    motion.removeEventListener('change', invalidate);

    context?.unconfigure();
    context = null;
    canvas.remove();
    canvas.width = 0;
    canvas.height = 0;

    prepared?.destroy();
    prepared = undefined;

    // prepare() may still own a pending shader compilation. Let it settle before
    // destroying its device; initialize's finally releases all late resources.
    if (!initializing) {
      service?.destroy();
      service = undefined;
    }
  }

  function running() {
    return clock === 'ambient' && !paused && lifecycle === 'active';
  }

  function suspend(reasonCode: EffectReason) {
    lifecycle = 'suspended';
    reason = reasonCode;
    reasonDetail = undefined;
    canvas.style.display = 'none';
    scheduler.cancel(commit);
    lastTimestamp = undefined;
  }

  function invalidate() {
    // Preserve immediate stale-output hiding even though rendering is deferred.
    if (observer.takeRecords().length) {
      stale();
    }
    if (lifecycle === 'disposed' || lifecycle === 'unavailable' || raster !== 'fresh') {
      return;
    }

    // A hidden document may not receive another frame to hide its output.
    if (motion.matches || document.hidden) {
      suspend(motion.matches ? 'reduced-motion' : 'target-not-visible');
      return;
    }

    dirty = true;
    scheduler.schedule(commit);
  }

  function commit(timestamp: number) {
    if (running() && lastTimestamp !== undefined) {
      time += Math.max(0, timestamp - lastTimestamp) / 1000;
    }
    if (dirty || running()) {
      paint();
    }

    dirty = false;
    lastTimestamp = running() ? timestamp : undefined;
    return running();
  }

  function unavailable(error: unknown, fallback: EffectReason = 'renderer-failed') {
    if (lifecycle === 'disposed') {
      return;
    }

    lifecycle = 'unavailable';
    raster = 'stale';
    reasonDetail = error instanceof Error ? error.message : String(error);
    switch (reasonDetail) {
      case 'no-webgpu':
      case 'no-adapter':
      case 'capture-budget':
      case 'empty-mask':
      case 'missing-exterior':
      case 'aggregate-budget':
      case 'canvas-webgpu-unavailable':
      case 'unsupported-placement':
      case 'reduced-motion':
        reason = reasonDetail;
        break;
      default:
        reason = fallback;
    }

    releaseOwnership();
    cleanup();
  }

  function paint() {
    if (observer.takeRecords().length) {
      stale();
    }
    if (
      lifecycle === 'disposed' ||
      lifecycle === 'unavailable' ||
      raster !== 'fresh' ||
      !prepared ||
      !frame ||
      !context
    ) {
      return;
    }

    if (!target.isConnected || !host.contains(target)) {
      stale();
      return;
    }
    if (motion.matches || document.hidden || target.getClientRects().length === 0) {
      suspend(motion.matches ? 'reduced-motion' : 'target-not-visible');
      return;
    }

    try {
      const placement = measureEffectPlacement(target, host, frame);
      canvas.style.left = `${placement.left}px`;
      canvas.style.top = `${placement.top}px`;
      canvas.style.width = `${placement.width}px`;
      canvas.style.height = `${placement.height}px`;
      canvas.style.display = 'block';

      prepared.render(time, seed, intensity, 1 / frame.pixelToLocal.a);
      prepared.present(context.getCurrentTexture());

      lifecycle = 'active';
      reason = undefined;
      reasonDetail = undefined;
    } catch (error) {
      unavailable(error);
    }
  }

  function cancelled() {
    return lifecycle === 'disposed' || lifecycle === 'unavailable' || raster === 'stale';
  }

  async function initialize() {
    let failureReason: EffectReason = 'renderer-failed';

    try {
      if (motion.matches) {
        throw new Error('reduced-motion');
      }
      service = await GpuExperiment.create();
      if (cancelled()) {
        return;
      }
      void service.device.lost.then((info) => {
        if (info.reason !== 'destroyed') {
          unavailable(new Error(info.message), 'device-lost');
        }
      });

      failureReason = 'capture-failed';
      frame = await captureElement(target);
      failureReason = 'renderer-failed';
      if (cancelled()) {
        return;
      }

      prepared = await service.prepare(frame);
      if (cancelled()) {
        return;
      }

      canvas.width = frame.width;
      canvas.height = frame.height;
      context = canvas.getContext('webgpu');
      if (!context) {
        throw new Error('canvas-webgpu-unavailable');
      }
      context.configure({
        device: service.device,
        format: 'rgba8unorm',
        alphaMode: 'premultiplied',
        usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
      });

      host.append(canvas);
      raster = 'fresh';
      paint();
      if (running()) {
        lastTimestamp = now();
        scheduler.schedule(commit);
      }
    } catch (error) {
      unavailable(error, failureReason);
    } finally {
      frame?.release();
      initializing = false;
      if (lifecycle !== 'active' && raster !== 'fresh') {
        cleanup();
        frame = undefined;
      }
    }
  }

  observer.observe(target, {
    subtree: true,
    childList: true,
    attributes: true,
    characterData: true,
  });
  target.addEventListener('load', stale, true);
  view.addEventListener('resize', stale);
  document.addEventListener('scroll', invalidate, true);
  document.addEventListener('visibilitychange', invalidate);
  motion.addEventListener('change', invalidate);

  const ready = initialize();

  return {
    ready,

    get lifecycle() {
      return lifecycle;
    },

    get raster() {
      return raster;
    },

    get reason() {
      return reason;
    },

    get reasonDetail() {
      return reasonDetail;
    },

    get seed() {
      return seed;
    },

    get clock() {
      return clock;
    },

    get paused() {
      return paused;
    },

    pause() {
      paused = true;
      lastTimestamp = undefined;
      if (!dirty) {
        scheduler.cancel(commit);
      }
    },

    resume() {
      if (clock === 'manual' || !paused) {
        return;
      }
      paused = false;
      if (running()) {
        lastTimestamp = now();
        scheduler.schedule(commit);
      }
    },

    get time() {
      return time;
    },

    set time(value) {
      time = finite(value);
      if (running()) {
        lastTimestamp = now();
      }
      invalidate();
    },

    get intensity() {
      return intensity;
    },

    set intensity(value) {
      intensity = Math.max(0, Math.min(1, finite(value)));
      invalidate();
    },

    onDispose(callback) {
      if (lifecycle === 'disposed') {
        callback();
      } else {
        disposalCallbacks.add(callback);
      }
      return () => {
        disposalCallbacks.delete(callback);
      };
    },

    dispose() {
      if (lifecycle === 'disposed') {
        return;
      }
      lifecycle = 'disposed';
      raster = 'stale';
      reason = undefined;
      reasonDetail = undefined;
      releaseOwnership();
      cleanup();
      const callbacks = [...disposalCallbacks];
      disposalCallbacks.clear();
      const errors: unknown[] = [];
      for (const callback of callbacks) {
        try {
          callback();
        } catch (error) {
          errors.push(error);
        }
      }
      if (errors.length) {
        throw new AggregateError(errors, 'effect-disposal-callback-failed');
      }
    },
  };
}
