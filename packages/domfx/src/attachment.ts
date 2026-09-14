import type { CaptureFrame, ClockMode, EffectHandle, EffectReason } from '@domfx/core';

import { captureElementWithReservation, measureCapture } from './browser.js';
import type { PreparedGpuFrame } from './gpu.js';
import { estimateFrameMemory, memoryFor, type AllocationReservation } from './memory.js';
import { isPlacementMutation, measureEffectPlacement, scaleToViewport } from './placement.js';
import { acquireRenderer, type AttachmentRenderer } from './renderer-service.js';
import { schedulerFor } from './scheduler.js';

export interface FireOptions {
  /** Positioned HTML container; target must be a strict descendant. */
  readonly host: HTMLElement;
  /** Defaults to manual for externally owned time. */
  readonly clock?: ClockMode;
  /** Respect reduced motion by default; static always paints at time zero. */
  readonly motion?: 'respect' | 'static';
  readonly seed?: number;
  readonly time?: number;
  readonly intensity?: number;
}

const owners = new WeakMap<Document, Set<Element>>();
// A disposed owner may still be capturing when this target is reattached.
const captures = new WeakMap<Element, Promise<void>>();

function finite(value: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(Math.fround(value))) {
    throw new Error('invalid-fire-parameter');
  }

  return value;
}

// Clear the callback on cleanup so a shared device does not retain disposed targets.
function watchDeviceLoss(device: GPUDevice, callback: (info: GPUDeviceLostInfo) => void) {
  const subscription: { callback?: typeof callback } = { callback };
  void device.lost.then((info) => subscription.callback?.(info));
  return () => {
    subscription.callback = undefined;
  };
}

/** Internal adapter seam for controlled lifecycle verification in the lab. */
export interface AttachmentAdapters {
  capture: typeof captureElementWithReservation;
  /** One owned reference; destroy releases it. attachFire supplies a shared service lease. */
  createRenderer: () => Promise<AttachmentRenderer>;
}

/** Batch control writes and explicitly refresh captured paint. */
export function attachFire(target: Element, options: FireOptions): EffectHandle {
  return attachFireWithAdapters(target, options, {
    capture: captureElementWithReservation,
    createRenderer: () => acquireRenderer(target.ownerDocument),
  });
}

