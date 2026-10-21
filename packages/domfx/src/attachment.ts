import type { EffectHandle, EffectReason } from '@domfx/core';

import { type captureElementWithReservation, measureCapture } from './browser.js';
import type { BurnedPaperOptions } from './burned-paper-options.js';
import { createCaptureRevisions } from './capture-revision.js';
import { diagnosticsFor } from './diagnostics.js';
import type { DitherOptions } from './dither-options.js';
import { cssEffectError, EffectError, normalizeEffectError } from './effect-error.js';
import type { ElectricityOptions } from './electricity-options.js';
import type { FireOptions } from './fire-options.js';
import type { FrostOptions } from './frost-options.js';
import type { RenderEffect } from './gpu.js';
import type { KineticOptions } from './kinetic-options.js';
import { memoryFor } from './memory.js';
import type { PatternEffect, PatternOptions } from './pattern-options.js';
import {
  assertEffectComposition,
  isPlacementMutation,
  isTargetVisible,
  measureEffectPlacement,
  observeEffectPlacement,
  scaleToViewport,
} from './placement.js';
import type { AttachmentRenderer } from './renderer-service.js';
import { schedulerFor } from './scheduler.js';
import type { SlimeOptions } from './slime-options.js';

const owners = new WeakMap<Document, Set<Element>>();

function finite(value: number, effect: RenderEffect): number {
  if (!Number.isFinite(value) || !Number.isFinite(Math.fround(value))) {
    throw new Error(`invalid-${effect}-parameter`);
  }

  return value;
}

/** Internal adapter seam for controlled lifecycle verification in the lab. */
export interface AttachmentAdapters {
  capture: typeof captureElementWithReservation;
  /** One owned reference; destroy releases it. attachFire supplies a shared service lease. */
  createRenderer: () => Promise<AttachmentRenderer>;
}

