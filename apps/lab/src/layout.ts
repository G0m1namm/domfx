import { attachFire, type EffectHandle } from '@domfx/browser';

const parameters = new URLSearchParams(location.search);
const count = Number(parameters.get('count') ?? 1);
const effects = parameters.get('effects') === 'true';
const handles: EffectHandle[] = [];
const elements: HTMLElement[] = [];
let visibilityChanges = 0;
const visibility = () => {
  visibilityChanges += 1;
};
document.addEventListener('visibilitychange', visibility);
const nextFrame = () => new Promise<number>((resolve) => requestAnimationFrame(resolve));

function state() {
  return {
    active: handles.filter(
      (handle) => handle.lifecycle === 'active' && !handle.paused && handle.raster === 'fresh',
    ).length,
    suspended: handles.filter((handle) => handle.lifecycle === 'suspended').length,
    unavailable: handles
      .filter((handle) => handle.lifecycle === 'unavailable')
      .map((handle) => ({ reason: handle.reason, detail: handle.reasonDetail })),
    times: handles.map((handle) => handle.time),
    visibility: document.visibilityState,
    visibilityChanges,
    reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
  };
}

function geometry() {
  return elements.map((element) => {
    const { x, y, width, height, right, bottom } = element.getBoundingClientRect();
    return {
      x,
      y,
      width,
      height,
      paddedVisible: x >= 32 && y >= 32 && right + 32 <= innerWidth && bottom + 32 <= innerHeight,
    };
  });
}

async function prepare() {
  if (![1, 10, 50].includes(count)) {
    throw new Error('invalid target count');
  }
  const host = document.querySelector<HTMLElement>('#host');
  if (!host) {
    throw new Error('missing host');
  }
  for (let index = 0; index < count; index++) {
    const target = document.createElement('div');
    target.className = 'target';
    host.append(target);
    elements.push(target);
  }
  await document.fonts.ready;
  // Adapter identity only; no second GPU device or measurement renderer is created.
  const adapter = await navigator.gpu?.requestAdapter();
  const gpu = adapter
    ? {
        vendor: adapter.info.vendor,
        architecture: adapter.info.architecture,
        device: adapter.info.device,
        description: adapter.info.description,
      }
    : null;
  const initializationMs: number[] = [];
  if (effects) {
    for (const target of elements) {
      const start = performance.now();
      const handle = attachFire(target, { host, clock: 'ambient', seed: 7, time: 0, intensity: 1 });
      handles.push(handle);
      await handle.ready;
      initializationMs.push(performance.now() - start);
    }
  }
  await nextFrame();
  return {
    count,
    effects,
    gpu,
    initializationMs,
    state: state(),
    geometry: geometry(),
    rasters: Array.from(host.querySelectorAll('canvas'), (canvas) => ({
      width: canvas.width,
      height: canvas.height,
    })),
    environment: {
      userAgent: navigator.userAgent,
      viewport: { width: innerWidth, height: innerHeight },
      dpr: devicePixelRatio,
    },
  };
}

async function sample(durationMs: number, diagnostic = false) {
  const before = state();
  const bounds = geometry();
  const expected = effects ? count : 0;
  const rafMs: number[] = [];
  let minActive = before.active;
  let maxSuspended = before.suspended;
  let valid = bounds.every((rect) => rect.paddedVisible);
  const start = await nextFrame();
  if (diagnostic) {
    performance.mark('domfx-layout-start');
  }
  let previous = start;
  while (previous - start < durationMs) {
    const now = await nextFrame();
    rafMs.push(now - previous);
    previous = now;
    // Lifecycle reads only: no diagnostic geometry reads/style writes inside the trial.
    let active = 0;
    let suspended = 0;
    for (const handle of handles) {
      if (handle.lifecycle === 'active' && !handle.paused && handle.raster === 'fresh') {
        active += 1;
      }
      if (handle.lifecycle === 'suspended') {
        suspended += 1;
      }
    }
    minActive = Math.min(minActive, active);
    maxSuspended = Math.max(maxSuspended, suspended);
    valid &&=
      active === expected &&
      !document.hidden &&
      visibilityChanges === 0 &&
      !matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
  if (diagnostic) {
    performance.mark('domfx-layout-end');
  }
  const after = state();
  valid &&=
    after.times.every((time, index) => time > before.times[index]!) &&
    geometry().every((rect) => rect.paddedVisible);
  return { durationMs: previous - start, rafMs, minActive, maxSuspended, before, after, valid };
}

async function refresh() {
  const durationsMs: number[] = [];
  for (const handle of handles) {
    handle.pause();
  }
  for (const handle of handles) {
    const start = performance.now();
    await handle.refresh();
    durationsMs.push(performance.now() - start);
  }
  return { durationsMs, state: state() };
}

async function cleanup() {
  handles.forEach((handle) => handle.dispose());
  await Promise.all(handles.map((handle) => handle.ready));
  await nextFrame();
  document.removeEventListener('visibilitychange', visibility);
  return {
    disposed: handles.every((handle) => handle.lifecycle === 'disposed'),
    layers: document.querySelectorAll('canvas').length,
  };
}

window.domfxLayout = { prepare, sample, refresh, cleanup };
declare global {
  interface Window {
    domfxLayout: {
      prepare: typeof prepare;
      sample: typeof sample;
      refresh: typeof refresh;
      cleanup: typeof cleanup;
    };
  }
}
