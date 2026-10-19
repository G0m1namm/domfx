import type { EffectHandle } from '@domfx/browser';

type Attachment = Pick<
  EffectHandle,
  'ready' | 'lifecycle' | 'reason' | 'reasonDetail' | 'time' | 'intensity' | 'dispose'
>;

type Attach = (
  element: Element,
  options: {
    host: HTMLElement;
    clock: 'manual';
    seed: number;
    time: number;
    intensity: number;
    flameHeight?: number;
  },
) => Attachment;

type Adapters = {
  load?: (
    effect:
      | 'fire'
      | 'electricity'
      | 'frost'
      | 'kinetic'
      | 'slime'
      | 'burned-paper'
      | 'dither'
      | 'halftone'
      | 'stipple'
      | 'scanlines'
      | 'crosshatch'
      | 'diamonds'
      | 'contour-echoes'
      | 'engraving'
      | 'woven-mesh'
      | 'hexagons'
      | 'interference'
      | 'shards'
      | 'circuits'
      | 'star-shimmer'
      | 'brush-fringe',
  ) => Promise<Attach>;
  prepare?: (element: Element) => Promise<unknown>;
};

export type EffectSettings = {
  effect:
    | 'none'
    | 'fire'
    | 'electricity'
    | 'frost'
    | 'kinetic'
    | 'slime'
    | 'burned-paper'
    | 'dither'
    | 'halftone'
    | 'stipple'
    | 'scanlines'
    | 'crosshatch'
    | 'diamonds'
    | 'contour-echoes'
    | 'engraving'
    | 'woven-mesh'
    | 'hexagons'
    | 'interference'
    | 'shards'
    | 'circuits'
    | 'star-shimmer'
    | 'brush-fringe';
  paused: boolean;
  reduced: boolean;
  needsResume: boolean;
  hasGpu: boolean;
  hidden: boolean;
  intensity: number;
  flameHeight: number;
  speed: number;
  loop: boolean;
  rangeStart: number;
  rangeEnd: number;
};

type Target = {
  element: HTMLElement | SVGElement;
  host: HTMLElement | null;
  visible: boolean;
  factor: number;
  revision: number;
  loading: boolean;
  failure: string;
  attachment?: Attachment;
};

async function loadEffect(
  effect:
    | 'fire'
    | 'electricity'
    | 'frost'
    | 'kinetic'
    | 'slime'
    | 'burned-paper'
    | 'dither'
    | 'halftone'
    | 'stipple'
    | 'scanlines'
    | 'crosshatch'
    | 'diamonds'
    | 'contour-echoes'
    | 'engraving'
    | 'woven-mesh'
    | 'hexagons'
    | 'interference'
    | 'shards'
    | 'circuits'
    | 'star-shimmer'
    | 'brush-fringe',
): Promise<Attach> {
  const {
    attachFire,
    attachElectricity,
    attachFrost,
    attachKinetic,
    attachSlime,
    attachBurnedPaper,
    attachDither,
    attachHalftone,
    attachStipple,
    attachScanlines,
    attachCrosshatch,
    attachDiamonds,
    attachContourEchoes,
    attachEngraving,
    attachWovenMesh,
    attachHexagons,
    attachInterference,
    attachShards,
    attachCircuits,
    attachStarShimmer,
    attachBrushFringe,
  } = await import('@domfx/browser');
  return effect === 'fire'
    ? attachFire
    : effect === 'electricity'
      ? attachElectricity
      : effect === 'frost'
        ? attachFrost
        : effect === 'kinetic'
          ? attachKinetic
          : effect === 'slime'
            ? attachSlime
            : effect === 'burned-paper'
              ? attachBurnedPaper
              : effect === 'dither'
                ? attachDither
                : effect === 'halftone'
                  ? attachHalftone
                  : effect === 'stipple'
                    ? attachStipple
                    : effect === 'scanlines'
                      ? attachScanlines
                      : effect === 'crosshatch'
                        ? attachCrosshatch
                        : effect === 'diamonds'
                          ? attachDiamonds
                          : effect === 'contour-echoes'
                            ? attachContourEchoes
                            : effect === 'engraving'
                              ? attachEngraving
                              : effect === 'woven-mesh'
                                ? attachWovenMesh
                                : effect === 'hexagons'
                                  ? attachHexagons
                                  : effect === 'interference'
                                    ? attachInterference
                                    : effect === 'shards'
                                      ? attachShards
                                      : effect === 'circuits'
                                        ? attachCircuits
                                        : effect === 'star-shimmer'
                                          ? attachStarShimmer
                                          : attachBrushFringe;
}

async function prepareTarget(element: Element) {
  const images =
    element instanceof HTMLImageElement ? [element] : [...element.querySelectorAll('img')];
  await Promise.all([document.fonts.ready, ...images.map((image) => image.decode())]);
}

export function createEffectTargetSession() {
  const clock = { time: 0 };
  return (
    elements: readonly (HTMLElement | SVGElement)[],
    initial: EffectSettings,
    onChange: () => void,
    adapters: Adapters = {},
  ) => createEffectTargets(elements, initial, onChange, adapters, clock);
}

