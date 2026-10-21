import type { CaptureFrame } from '@domfx/core';

import { attachWithAdapters } from '../../src/attachment.js';
import type { PreparedGpuFrame } from '../../src/gpu.js';
import { memoryFor } from '../../src/memory.js';
import { measureEffectPlacement } from '../../src/placement.js';
import type { AttachmentRenderer } from '../../src/renderer-service.js';

function element(parent: HTMLElement, style: string) {
  const node = document.createElement('div');
  node.style.cssText = style;
  parent.append(node);
  return node;
}

const frame: CaptureFrame = {
  width: 337,
  height: 213,
  pixels: new Uint8Array(337 * 213 * 4),
  contentBounds: { x: 0, y: 0, width: 337, height: 213 },
  padding: { top: 13.25, right: 0, bottom: 0, left: 9.75 },
  pixelToLocal: { a: 0.4, d: 0.5, e: -9.75, f: -13.25 },
  release() {},
};

async function geometry() {
  const stage = element(
    document.body,
    'position:relative;margin:70.625px 80.375px;transform:scale(1.125,.8);transform-origin:13.25px 27.5px;',
  );
  const host = element(
    stage,
    'position:relative;width:540.375px;height:360.625px;border-style:solid;border-width:3.25px 6.5px 7.25px 4.5px;overflow:auto;scrollbar-gutter:stable both-edges;transform:scale(1.2,.9);transform-origin:19.125px 21.25px;',
  );
  const content = element(host, 'position:relative;width:900px;height:700px;');
  const clip = element(
    content,
    'position:relative;left:130.375px;top:100.625px;width:250.375px;height:190.625px;border:2.5px solid;overflow:auto;',
  );
  const clipContent = element(clip, 'position:relative;width:550px;height:400px;');
  const target = element(
    clipContent,
    'position:relative;left:80.25px;top:65.375px;width:120.375px;height:80.625px;transform:translate(9.125px,7.375px) scale(1.3,.7);transform-origin:17.25px 29.5px;',
  );
  const references = [
    element(target, 'position:absolute;left:20.25px;top:16.75px;'),
    element(target, 'position:absolute;left:100.25px;top:66.75px;'),
  ];
  const clipProbe = element(
    clipContent,
    'position:absolute;left:0;top:0;width:550px;height:400px;pointer-events:auto;',
  );
  const layer = element(
    host,
    'position:absolute;left:0;top:0;width:134.8px;height:106.5px;visibility:hidden;pointer-events:none;',
  );
  // Literal raster locations correspond to the two live target-local landmarks.
  const landmarks = [
    element(layer, 'position:absolute;left:22.25519287833828%;top:28.169014084507044%;'),
    element(layer, 'position:absolute;left:81.60237388724036%;top:75.11737089201878%;'),
  ];
  const results: {
    label: string;
    physicalError: number;
    clippingErrors: number;
    placement: Awaited<ReturnType<typeof measureEffectPlacement>>;
  }[] = [];
  async function check(label: string) {
    const placement = await measureEffectPlacement(target, host, layer, frame);
    Object.assign(layer.style, {
      left: `${placement.left}px`,
      top: `${placement.top}px`,
      width: `${placement.width}px`,
      height: `${placement.height}px`,
      clipPath: placement.clipPath,
      visibility: 'visible',
    });
    const errors = references.flatMap((reference, index) => {
      const expected = reference.getBoundingClientRect();
      const actual = landmarks[index].getBoundingClientRect();
      return [Math.abs(expected.left - actual.left), Math.abs(expected.top - actual.top)];
    });
    // Browser hit testing supplies the clip oracle, including its native scrollbar side.
    const bounds = layer.getBoundingClientRect();
    const clipBounds = clip.getBoundingClientRect();
    const xs = [bounds.left + bounds.width / 2];
    const ys = [bounds.top + bounds.height / 2];
    for (const delta of [-1, 0.25, 1, 2, 3, 4, 8]) {
      xs.push(clipBounds.left + delta, clipBounds.right - delta);
      ys.push(clipBounds.top + delta, clipBounds.bottom - delta);
    }
    let clippingErrors = 0;
    for (const x of xs) {
      for (const y of ys) {
        if (x <= bounds.left || x >= bounds.right || y <= bounds.top || y >= bounds.bottom) {
          continue;
        }
        layer.style.pointerEvents = 'none';
        const native = document.elementFromPoint(x, y) === clipProbe;
        layer.style.pointerEvents = 'auto';
        const hit = document.elementFromPoint(x, y);
        const effect = hit === layer || (hit !== null && layer.contains(hit));
        if (native !== effect) {
          clippingErrors += 1;
        }
      }
    }
    layer.style.pointerEvents = 'none';
    results.push({
      label,
      physicalError: Math.max(...errors) * devicePixelRatio,
      clippingErrors,
      placement,
    });
  }
  try {
    await check(
      'fractional content-box borders and positive nonuniform ancestor/host/target scales',
    );
    host.scrollLeft = 55;
    host.scrollTop = 40;
    clip.scrollLeft = 25;
    clip.scrollTop = 19;
    await check('nested host and ancestor scrolling');
    host.style.direction = 'rtl';
    host.scrollLeft = -55;
    await check('RTL physical origin and stable left scrollbar gutter');
    target.style.transform = 'none';
    target.style.scale = '1.3 .7';
    target.style.translate = '9.125px 7.375px';
    await check('individual transform properties and transform origin');
    content.style.marginTop = '20.375px';
    await check('layout shift');
    for (let index = 0; index < 10; index += 1) {
      target.style.translate = `${9.125 + index * 1.375}px ${7.375 - index * 0.625}px`;
      await check(`deterministic transformed movement ${index}`);
    }
    return results;
  } finally {
    stage.remove();
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
}

async function frames(count = 3) {
  for (let index = 0; index < count; index += 1) {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }
}

async function until(condition: () => boolean) {
  for (let index = 0; index < 100; index += 1) {
    if (condition()) {
      return;
    }
    await frames(1);
  }
  throw new Error('placement fixture did not reach the requested state');
}

async function lifecycle(
  scenario:
    | 'initial'
    | 'refresh'
    | 'replacement'
    | 'obsolete-error'
    | 'active-suspend'
    | 'active-retry'
    | 'active-loss',
) {
  const contextDescriptor = Object.getOwnPropertyDescriptor(
    HTMLCanvasElement.prototype,
    'getContext',
  );
  const usageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'GPUTextureUsage');
  Object.defineProperty(globalThis, 'GPUTextureUsage', {
    configurable: true,
    value: { COPY_DST: 2, RENDER_ATTACHMENT: 16 },
  });
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    value: () => ({ configure() {}, unconfigure() {}, getCurrentTexture: () => ({}) }),
  });
  const host = element(
    document.body,
    'position:relative;margin:70.375px 80.125px;width:650.375px;height:400.625px;border:3.25px solid;',
  );
  const target = element(
    host,
    'position:relative;left:140.25px;top:110.375px;width:120.375px;height:80.625px;',
  );
  const reference = element(target, 'position:absolute;left:20.25px;top:16.75px;');
  const gates: ReturnType<typeof deferred<void>>[] = [];
  const deviceLosses: ReturnType<typeof deferred<GPUDeviceLostInfo>>[] = [];
  let captures = 0;
  let renders = 0;
  let presentations = 0;
  let destroyed = 0;
  let preparations = 0;
  let rendererReleases = 0;
  let coordinateCalls = 0;
  let measuredWhileDisplayed = true;
  let hold = true;
  let maximumInFlight = 0;
  let inFlight = 0;
  const errors: unknown[] = [];
  const unhandled = (event: PromiseRejectionEvent) => {
    errors.push(String(event.reason));
  };
  addEventListener('unhandledrejection', unhandled);
  const adapters = {
    async capture(
      _target: Element,
      _options?: unknown,
      _reserve?: unknown,
      assetsReady?: () => void,
    ) {
      captures += 1;
      assetsReady?.();
      return { ...frame, release() {} };
    },
    async createRenderer(): Promise<AttachmentRenderer> {
      const loss = deferred<GPUDeviceLostInfo>();
      deviceLosses.push(loss);
      return {
        device: { lost: loss.promise } as GPUDevice,
        async prepare(): Promise<PreparedGpuFrame> {
          preparations += 1;
          return {
            width: frame.width,
            height: frame.height,
            managedBytes: 100,
            prepareMs: 0,
            readSdf: async () => new Float32Array(),
            readFire: async () => new Uint8Array(),
            render() {
              renders += 1;
            },
            present() {
              presentations += 1;
            },
            destroy() {
              destroyed += 1;
            },
          };
        },
        destroy() {
          rendererReleases += 1;
        },
      };
    },
  };
  const measure: typeof measureEffectPlacement = async (...args) => {
    coordinateCalls += 1;
    measuredWhileDisplayed &&= args[2].style.display === 'block';
    inFlight += 1;
    maximumInFlight = Math.max(maximumInFlight, inFlight);
    try {
      const result = await measureEffectPlacement(...args);
      if (hold) {
        const gate = deferred<void>();
        gates.push(gate);
        await gate.promise;
      }
      return result;
    } finally {
      inFlight -= 1;
    }
  };
  const handles: ReturnType<typeof attachWithAdapters>[] = [];
  const attach = () => {
    const handle = attachWithAdapters(
      target,
      { effect: 'fire', options: { host, clock: 'manual', motion: 'static', time: 2 } },
      adapters,
      measure,
    );
    handles.push(handle);
    return handle;
  };
  try {
    const handle = attach();
    let ready = false;
    const readyWork = handle.ready.then(() => {
      ready = true;
    });
    await until(() => gates.length === 1);
    await frames(6);
    const hiddenWhilePending = host.querySelector('canvas')?.style.visibility === 'hidden';
    const pending = {
      ready,
      presentations,
      coordinateCalls,
      hiddenWhilePending,
      measuredWhileDisplayed,
    };
    hold = false;
    if (scenario === 'refresh') {
      const refresh = handle.refresh();
      target.style.transform = 'translate(23.125px, 9.375px)';
      gates[0].resolve();
      await Promise.all([readyWork, refresh]);
    } else if (scenario === 'replacement' || scenario === 'obsolete-error') {
      handle.dispose();
      const replacement = attach();
      await replacement.ready;
      const replacementLayer = host.querySelector('canvas');
      if (scenario === 'obsolete-error') {
        gates[0].reject(new Error('obsolete coordinate failure'));
      } else {
        gates[0].resolve();
      }
      await readyWork;
      await frames();
      const result = {
        pending,
        maximumInFlight,
        ready,
        captures,
        renders,
        presentations,
        replacementActive: replacement.lifecycle === 'active',
        replacementRetained: host.querySelector('canvas') === replacementLayer,
        layers: host.querySelectorAll('canvas').length,
        errors,
      };
      const callsAtDisposal = coordinateCalls;
      replacement.dispose();
      await frames();
      return {
        ...result,
        coordinatesAfterDispose: coordinateCalls - callsAtDisposal,
        memory: memoryFor(document).bytes,
        destroyed,
        preparations,
        rendererReleases,
      };
    } else {
      gates[0].resolve();
      await readyWork;
    }
    await frames();
    let activePhase:
      | { callsWhilePending: number; hiddenAfterCompletion: boolean; callsWhileSuspended: number }
      | undefined;
    if (
      scenario === 'active-suspend' ||
      scenario === 'active-retry' ||
      scenario === 'active-loss'
    ) {
      hold = true;
      const callsBefore = coordinateCalls;
      target.style.transform = 'translate(13.125px, 4.375px)';
      await until(() => gates.length === 2);
      await frames(5);
      const callsWhilePending = coordinateCalls - callsBefore;
      hold = false;
      let hiddenAfterCompletion = true;
      let callsWhileSuspended = 0;
      if (scenario === 'active-suspend') {
        host.style.top = '2000px';
        await until(() => handle.lifecycle === 'suspended');
        const callsAtSuspension = coordinateCalls;
        gates[1].resolve();
        await frames(5);
        hiddenAfterCompletion = host.querySelector('canvas')?.style.display === 'none';
        callsWhileSuspended = coordinateCalls - callsAtSuspension;
        host.style.top = '0px';
        await until(() => handle.lifecycle === 'active');
      } else if (scenario === 'active-retry') {
        const retried = handle.retry();
        gates[1].resolve();
        await retried;
      } else {
        deviceLosses[0].resolve({
          reason: 'destroyed',
          message: 'controlled loss',
        } as GPUDeviceLostInfo);
        await until(() => handle.lifecycle === 'unavailable');
        gates[1].reject(new Error('obsolete movement after device loss'));
        await frames();
        await handle.retry();
      }
      activePhase = { callsWhilePending, hiddenAfterCompletion, callsWhileSuspended };
    }
    const before = { captures, renders, presentations, time: handle.time };
    target.style.transform = 'translate(31.125px, 18.375px) scale(1.3, .7)';
    await frames(5);
    const layer = host.querySelector('canvas');
    if (!layer) {
      throw new Error('placement layer missing');
    }
    const witness = element(host, layer.style.cssText);
    const landmark = element(
      witness,
      'position:absolute;left:22.25519287833828%;top:28.169014084507044%;',
    );
    const expected = reference.getBoundingClientRect();
    const actual = landmark.getBoundingClientRect();
    const physicalError =
      Math.max(Math.abs(expected.left - actual.left), Math.abs(expected.top - actual.top)) *
      devicePixelRatio;
    witness.remove();
    const result = {
      pending,
      maximumInFlight,
      ready,
      captures,
      renders,
      presentations,
      before,
      time: handle.time,
      activePhase,
      physicalError,
      errors,
    };
    const beforeResize = { captures, renders, presentations };
    target.style.width = '130.375px';
    await until(
      () =>
        captures > beforeResize.captures &&
        handle.raster === 'fresh' &&
        handle.lifecycle === 'active',
    );
    const resized = {
      captures: captures - beforeResize.captures,
      renders: renders - beforeResize.renders,
      presentations: presentations - beforeResize.presentations,
    };
    const callsAtDisposal = coordinateCalls;
    handle.dispose();
    await frames();
    return {
      ...result,
      coordinatesAfterDispose: coordinateCalls - callsAtDisposal,
      resized,
      memory: memoryFor(document).bytes,
      destroyed,
      preparations,
      rendererReleases,
    };
  } finally {
    for (const gate of gates) {
      gate.resolve();
    }
    for (const handle of handles) {
      handle.dispose();
    }
    host.remove();
    removeEventListener('unhandledrejection', unhandled);
    if (contextDescriptor) {
      Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', contextDescriptor);
    }
    if (usageDescriptor) {
      Object.defineProperty(globalThis, 'GPUTextureUsage', usageDescriptor);
    } else {
      Reflect.deleteProperty(globalThis, 'GPUTextureUsage');
    }
  }
}

window.placementFixture = { geometry, lifecycle };

declare global {
  interface Window {
    placementFixture: { geometry: typeof geometry; lifecycle: typeof lifecycle };
  }
}