export function attachWithAdapters(
  target: Element,
  request:
    | { effect: 'fire'; options: FireOptions }
    | { effect: 'electricity'; options: ElectricityOptions }
    | { effect: 'frost'; options: FrostOptions }
    | { effect: 'kinetic'; options: KineticOptions }
    | { effect: 'slime'; options: SlimeOptions }
    | { effect: 'burned-paper'; options: BurnedPaperOptions }
    | { effect: 'dither'; options: DitherOptions }
    | { effect: PatternEffect; options: PatternOptions },
  adapters: AttachmentAdapters,
  measurePlacement = measureEffectPlacement,
): EffectHandle {
  const { effect, options } = request;
  const document = target?.ownerDocument;
  const view = document?.defaultView;
  if (!view || !(target instanceof view.Element)) {
    throw new Error('invalid-effect-target');
  }
  if (!options || typeof options !== 'object') {
    throw new Error(`invalid-${effect}-options`);
  }
  const clock = options.clock === undefined ? 'manual' : options.clock;
  if (clock !== 'manual' && clock !== 'auto' && clock !== 'ambient') {
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

  const seed = finite(options.seed === undefined ? 0 : options.seed, effect);
  const flameHeight = finite(
    request.effect === 'fire' ? (request.options.flameHeight ?? 24) : 24,
    effect,
  );
  if (flameHeight < 8 || flameHeight > 64) {
    throw new Error(`invalid-${effect}-parameter`);
  }
  const paddingCss = Math.max(32, Math.ceil(flameHeight * 1.25 + 2));
  let time = finite(options.time === undefined ? 0 : options.time, effect);
  let intensity = Math.max(
    0,
    Math.min(1, finite(options.intensity === undefined ? 1 : options.intensity, effect)),
  );

  const motion = view.matchMedia('(prefers-reduced-motion: reduce)');
  const scheduler = schedulerFor(document, view);
  const now = () => view.performance.now();
  const targetStyle = view.getComputedStyle.bind(view, target);

  let paused = clock === 'manual' || motionPolicy === 'static';
  let motionSuspended = false;
  let dirty = false;
  let visibilitySuspended = document.hidden;
  let lastTimestamp: number | undefined;

  let lifecycle: EffectHandle['lifecycle'] = 'suspended';
  let reason: EffectReason | undefined;
  let reasonDetail: string | undefined;

  const memory = memoryFor(document);
  const trace = diagnosticsFor(target, effect);
  let presentedRevision = 0;
  let context: GPUCanvasContext | null = null;
  let retryWork: Promise<void> | undefined;
  let awaitingAssets = true;
  const disposalCallbacks = new Set<() => void>();

  const revisions = createCaptureRevisions({
    trace,
    target,
    memory,
    createRenderer: adapters.createRenderer,
    capture: (reserve, current) => {
      if (!current()) {
        return Promise.resolve(undefined);
      }
      const estimate = measureCapture(target, paddingCss);
      observedSize = targetSize();
      reserve(estimate.width, estimate.height);
      awaitingAssets = true;
      return adapters.capture(target, { paddingCss }, reserve, () => {
        observedSize = targetSize();
        awaitingAssets = false;
      });
    },
    canRun: canCapture,
    present: presentRevision,
    committed: () => {
      if (running()) {
        lastTimestamp = now();
      }
      scheduler.schedule(commit);
    },
    failed: unavailable,
    deviceLost: unavailable,
  });

  let canvas: HTMLCanvasElement | undefined;
  let lastPlacement: Awaited<ReturnType<typeof measureEffectPlacement>> | undefined;
  let placementGeneration = 0;
  let placementWork: Promise<void> | undefined;
  let stopPlacementNotifications: (() => void) | undefined;
  let presenting = false;
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

  const intersectionObserver = new view.IntersectionObserver(visibilityChanged, {
    // Edge adjacency is intersecting with zero area. Also wake when positive
    // area enters, even if isIntersecting stays true across that boundary.
    threshold: [0, Number.EPSILON],
  });
  const observer = new view.MutationObserver(checkMutations);
  const connectionObserver = new view.MutationObserver(checkConnection);
  let observedSize = { width: 0, height: 0 };
  const resizeObserver = new view.ResizeObserver((entries) => {
    if (!checkConnection()) {
      return;
    }
    try {
      const box = entries[0]?.borderBoxSize[0];
      const vertical = targetStyle().writingMode !== 'horizontal-tb';
      let size = targetSize();
      if (box && box.inlineSize > 0 && box.blockSize > 0) {
        size = { width: box.inlineSize, height: box.blockSize };
        if (vertical) {
          size = { width: box.blockSize, height: box.inlineSize };
        }
      }
      // Computed styles serialize fractional local dimensions to finite precision.
      const changed =
        Math.abs(size.width - observedSize.width) > 0.001 ||
        Math.abs(size.height - observedSize.height) > 0.001;
      observedSize = size;
      if (changed) {
        syncVisibility();
        assetChanged();
      }
    } catch (error) {
      unavailable(error);
    }
  });

  function targetSize() {
    const style = targetStyle();
    let width = Number.parseFloat(style.width);
    let height = Number.parseFloat(style.height);
    if (Number.isFinite(width) && Number.isFinite(height)) {
      if (style.boxSizing !== 'border-box') {
        width +=
          Number.parseFloat(style.paddingLeft) +
          Number.parseFloat(style.paddingRight) +
          Number.parseFloat(style.borderLeftWidth) +
          Number.parseFloat(style.borderRightWidth);
        height +=
          Number.parseFloat(style.paddingTop) +
          Number.parseFloat(style.paddingBottom) +
          Number.parseFloat(style.borderTopWidth) +
          Number.parseFloat(style.borderBottomWidth);
      }
      return { width, height };
    }
    const scale = scaleToViewport(target);
    const rect = target.getBoundingClientRect();
    return { width: rect.width / scale.x, height: rect.height / scale.y };
  }

  function checkConnection(records: MutationRecord[] = connectionObserver.takeRecords()) {
    if (lifecycle === 'disposed') {
      return false;
    }
    // Keep removal terminal even when the caller reinserts before delivery.
    // Observe ancestry separately: suspended output does not run frame checks.
    if (
      !target.isConnected ||
      !host.contains(target) ||
      records.some((record) => [...record.removedNodes].some((node) => node.contains(target)))
    ) {
      dispose();
      return false;
    }
    return lifecycle !== 'unavailable';
  }

  function checkMutations(records: MutationRecord[]) {
    if (records.length && !checkComposition()) {
      return;
    }
    if (records.some((record) => !isPlacementMutation(record, target))) {
      observePaint();
    }
  }

  function assetChanged() {
    // Initial/explicit captures establish readiness themselves. Their expected
    // load events must not invalidate the revision waiting for those assets.
    if (revisions.raster !== 'refreshing' || !awaitingAssets) {
      observePaint();
    }
  }

  function observePaint() {
    stale();
    if (
      revisions.raster === 'stale' &&
      lifecycle === 'suspended' &&
      !motionSuspended &&
      !visibilitySuspended &&
      !document.hidden
    ) {
      scheduler.schedule(refreshObserved);
    }
  }

  function refreshObserved() {
    // One capture request for all signals before this frame. refresh owns failure
    // reporting and cleanup; observer work has no caller to receive its rejection.
    if (syncVisibility() && target.isConnected && host.contains(target)) {
      void refresh().catch(() => {});
    }
    return false;
  }

  function stale() {
    if (lifecycle === 'disposed' || lifecycle === 'unavailable' || motionSuspended) {
      return;
    }

    revisions.invalidate(new Error('refresh-invalidated'));
    lifecycle = 'suspended';
    reason = 'stale-raster';
    reasonDetail = undefined;
    if (canvas) {
      canvas.style.display = 'none';
      canvas.style.visibility = 'hidden';
    }
    stopPlacement();
    scheduler.cancel(commit);
    lastTimestamp = undefined;
  }

  function cleanup() {
    stopPlacement();
    scheduler.cancel(commit);
    scheduler.cancel(refreshObserved);
    lastTimestamp = undefined;

    observer.disconnect();
    resizeObserver.disconnect();
    intersectionObserver.disconnect();
    if (lifecycle === 'disposed') {
      connectionObserver.disconnect();
    }
    target.removeEventListener('load', assetChanged, true);
    target.removeEventListener('error', assetChanged, true);
    document.fonts.removeEventListener('loading', assetChanged);
    document.fonts.removeEventListener('loadingdone', assetChanged);
    document.fonts.removeEventListener('loadingerror', assetChanged);
    view?.removeEventListener('resize', observePaint);
    document.removeEventListener('visibilitychange', visibilityChanged);
    motion.removeEventListener('change', suspendForMotion);

    context?.unconfigure();
    context = null;
    if (canvas) {
      canvas.remove();
      canvas.width = 0;
      canvas.height = 0;
      canvas = undefined;
    }
    lastPlacement = undefined;
  }

  function running() {
    return clock !== 'manual' && !paused && lifecycle === 'active';
  }

  function suspend(reasonCode: EffectReason) {
    lifecycle = 'suspended';
    reason = reasonCode;
    reasonDetail = undefined;
    if (canvas) {
      canvas.style.display = 'none';
      canvas.style.visibility = 'hidden';
    }
    stopPlacement();
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

    revisions.stop(new Error('refresh-invalidated'));
    motionSuspended = true;
    suspend('reduced-motion');
    cleanup();
  }

  function syncVisibility() {
    if (!checkConnection() || motionSuspended) {
      return false;
    }
    try {
      visibilitySuspended = document.hidden || !isTargetVisible(target);
    } catch (error) {
      unavailable(error);
      return false;
    }
    if (visibilitySuspended) {
      scheduler.cancel(refreshObserved);
      if (revisions.raster === 'refreshing' || presenting) {
        stale();
      } else if (revisions.raster === 'fresh') {
        suspend('target-not-visible');
      }
      return false;
    }
    return true;
  }

  function visibilityChanged() {
    if (lifecycle === 'disposed' || lifecycle === 'unavailable' || motionSuspended) {
      return;
    }
    if (document.hidden) {
      intersectionObserver.disconnect();
    } else {
      intersectionObserver.observe(target);
    }
    checkMutations(observer.takeRecords());
    if (checkComposition() && syncVisibility() && revisions.raster === 'fresh') {
      // Re-entry must place the retained raster before making it visible. It
      // does not itself change pixels or the caller's manual/paused time.
      scheduler.schedule(commit);
    }
  }

  function invalidate(event?: Event) {
    suspendForMotion();
    checkMutations(observer.takeRecords());
    dirty ||= !event;
    if (document.hidden) {
      syncVisibility();
    }
    if (
      lifecycle === 'disposed' ||
      lifecycle === 'unavailable' ||
      revisions.raster !== 'fresh' ||
      visibilitySuspended
    ) {
      return;
    }
    scheduler.schedule(commit);
  }

  function commit(timestamp: number) {
    if (!checkComposition() || !syncVisibility()) {
      return false;
    }
    if (running() && lastTimestamp !== undefined) {
      time += Math.max(0, timestamp - lastTimestamp) / 1000;
    }
    // Placement follows layout even when the caller owns or pauses time. Reuse
    // the presented pixels unless controls or the ambient clock need new output.
    queuePaint(dirty || running());
    lastTimestamp = running() ? timestamp : undefined;
    return (
      (lifecycle === 'active' && revisions.raster === 'fresh') ||
      (lifecycle === 'suspended' && revisions.raster === 'refreshing' && !visibilitySuspended)
    );
  }

  function unavailable(
    error: unknown,
    fallback: 'capture-failed' | 'renderer-failed' = 'renderer-failed',
  ) {
    if (lifecycle === 'disposed' || lifecycle === 'unavailable' || motionSuspended) {
      return;
    }

    const failure = normalizeEffectError(error, fallback);
    // Preserve the adapter's rejection value, including public CaptureError metadata.
    revisions.stop(error);
    lifecycle = 'unavailable';
    reasonDetail = failure.message;
    reason = failure.code;

    releaseOwnership();
    cleanup();
  }

  function checkComposition() {
    if (!checkConnection() || motionSuspended) {
      return false;
    }
    try {
      if (host.ownerDocument !== document || view?.getComputedStyle(host).position === 'static') {
        throw cssEffectError(
          'unsupported-placement',
          host,
          'position',
          view?.getComputedStyle(host).position ?? 'document-unavailable',
          'Keep the effect host in the target document and use position: relative, absolute, fixed or sticky.',
        );
      }
      assertEffectComposition(target, host);
      return true;
    } catch (error) {
      unavailable(error);
      return false;
    }
  }

  function stopPlacement() {
    placementGeneration += 1;
    stopPlacementNotifications?.();
    stopPlacementNotifications = undefined;
  }

  function observePlacement() {
    if (!stopPlacementNotifications && canvas) {
      stopPlacementNotifications = observeEffectPlacement(target, canvas, () => {
        scheduler.schedule(commit);
      });
    }
  }

  function queuePaint(render = true) {
    dirty ||= render;
    if (placementWork || presenting) {
      return;
    }
    const generation = placementGeneration;
    placementWork = paint(generation)
      .catch((error: unknown) => {
        if (generation === placementGeneration) {
          unavailable(error);
        }
      })
      .finally(() => {
        placementWork = undefined;
      });
  }

  async function paint(generation: number, current = () => true) {
    suspendForMotion();
    // Pending work has no raster to place yet, but must observe invalid CSS too.
    if (revisions.raster === 'refreshing' && !checkComposition()) {
      return;
    }
    checkMutations(observer.takeRecords());
    const frame = revisions.frame;
    const prepared = revisions.prepared;
    const layer = canvas;
    const output = context;
    if (
      lifecycle === 'disposed' ||
      lifecycle === 'unavailable' ||
      revisions.raster !== 'fresh' ||
      !prepared ||
      !frame ||
      !output ||
      !layer ||
      !syncVisibility()
    ) {
      return;
    }

    // Suspended output is made measurable while still hidden, before any library reads.
    if (layer.style.display === 'none') {
      layer.style.visibility = 'hidden';
      layer.style.display = 'block';
    }
    const placement = await measurePlacement(target, host, layer, frame);
    if (
      generation !== placementGeneration ||
      !current() ||
      canvas !== layer ||
      revisions.frame !== frame ||
      revisions.prepared !== prepared ||
      revisions.raster !== 'fresh' ||
      !checkComposition() ||
      !syncVisibility()
    ) {
      return;
    }

    if (
      !lastPlacement ||
      placement.left !== lastPlacement.left ||
      placement.top !== lastPlacement.top ||
      placement.width !== lastPlacement.width ||
      placement.height !== lastPlacement.height ||
      placement.clipPath !== lastPlacement.clipPath
    ) {
      layer.style.left = `${placement.left}px`;
      layer.style.top = `${placement.top}px`;
      layer.style.width = `${placement.width}px`;
      layer.style.height = `${placement.height}px`;
      layer.style.clipPath = placement.clipPath;
      lastPlacement = placement;
    }

    if (dirty) {
      prepared.render(
        motionPolicy === 'static' ? 0 : time,
        seed,
        intensity,
        1 / frame.pixelToLocal.a,
        undefined,
        flameHeight,
        effect,
      );
      prepared.present(output.getCurrentTexture());
      dirty = false;
      if (trace && presentedRevision !== revisions.revision) {
        trace(revisions.revision, 'presentation', 'end');
        presentedRevision = revisions.revision;
      }
    }

    layer.style.visibility = 'visible';
    lifecycle = 'active';
    reason = undefined;
    reasonDetail = undefined;
    observePlacement();
  }

  function canCapture() {
    suspendForMotion();
    if (!checkComposition()) {
      return false;
    }
    checkMutations(observer.takeRecords());
    if (revisions.raster === 'refreshing' && !syncVisibility()) {
      stale();
    }
    return (
      lifecycle !== 'disposed' && lifecycle !== 'unavailable' && revisions.raster === 'refreshing'
    );
  }

  async function presentRevision(
    frame: NonNullable<typeof revisions.frame>,
    renderer: AttachmentRenderer,
    current: () => boolean,
  ) {
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.setAttribute('aria-hidden', 'true');
      canvas.style.cssText =
        'position:absolute;pointer-events:none;display:block;visibility:hidden;';
    }
    presenting = true;
    stopPlacement();
    canvas.style.visibility = 'hidden';
    canvas.style.display = 'block';
    canvas.style.width = `${frame.width * frame.pixelToLocal.a}px`;
    canvas.style.height = `${frame.height * frame.pixelToLocal.d}px`;
    canvas.width = frame.width;
    canvas.height = frame.height;
    context ??= canvas.getContext('webgpu');
    if (!context) {
      throw new EffectError('canvas-webgpu-unavailable');
    }
    context.configure({
      device: renderer.device,
      format: 'rgba8unorm',
      alphaMode: 'premultiplied',
      usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
    });
    host.append(canvas);
    try {
      await placementWork;
      if (current()) {
        dirty = true;
        await paint(placementGeneration, current);
      }
    } finally {
      presenting = false;
    }
  }

  function refresh(): Promise<void> {
    checkConnection();
    if (lifecycle === 'disposed' || lifecycle === 'unavailable') {
      return Promise.reject(new Error(`effect-${lifecycle}`));
    }
    suspendForMotion();
    if (motionSuspended) {
      return Promise.reject(new Error('reduced-motion'));
    }
    if (retryWork) {
      return Promise.reject(new Error('effect-retrying'));
    }
    // Mutations already queued before this explicit request belong to its capture.
    observer.takeRecords();
    scheduler.cancel(refreshObserved);
    awaitingAssets = true;
    suspend('stale-raster');
    const promise = revisions.request();
    scheduler.schedule(commit);
    return promise;
  }

  function dispose() {
    if (lifecycle === 'disposed') {
      return;
    }
    revisions.stop(new Error('effect-disposed'));
    lifecycle = 'disposed';
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
  }

  function observe() {
    for (let ancestor = target.parentNode; ancestor; ancestor = ancestor.parentNode) {
      connectionObserver.observe(ancestor, { childList: true });
    }
    observer.observe(target, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeOldValue: true,
      characterData: true,
    });
    resizeObserver.observe(target, { box: 'border-box' });
    if (!document.hidden) {
      intersectionObserver.observe(target);
    }
    target.addEventListener('load', assetChanged, true);
    target.addEventListener('error', assetChanged, true);
    document.fonts.addEventListener('loading', assetChanged);
    document.fonts.addEventListener('loadingdone', assetChanged);
    document.fonts.addEventListener('loadingerror', assetChanged);
    view?.addEventListener('resize', observePaint);
    document.addEventListener('visibilitychange', visibilityChanged);
    motion.addEventListener('change', suspendForMotion);
  }

  function initialize() {
    observe();
    if (motionPolicy === 'respect' && motion.matches) {
      unavailable(new EffectError('reduced-motion'));
    } else if (checkComposition()) {
      observedSize = targetSize();
      scheduler.schedule(commit);
    }
  }

  function retry(): Promise<void> {
    checkConnection();
    if (lifecycle === 'disposed') {
      return Promise.reject(new Error('effect-disposed'));
    }
    if (retryWork) {
      return retryWork;
    }

    // Pending work retains its resources until the revision owner drains.
    revisions.stop(new Error('refresh-invalidated'));
    if (lifecycle !== 'unavailable') {
      suspend('stale-raster');
    }
    cleanup();
    retryWork = Promise.resolve()
      .then(async () => {
        await revisions.drain();
        cleanup();
        checkConnection();
        if (lifecycle === 'disposed') {
          return;
        }

        motionSuspended = false;
        lifecycle = 'suspended';
        reason = undefined;
        reasonDetail = undefined;
        if (
          !ownsTarget &&
          [...claimed].some((other) => other.contains(target) || target.contains(other))
        ) {
          unavailable(new EffectError('effect-target-owned'));
          return;
        }
        claimed.add(target);
        ownsTarget = true;
        awaitingAssets = true;
        dirty = false;
        const restarted = revisions.restart();
        initialize();
        await restarted;
      })
      .finally(() => {
        retryWork = undefined;
      });
    return retryWork;
  }

  initialize();
  const ready = revisions.start();

  return {
    ready,
    refresh,
    retry,

    get lifecycle() {
      return lifecycle;
    },

    get raster() {
      return revisions.raster;
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
      time = finite(value, effect);
      if (running()) {
        lastTimestamp = now();
      }
      invalidate();
    },

    get intensity() {
      return intensity;
    },

    set intensity(value) {
      intensity = Math.max(0, Math.min(1, finite(value, effect)));
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

    dispose,
  };
}

