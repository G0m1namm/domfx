import type { CaptureFrame, EffectReason, ManualEffectHandle } from '@domfx/core';

import { captureElement } from './browser.js';
import { GpuExperiment, type PreparedGpuFrame } from './gpu.js';

export interface FireOptions {
  /** Positioned HTML container; target must be a strict descendant. */
  readonly host: HTMLElement;
  readonly seed?: number;
  readonly time?: number;
  readonly intensity?: number;
}

const owners = new WeakMap<Document, Set<Element>>();

function finite(value: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(Math.fround(value)))
    throw new Error('invalid-fire-parameter');
  return value;
}

/** Accumulated positive axis-aligned scale from local CSS pixels to viewport pixels. */
function scaleToViewport(element: Element): { x: number; y: number } {
  const view = element.ownerDocument.defaultView;
  if (!view) throw new Error('document-unavailable');
  let x = 1,
    y = 1;
  for (let node: Element | null = element; node; node = node.parentElement) {
    const style = view.getComputedStyle(node);
    const matrix = new view.DOMMatrixReadOnly(
      style.transform === 'none' ? undefined : style.transform,
    );
    const scale = style.scale === 'none' ? [1] : style.scale.split(/\s+/).map(Number);
    if (
      !matrix.is2D ||
      matrix.b !== 0 ||
      matrix.c !== 0 ||
      matrix.a <= 0 ||
      matrix.d <= 0 ||
      style.perspective !== 'none' ||
      (style.rotate !== 'none' && style.rotate !== '0deg') ||
      scale.length > 2 ||
      scale.some((value) => !Number.isFinite(value) || value <= 0) ||
      (style.zoom !== '1' && style.zoom !== 'normal')
    )
      throw new Error('unsupported-placement');
    x *= matrix.a * scale[0];
    y *= matrix.d * (scale[1] ?? scale[0]);
  }
  return { x, y };
}

/** Capture once and paint on control writes. No clock, recapture or retry loop. */
export function attachFire(target: Element, options: FireOptions): ManualEffectHandle {
  const document = target?.ownerDocument,
    view = document?.defaultView;
  if (!view || !(target instanceof view.Element)) throw new Error('invalid-effect-target');
  if (!options || typeof options !== 'object') throw new Error('invalid-fire-options');
  const { host } = options;
  if (
    !(host instanceof view.HTMLElement) ||
    host.ownerDocument !== document ||
    host === target ||
    !host.contains(target) ||
    !host.isConnected ||
    view.getComputedStyle(host).position === 'static'
  )
    throw new Error('invalid-effect-host');
  const claimed = owners.get(document) ?? new Set<Element>();
  if ([...claimed].some((other) => other.contains(target) || target.contains(other)))
    throw new Error('effect-target-owned');
  const seed = finite(options.seed === undefined ? 0 : options.seed);
  let time = finite(options.time === undefined ? 0 : options.time),
    intensity = Math.max(
      0,
      Math.min(1, finite(options.intensity === undefined ? 1 : options.intensity)),
    );
  scaleToViewport(target);
  const motion = view.matchMedia('(prefers-reduced-motion: reduce)');
  let lifecycle: ManualEffectHandle['lifecycle'] = 'suspended',
    raster: ManualEffectHandle['raster'] = 'refreshing',
    reason: EffectReason | undefined,
    reasonDetail: string | undefined,
    service: GpuExperiment | undefined,
    prepared: PreparedGpuFrame | undefined,
    frame: CaptureFrame | undefined,
    context: GPUCanvasContext | null = null,
    initializing = true;
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'position:absolute;pointer-events:none;display:none;';
  claimed.add(target);
  owners.set(document, claimed);

  let ownsTarget = true;
  function releaseOwnership() {
    if (!ownsTarget) return;
    ownsTarget = false;
    claimed.delete(target);
  }

  const observer = new view.MutationObserver(() => stale());
  function stale() {
    if (lifecycle === 'disposed' || lifecycle === 'unavailable') return;
    raster = 'stale';
    lifecycle = 'suspended';
    reason = 'stale-raster';
    reasonDetail = undefined;
    canvas.style.display = 'none';
  }
  function cleanup() {
    observer.disconnect();
    target.removeEventListener('load', stale, true);
    view?.removeEventListener('resize', stale);
    document.removeEventListener('scroll', paint, true);
    document.removeEventListener('visibilitychange', paint);
    motion.removeEventListener('change', paint);
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
  function unavailable(error: unknown, fallback: EffectReason = 'renderer-failed') {
    if (lifecycle === 'disposed') return;
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
    if (observer.takeRecords().length) stale();
    if (
      lifecycle === 'disposed' ||
      lifecycle === 'unavailable' ||
      raster !== 'fresh' ||
      !prepared ||
      !frame ||
      !context
    )
      return;
    if (!target.isConnected || !host.contains(target)) {
      stale();
      return;
    }
    if (motion.matches || document.hidden || target.getClientRects().length === 0) {
      lifecycle = 'suspended';
      reason = motion.matches ? 'reduced-motion' : 'target-not-visible';
      reasonDetail = undefined;
      canvas.style.display = 'none';
      return;
    }
    try {
      const targetScale = scaleToViewport(target),
        hostScale = scaleToViewport(host);
      const targetRect = target.getBoundingClientRect(),
        hostRect = host.getBoundingClientRect();
      const sx = targetScale.x / hostScale.x,
        sy = targetScale.y / hostScale.y;
      canvas.style.left = `${(targetRect.left - hostRect.left) / hostScale.x - host.clientLeft + host.scrollLeft + frame.pixelToLocal.e * sx}px`;
      canvas.style.top = `${(targetRect.top - hostRect.top) / hostScale.y - host.clientTop + host.scrollTop + frame.pixelToLocal.f * sy}px`;
      canvas.style.width = `${frame.width * frame.pixelToLocal.a * sx}px`;
      canvas.style.height = `${frame.height * frame.pixelToLocal.d * sy}px`;
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
      if (motion.matches) throw new Error('reduced-motion');
      service = await GpuExperiment.create();
      if (cancelled()) return;
      void service.device.lost.then((info) => {
        if (info.reason !== 'destroyed') unavailable(new Error(info.message), 'device-lost');
      });
      failureReason = 'capture-failed';
      frame = await captureElement(target);
      failureReason = 'renderer-failed';
      if (cancelled()) return;
      prepared = await service.prepare(frame);
      if (cancelled()) return;
      canvas.width = frame.width;
      canvas.height = frame.height;
      context = canvas.getContext('webgpu');
      if (!context) throw new Error('canvas-webgpu-unavailable');
      context.configure({
        device: service.device,
        format: 'rgba8unorm',
        alphaMode: 'premultiplied',
        usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
      });
      host.append(canvas);
      raster = 'fresh';
      paint();
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
  document.addEventListener('scroll', paint, true);
  document.addEventListener('visibilitychange', paint);
  motion.addEventListener('change', paint);
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
    get time() {
      return time;
    },
    set time(value) {
      time = finite(value);
      paint();
    },
    get intensity() {
      return intensity;
    },
    set intensity(value) {
      intensity = Math.max(0, Math.min(1, finite(value)));
      paint();
    },
    dispose() {
      if (lifecycle === 'disposed') return;
      lifecycle = 'disposed';
      raster = 'stale';
      reason = undefined;
      reasonDetail = undefined;
      releaseOwnership();
      cleanup();
    },
  };
}