export function attachFireWithAdapters(
  target: Element,
  options: FireOptions,
  adapters: AttachmentAdapters,
): EffectHandle {
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

  const motionPolicy = options.motion === undefined ? 'respect' : options.motion;
  if (motionPolicy !== 'respect' && motionPolicy !== 'static') {
    throw new Error('invalid-motion-policy');
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

  let paused = clock === 'manual' || motionPolicy === 'static';
  let motionSuspended = false;
  let dirty = false;
  let lastTimestamp: number | undefined;

  let lifecycle: EffectHandle['lifecycle'] = 'suspended';
  let raster: EffectHandle['raster'] = 'refreshing';
  let reason: EffectReason | undefined;
  let reasonDetail: string | undefined;

  let service: AttachmentRenderer | undefined;
  let unwatchDeviceLoss: (() => void) | undefined;
  let prepared: PreparedGpuFrame | undefined;
  let retainedMemory: AllocationReservation | undefined;
  const memory = memoryFor(document);
  let frame: CaptureFrame | undefined;
  let context: GPUCanvasContext | null = null;
  let work: Promise<void> | undefined;
  let revision = 1;
  let generation = 0;
  let awaitingAssets = true;
  const refreshes: { resolve: () => void; reject: (error: unknown) => void }[] = [];

  function rejectRefreshes(error: unknown) {
    for (const refresh of refreshes.splice(0)) {
      refresh.reject(error);
    }
  }
  const disposalCallbacks = new Set<() => void>();

  let canvas: HTMLCanvasElement | undefined;
  let lastPlacement: ReturnType<typeof measureEffectPlacement> | undefined;
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

  const observer = new view.MutationObserver(checkMutations);

  function checkMutations(records: MutationRecord[]) {
    if (records.some((record) => !isPlacementMutation(record, target))) {
      stale();
    }
  }

  function assetChanged() {
    // Initial/explicit captures establish readiness themselves. Their expected
    // load events must not invalidate the revision waiting for those assets.
    if (raster === 'fresh' || (raster === 'refreshing' && !awaitingAssets)) {
      stale();
    }
  }

  function stale() {
    if (lifecycle === 'disposed' || lifecycle === 'unavailable' || motionSuspended) {
      return;
    }

    generation += 1;
    rejectRefreshes(new Error('refresh-invalidated'));
    raster = 'stale';
    lifecycle = 'suspended';
    reason = 'stale-raster';
    reasonDetail = undefined;
    if (canvas) {
      canvas.style.display = 'none';
    }
    scheduler.cancel(commit);
    lastTimestamp = undefined;
  }

  function cleanup() {
    scheduler.cancel(commit);
    lastTimestamp = undefined;

    observer.disconnect();
    target.removeEventListener('load', assetChanged, true);
    target.removeEventListener('error', assetChanged, true);
    document.fonts.removeEventListener('loading', assetChanged);
    document.fonts.removeEventListener('loadingdone', assetChanged);
    document.fonts.removeEventListener('loadingerror', assetChanged);
    view?.removeEventListener('resize', stale);
    document.removeEventListener('scroll', invalidate, true);
    document.removeEventListener('visibilitychange', invalidate);
    motion.removeEventListener('change', suspendForMotion);

    context?.unconfigure();
    context = null;
    if (canvas) {
      canvas.remove();
      canvas.width = 0;
      canvas.height = 0;
    }

    prepared?.destroy();
    prepared = undefined;
    retainedMemory?.release();
    retainedMemory = undefined;
    unwatchDeviceLoss?.();
    unwatchDeviceLoss = undefined;

    // Pending preparation owns the device until its late result is released.
    if (!work) {
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
    if (canvas) {
      canvas.style.display = 'none';
    }
    scheduler.cancel(commit);
    lastTimestamp = undefined;
  }

  function suspendForMotion() {
    if (motionPolicy === 'static' || !motion.matches) {
      return;
    }
    if (lifecycle === 'disposed' || lifecycle === 'unavailable' || motionSuspended) {
      return;
    }

    generation += 1;
    rejectRefreshes(new Error('refresh-invalidated'));
    motionSuspended = true;
    raster = 'stale';
    suspend('reduced-motion');
    cleanup();
    frame = undefined;
  }

  function invalidate(event?: Event) {
    suspendForMotion();
    // Preserve immediate stale-output hiding even though rendering is deferred.
    checkMutations(observer.takeRecords());
    if (raster === 'refreshing' && document.hidden) {
      stale();
    }
    if (lifecycle === 'disposed' || lifecycle === 'unavailable' || raster !== 'fresh') {
      return;
    }

    // A hidden document may not receive another frame to hide its output.
    if (document.hidden) {
      suspend('target-not-visible');
      return;
    }

    dirty ||= event?.type !== 'scroll';
    scheduler.schedule(commit);
  }

  function commit(timestamp: number) {
    if (running() && lastTimestamp !== undefined) {
      time += Math.max(0, timestamp - lastTimestamp) / 1000;
    }
    // Placement follows layout even when the caller owns or pauses time. Reuse
    // the presented pixels unless controls or the ambient clock need new output.
    paint(dirty || running());

    dirty = false;
    lastTimestamp = running() ? timestamp : undefined;
    return lifecycle === 'active' && raster === 'fresh';
  }

  function unavailable(error: unknown, fallback: EffectReason = 'renderer-failed') {
    if (lifecycle === 'disposed' || lifecycle === 'unavailable' || motionSuspended) {
      return;
    }

    generation += 1;
    rejectRefreshes(error);
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
      case 'target-budget':
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

  function paint(render = true) {
    suspendForMotion();
    checkMutations(observer.takeRecords());
    if (
      lifecycle === 'disposed' ||
      lifecycle === 'unavailable' ||
      raster !== 'fresh' ||
      !prepared ||
      !frame ||
      !context ||
      !canvas
    ) {
      return;
    }

    if (!target.isConnected || !host.contains(target)) {
      stale();
      return;
    }
    if (document.hidden || target.getClientRects().length === 0) {
      suspend('target-not-visible');
      return;
    }

    try {
      const placement = measureEffectPlacement(target, host, frame);
      if (
        !lastPlacement ||
        placement.left !== lastPlacement.left ||
        placement.top !== lastPlacement.top ||
        placement.width !== lastPlacement.width ||
        placement.height !== lastPlacement.height ||
        placement.clipPath !== lastPlacement.clipPath
      ) {
        canvas.style.left = `${placement.left}px`;
        canvas.style.top = `${placement.top}px`;
        canvas.style.width = `${placement.width}px`;
        canvas.style.height = `${placement.height}px`;
        canvas.style.clipPath = placement.clipPath;
        lastPlacement = placement;
      }
      if (canvas.style.display !== 'block') {
        canvas.style.display = 'block';
      }

      if (render) {
        prepared.render(
          motionPolicy === 'static' ? 0 : time,
          seed,
          intensity,
          1 / frame.pixelToLocal.a,
        );
        prepared.present(context.getCurrentTexture());
      }

      lifecycle = 'active';
      reason = undefined;
      reasonDetail = undefined;
    } catch (error) {
      unavailable(error);
    }
  }

  function current(requestedRevision: number, requestedGeneration: number) {
    suspendForMotion();
    checkMutations(observer.takeRecords());
    if (
      raster === 'refreshing' &&
      (!target.isConnected ||
        !host.contains(target) ||
        document.hidden ||
        target.getClientRects().length === 0)
    ) {
      stale();
    }
    return (
      lifecycle !== 'disposed' &&
      lifecycle !== 'unavailable' &&
      raster === 'refreshing' &&
      revision === requestedRevision &&
      generation === requestedGeneration
    );
  }

  function captureRevision(
    requestedRevision: number,
    requestedGeneration: number,
    reserve: (width: number, height: number) => void,
  ) {
    const previous = captures.get(target) ?? Promise.resolve();
    const captured = previous.then(() => {
      if (!current(requestedRevision, requestedGeneration)) {
        return undefined;
      }
      const estimate = measureCapture(target);
      reserve(estimate.width, estimate.height);
      awaitingAssets = true;
      return adapters.capture(target, {}, reserve, () => {
        awaitingAssets = false;
      });
    });
    const settled = captured
      .then(
        () => {},
        () => {},
      )
      .finally(() => {
        if (captures.get(target) === settled) {
          captures.delete(target);
        }
      });
    captures.set(target, settled);
    return captured;
  }

  async function refreshLoop() {
    try {
      suspendForMotion();
      if (!service && lifecycle !== 'disposed' && lifecycle !== 'unavailable' && !motionSuspended) {
        service = await adapters.createRenderer();
        unwatchDeviceLoss = watchDeviceLoss(service.device, (info) => {
          unavailable(new Error(info.message), 'device-lost');
        });
      }
      while (
        service &&
        raster === 'refreshing' &&
        lifecycle !== 'disposed' &&
        lifecycle !== 'unavailable'
      ) {
        const requestedRevision = revision;
        const requestedGeneration = generation;
        let nextFrame: CaptureFrame | undefined;
        let nextPrepared: PreparedGpuFrame | undefined;
        let reservation: AllocationReservation | undefined;
        const reserve = (width: number, height: number) => {
          const estimate = estimateFrameMemory(width, height);
          if (reservation) {
            reservation.reconcile(estimate);
          } else {
            reservation = memory.reserve(target, estimate);
          }
        };
        let failureReason: EffectReason = 'capture-failed';
        try {
          if (!current(requestedRevision, requestedGeneration)) {
            continue;
          }
          nextFrame = await captureRevision(requestedRevision, requestedGeneration, reserve);
          if (!nextFrame || !current(requestedRevision, requestedGeneration)) {
            continue;
          }
          reserve(nextFrame.width, nextFrame.height);
          if (nextFrame.pixels.byteLength !== nextFrame.width * nextFrame.height * 4) {
            throw new Error('invalid-frame');
          }
          failureReason = 'renderer-failed';
          nextPrepared = await service.prepare(nextFrame);
          if (!current(requestedRevision, requestedGeneration)) {
            continue;
          }

          const actual = estimateFrameMemory(nextPrepared.width, nextPrepared.height);
          if (nextPrepared.width !== nextFrame.width || nextPrepared.height !== nextFrame.height) {
            throw new Error('invalid-frame');
          }
          reservation?.reconcile({ ...actual, managedBytes: nextPrepared.managedBytes });

          // No await between installing and painting the replacement. Keep the
          // previous resources alive until presentation has consumed the new frame.
          if (!canvas) {
            canvas = document.createElement('canvas');
            canvas.setAttribute('aria-hidden', 'true');
            canvas.style.cssText = 'position:absolute;pointer-events:none;display:none;';
          }
          canvas.width = nextFrame.width;
          canvas.height = nextFrame.height;
          context ??= canvas.getContext('webgpu');
          if (!context) {
            throw new Error('canvas-webgpu-unavailable');
          }
          context.configure({
            device: service.device,
            format: 'rgba8unorm',
            alphaMode: 'premultiplied',
            usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
          });
          const previous = prepared;
          const previousMemory = retainedMemory;
          retainedMemory = reservation;
          reservation = undefined;
          prepared = nextPrepared;
          nextPrepared = undefined;
          frame = nextFrame;
          host.append(canvas);
          raster = 'fresh';
          paint();
          previous?.destroy();
          previousMemory?.release();
          if (raster === 'fresh') {
            for (const refresh of refreshes.splice(0)) {
              refresh.resolve();
            }
            if (running()) {
              lastTimestamp = now();
            }
            scheduler.schedule(commit);
          }
        } catch (error) {
          // A superseded failure cannot reject requests for the newer revision.
          if (current(requestedRevision, requestedGeneration)) {
            unavailable(error, failureReason);
          }
        } finally {
          nextPrepared?.destroy();
          nextFrame?.release();
          if (frame && nextFrame === frame && prepared && retainedMemory) {
            retainedMemory.reconcile({
              ...estimateFrameMemory(frame.width, frame.height),
              managedBytes: prepared.managedBytes,
              captureBytes: 0,
            });
          }
          reservation?.release();
        }
      }
    } catch (error) {
      unavailable(error);
    }
  }

  function startRefresh(): Promise<void> {
    // Deferring entry also coalesces requests made in the same task, and installs
    // the work owner before any adapter can complete or fail.
    work ??= Promise.resolve()
      .then(refreshLoop)
      .finally(() => {
        work = undefined;
        if (lifecycle === 'disposed' || lifecycle === 'unavailable' || motionSuspended) {
          cleanup();
          frame = undefined;
        } else if (raster === 'refreshing') {
          // A settlement callback may request another revision before this finally.
          return startRefresh();
        }
      });
    return work;
  }

  function refresh(): Promise<void> {
    if (lifecycle === 'disposed' || lifecycle === 'unavailable') {
      return Promise.reject(new Error(`effect-${lifecycle}`));
    }
    suspendForMotion();
    if (motionSuspended) {
      return Promise.reject(new Error('reduced-motion'));
    }
    // Mutations already queued before this explicit request belong to its capture.
    observer.takeRecords();
    revision += 1;
    raster = 'refreshing';
    suspend('stale-raster');
    const promise = new Promise<void>((resolve, reject) => refreshes.push({ resolve, reject }));
    void startRefresh();
    return promise;
  }

  observer.observe(target, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeOldValue: true,
    characterData: true,
  });
  target.addEventListener('load', assetChanged, true);
  target.addEventListener('error', assetChanged, true);
  document.fonts.addEventListener('loading', assetChanged);
  document.fonts.addEventListener('loadingdone', assetChanged);
  document.fonts.addEventListener('loadingerror', assetChanged);
  view.addEventListener('resize', stale);
  document.addEventListener('scroll', invalidate, true);
  document.addEventListener('visibilitychange', invalidate);
  motion.addEventListener('change', suspendForMotion);

  if (motionPolicy === 'respect' && motion.matches) {
    unavailable(new Error('reduced-motion'));
  }
  const ready = startRefresh();

  return {
    ready,
    refresh,

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
    },

    resume() {
      if (clock === 'manual' || motionPolicy === 'static' || !paused) {
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
      generation += 1;
      rejectRefreshes(new Error('effect-disposed'));
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
