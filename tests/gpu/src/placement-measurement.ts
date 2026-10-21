import { attachFire, type EffectHandle } from '@domfx/browser';
import { startEffectDiagnostics } from '@domfx/browser/experimental';

type Workload = 'stationary' | 'scroll' | 'transform';
const handles: EffectHandle[] = [];
const targets: HTMLElement[] = [];
const nativeFrame = window.requestAnimationFrame.bind(window);
const nativeRect = Element.prototype.getBoundingClientRect;
const nextFrame = () => new Promise<number>((resolve) => nativeFrame(resolve));
const hostElement = document.querySelector<HTMLElement>('#host');
const scrollerElement = document.querySelector<HTMLElement>('#scroller');
const contentElement = document.querySelector<HTMLElement>('#content');
if (!hostElement || !scrollerElement || !contentElement) {
  throw new Error('missing measurement fixture');
}
const host = hostElement;
const scroller = scrollerElement;
const content = contentElement;
let effects = false;
let probe: ReturnType<typeof installProbe> | undefined;
let diagnostics: ReturnType<typeof startEffectDiagnostics> | undefined;
let visibilityChanges = 0;
const visibility = () => {
  visibilityChanges += 1;
};
document.addEventListener('visibilitychange', visibility);

function installProbe() {
  const rect = Element.prototype.getBoundingClientRect;
  const style = window.getComputedStyle;
  const request = window.requestAnimationFrame;
  const cancel = window.cancelAnimationFrame;
  const submit = GPUQueue.prototype.submit;
  const pending = new Set<number>();
  let measuring = false;
  let counts = fresh();
  function fresh() {
    return {
      rectReads: { target: 0, host: 0, other: 0 },
      computedStyleReads: 0,
      gpuSubmits: 0,
      callbacks: 0,
      callbackElapsedMs: 0,
      maxPendingFrames: 0,
      callbackNames: {} as Record<string, number>,
    };
  }
  Element.prototype.getBoundingClientRect = function () {
    if (measuring) {
      let category: keyof typeof counts.rectReads = 'other';
      if (targets.includes(this as HTMLElement)) {
        category = 'target';
      } else if (this === host) {
        category = 'host';
      }
      counts.rectReads[category] += 1;
    }
    return rect.call(this);
  };
  window.getComputedStyle = (element, pseudo) => {
    if (measuring) {
      counts.computedStyleReads += 1;
    }
    return style.call(window, element, pseudo);
  };
  GPUQueue.prototype.submit = function (commands) {
    if (measuring) {
      counts.gpuSubmits += 1;
    }
    submit.call(this, commands);
  };
  window.requestAnimationFrame = (callback) => {
    const id = request.call(window, (timestamp) => {
      pending.delete(id);
      if (!measuring) {
        callback(timestamp);
        return;
      }
      counts.callbacks += 1;
      const name = callback.name || '<anonymous>';
      counts.callbackNames[name] = (counts.callbackNames[name] ?? 0) + 1;
      const start = performance.now();
      try {
        callback(timestamp);
      } finally {
        counts.callbackElapsedMs += performance.now() - start;
      }
    });
    pending.add(id);
    if (measuring) {
      counts.maxPendingFrames = Math.max(counts.maxPendingFrames, pending.size);
    }
    return id;
  };
  window.cancelAnimationFrame = (id) => {
    pending.delete(id);
    cancel.call(window, id);
  };
  return {
    begin() {
      counts = fresh();
      measuring = true;
    },
    end() {
      measuring = false;
      return { ...counts, pendingFrames: pending.size };
    },
    restore() {
      Element.prototype.getBoundingClientRect = rect;
      window.getComputedStyle = style;
      GPUQueue.prototype.submit = submit;
      window.requestAnimationFrame = request;
      window.cancelAnimationFrame = cancel;
    },
  };
}

function state() {
  return {
    handles: handles.map((handle) => ({
      lifecycle: handle.lifecycle,
      raster: handle.raster,
      paused: handle.paused,
      time: handle.time,
      reason: handle.reason,
    })),
    visibility: document.visibilityState,
    visibilityChanges,
    reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
    layers: Array.from(host.querySelectorAll('canvas'), (canvas) => ({
      left: canvas.style.left,
      top: canvas.style.top,
      width: canvas.width,
      height: canvas.height,
      hidden: canvas.hidden,
      display: canvas.style.display,
    })),
    targets: targets.map((target) => {
      // Fixture oracles bypass diagnostic wrappers; no extra measured layout reads.
      const { x, y, width, height } = nativeRect.call(target);
      return { x, y, width, height };
    }),
  };
}