function createEffectTargets(
  elements: readonly (HTMLElement | SVGElement)[],
  initial: EffectSettings,
  onChange: () => void,
  adapters: Adapters,
  clock: { time: number },
) {
  const targets: Target[] = elements.map((element) => ({
    element,
    host: element.closest<HTMLElement>('[data-effect-host]'),
    visible: false,
    factor: 1,
    revision: 0,
    loading: false,
    failure: '',
  }));
  const load = adapters.load ?? loadEffect;
  const prepare = adapters.prepare ?? prepareTarget;
  let settings = { ...initial };
  let lastTick = 0;
  let disposed = false;

  function permitted() {
    return (
      settings.effect !== 'none' &&
      settings.hasGpu &&
      !settings.reduced &&
      !settings.needsResume &&
      !settings.hidden &&
      !disposed
    );
  }

  function release(target: Target) {
    target.revision += 1;
    target.attachment?.dispose();
    target.attachment = undefined;
    target.loading = false;
  }

  async function attach(target: Target) {
    const request = ++target.revision;
    target.loading = true;
    try {
      const effect = settings.effect;
      if (effect === 'none') {
        return;
      }
      const [attachEffect] = await Promise.all([load(effect), prepare(target.element)]);
      if (request !== target.revision || !permitted() || !target.visible || !target.host) {
        return;
      }
      const attachment = attachEffect(target.element, {
        host: target.host,
        clock: 'manual',
        seed: 314,
        time: clock.time,
        intensity: settings.intensity * target.factor,
        ...(effect === 'fire' ? { flameHeight: settings.flameHeight } : {}),
      });
      target.attachment = attachment;
      await attachment.ready;
      if (request !== target.revision || disposed) {
        attachment.dispose();
        return;
      }
      if (attachment.lifecycle !== 'active' && attachment.reason !== 'stale-raster') {
        target.failure = attachment.reason ?? attachment.lifecycle;
        console.warn(
          `domfx showcase unavailable on ${target.element.id}: ${target.failure}`,
          attachment.reasonDetail,
        );
        release(target);
      } else {
        attachment.time = clock.time;
        attachment.intensity = settings.intensity * target.factor;
      }
    } catch (error) {
      if (request === target.revision && !disposed) {
        target.failure = 'load or capture failed';
        release(target);
        console.error(`domfx showcase failed on ${target.element.id}:`, error);
      }
    } finally {
      if (request === target.revision && !disposed) {
        target.loading = false;
      }
      if (!disposed) {
        onChange();
      }
    }
  }

  function reconcile() {
    for (const target of targets) {
      if (!permitted() || !target.visible) {
        if (target.attachment || target.loading) {
          release(target);
        }
      } else if (!target.attachment && !target.loading && !target.failure) {
        void attach(target);
      }
    }
  }

  function configure(next: EffectSettings) {
    const replace =
      settings.effect === 'fire' &&
      next.effect === 'fire' &&
      settings.flameHeight !== next.flameHeight;
    const changeEffect = settings.effect !== next.effect;
    const resetTime =
      next.loop &&
      (!settings.loop ||
        settings.rangeStart !== next.rangeStart ||
        settings.rangeEnd !== next.rangeEnd);
    settings = { ...next };
    if (replace || changeEffect) {
      for (const target of targets) {
        release(target);
        target.failure = '';
      }
    }
    if (resetTime) {
      clock.time = settings.rangeStart;
    }
    if (resetTime || !permitted() || settings.paused) {
      lastTick = 0;
    }
    reconcile();
  }

  function retry() {
    for (const target of targets) {
      target.failure = '';
    }
    lastTick = 0;
    reconcile();
  }

  function refreshLayout() {
    for (const target of targets) {
      const rect = target.element.getBoundingClientRect();
      const style = getComputedStyle(target.element);
      const visible =
        rect.width > 0 &&
        rect.height > 0 &&
        rect.bottom > 0 &&
        rect.top < innerHeight &&
        rect.right > 0 &&
        rect.left < innerWidth &&
        style.visibility !== 'hidden';
      if (visible !== target.visible) {
        target.failure = '';
      }
      target.visible = visible;
      target.factor =
        target.element.id === 'scroll-target'
          ? Math.max(
              0,
              Math.min(
                1,
                1 -
                  Math.abs(rect.top + rect.height / 2 - innerHeight / 2) /
                    ((innerHeight + rect.height) / 2),
              ),
            )
          : 1;
    }
    reconcile();
  }

  function tick(now: number) {
    reconcile();
    const active = targets.some((target) => target.attachment?.lifecycle === 'active');
    const running = active && permitted() && !settings.paused;
    if (running && lastTick) {
      clock.time += ((now - lastTick) / 1000) * settings.speed;
      if (settings.loop && clock.time >= settings.rangeEnd) {
        clock.time =
          settings.rangeStart +
          ((clock.time - settings.rangeStart) % (settings.rangeEnd - settings.rangeStart));
      }
    }
    lastTick = running ? now : 0;
    for (const target of targets) {
      const attachment = target.attachment;
      if (!attachment) {
        continue;
      }
      if (attachment.lifecycle === 'active' || attachment.reason === 'stale-raster') {
        attachment.time = clock.time;
        const value = settings.intensity * target.factor;
        if (attachment.intensity !== value) {
          attachment.intensity = value;
        }
      } else if (!target.loading) {
        target.failure = attachment.reason ?? attachment.lifecycle;
        release(target);
      }
    }
    return running;
  }

  function status() {
    return {
      failed: targets.some((target) => target.failure !== ''),
      loading: targets.some((target) => target.loading),
    };
  }

  function dispose() {
    disposed = true;
    for (const target of targets) {
      release(target);
    }
  }

  return { configure, retry, refreshLayout, tick, status, dispose };
}