export function attachFireWithAdapters(
  target: Element,
  options: FireOptions,
  adapters: AttachmentAdapters,
): EffectHandle {
  return attachWithAdapters(target, { effect: 'fire', options }, adapters);
}

export function attachElectricityWithAdapters(
  target: Element,
  options: ElectricityOptions,
  adapters: AttachmentAdapters,
): EffectHandle {
  return attachWithAdapters(target, { effect: 'electricity', options }, adapters);
}

export function attachFrostWithAdapters(
  target: Element,
  options: FrostOptions,
  adapters: AttachmentAdapters,
): EffectHandle {
  return attachWithAdapters(target, { effect: 'frost', options }, adapters);
}

export function attachKineticWithAdapters(
  target: Element,
  options: KineticOptions,
  adapters: AttachmentAdapters,
): EffectHandle {
  return attachWithAdapters(target, { effect: 'kinetic', options }, adapters);
}

export function attachSlimeWithAdapters(
  target: Element,
  options: SlimeOptions,
  adapters: AttachmentAdapters,
): EffectHandle {
  return attachWithAdapters(target, { effect: 'slime', options }, adapters);
}

export function attachBurnedPaperWithAdapters(
  target: Element,
  options: BurnedPaperOptions,
  adapters: AttachmentAdapters,
): EffectHandle {
  return attachWithAdapters(target, { effect: 'burned-paper', options }, adapters);
}

export function attachDitherWithAdapters(
  target: Element,
  options: DitherOptions,
  adapters: AttachmentAdapters,
): EffectHandle {
  return attachWithAdapters(target, { effect: 'dither', options }, adapters);
}

export function attachPatternWithAdapters(
  target: Element,
  effect: PatternEffect,
  options: PatternOptions,
  adapters: AttachmentAdapters,
): EffectHandle {
  return attachWithAdapters(target, { effect, options }, adapters);
}