function move(workload: Workload, frame: number) {
  const wave = Math.sin(frame / 12);
  const cosineWave = Math.cos(frame / 12);
  if (workload === 'scroll') {
    host.scrollLeft = 12 + wave * 10;
    host.scrollTop = 10 + cosineWave * 8;
    scroller.scrollLeft = 24 + wave * 18;
    scroller.scrollTop = 18 + cosineWave * 12;
  } else if (workload === 'transform') {
    for (const target of targets) {
      target.style.transform = `translate(${6 + wave * 12}px, ${4 + cosineWave * 8}px) scale(${1.1 + wave * 0.05}, ${0.9 + cosineWave * 0.03})`;
    }
  }
}

async function prepare(count: number, enabled: boolean, diagnostic: boolean) {
  if (count !== 1 && count !== 2) {
    throw new Error('expected one or two targets');
  }
  effects = enabled;
  if (diagnostic) {
    probe = installProbe();
    diagnostics = startEffectDiagnostics();
  }
  for (let index = 0; index < count; index += 1) {
    const target = document.createElement('div');
    target.className = 'target';
    target.style.left = `${100.25 + index * 150}px`;
    target.style.transform = 'translate(6px, 4px) scale(1.1, .9)';
    content.append(target);
    targets.push(target);
  }
  await document.fonts.ready;
  const adapter = await navigator.gpu?.requestAdapter();
  const gpu = adapter
    ? {
        vendor: adapter.info.vendor,
        architecture: adapter.info.architecture,
        device: adapter.info.device,
        description: adapter.info.description,
      }
    : null;
  if (effects) {
    for (const target of targets) {
      const handle = attachFire(target, { host, clock: 'manual', time: 2, seed: 7 });
      handles.push(handle);
      await handle.ready;
      handle.pause();
    }
  }
  await nextFrame();
  return {
    state: state(),
    gpu,
    environment: {
      userAgent: navigator.userAgent,
      viewport: { width: innerWidth, height: innerHeight },
      dpr: devicePixelRatio,
    },
    initialCaptureStarts: diagnostics?.records.filter(
      (record) => record.stage === 'capture' && record.phase === 'start',
    ).length,
  };
}

async function sample(workload: Workload, durationMs: number) {
  const before = state();
  const captureStart = diagnostics?.records.length ?? 0;
  const rafMs: number[] = [];
  let frame = 0;
  const start = await nextFrame();
  let previous = start;
  probe?.begin();
  while (previous - start < durationMs) {
    move(workload, frame);
    const now = await nextFrame();
    rafMs.push(now - previous);
    previous = now;
    frame += 1;
  }
  const observation = probe?.end();
  const after = state();
  const captures = diagnostics?.records
    .slice(captureStart)
    .filter((record) => record.stage === 'capture' && record.phase === 'start').length;
  const valid =
    !document.hidden &&
    !after.reducedMotion &&
    before.visibilityChanges === after.visibilityChanges &&
    after.handles.length === (effects ? targets.length : 0) &&
    after.handles.every(
      (handle) =>
        handle.lifecycle === 'active' &&
        handle.raster === 'fresh' &&
        handle.paused &&
        handle.time === 2,
    );
  return {
    durationMs: previous - start,
    frames: frame,
    rafMs,
    before,
    after,
    captures,
    observation,
    valid,
  };
}

async function idle(durationMs: number) {
  probe?.begin();
  const start = performance.now();
  await new Promise<void>((resolve) => setTimeout(resolve, durationMs));
  const duration = performance.now() - start;
  const observation = probe?.end();
  return { durationMs: duration, observation, state: state() };
}

async function dispose() {
  handles.forEach((handle) => handle.dispose());
  await nextFrame();
  return state();
}

async function offscreen() {
  for (const target of targets) {
    target.style.transform = 'translate(2000px, 2000px)';
  }
  await nextFrame();
  await nextFrame();
  return state();
}

function cleanup() {
  handles.forEach((handle) => handle.dispose());
  probe?.restore();
  diagnostics?.dispose();
  document.removeEventListener('visibilitychange', visibility);
  return state();
}

window.domfxPlacementMeasurement = { prepare, sample, idle, offscreen, dispose, cleanup };
declare global {
  interface Window {
    domfxPlacementMeasurement: {
      prepare: typeof prepare;
      sample: typeof sample;
      idle: typeof idle;
      offscreen: typeof offscreen;
      dispose: typeof dispose;
      cleanup: typeof cleanup;
    };
  }
}
