import { attachFire, type EffectHandle } from '@domfx/browser';
import { GpuExperiment } from '@domfx/browser/experimental';
import { classifyAlpha } from '@domfx/core';

import { signedDistanceOracle } from './diagnostics/distance-oracle.js';

function deferred() {
  let resolve = () => {};
  const promise = new Promise<void>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

function check(condition: boolean, name: string) {
  if (!condition) {
    throw new Error(`shared service: ${name}`);
  }
}

function targets(sharedHost: boolean) {
  const container = document.createElement('div');
  container.style.cssText = 'display:flex;gap:80px;padding:50px';
  const firstHost = document.createElement('div');
  firstHost.style.cssText = 'position:relative;width:240px;height:100px';
  const secondHost = sharedHost ? firstHost : firstHost.cloneNode();
  if (!(secondHost instanceof HTMLElement)) {
    throw new Error('fixture host');
  }
  const ring = document.createElement('div');
  ring.style.cssText =
    'position:absolute;left:10px;top:12px;width:40px;height:32px;border:4px solid white;box-sizing:border-box';
  const islands = document.createElement('div');
  islands.style.cssText = 'position:absolute;left:120px;top:30px;width:60px;height:24px';
  for (const left of [0, 40]) {
    const island = document.createElement('div');
    island.style.cssText = `position:absolute;left:${left}px;width:20px;height:24px;background:white`;
    islands.append(island);
  }
  firstHost.append(ring);
  secondHost.append(islands);
  container.append(firstHost);
  if (!sharedHost) {
    container.append(secondHost);
  }
  document.body.append(container);
  return { container, hosts: [firstHost, secondHost], elements: [ring, islands] };
}

/** Observe real service creation and buffer cleanup without substituting GPU results. */
function observeServices() {
  const create = GpuExperiment.create;
  const services: GpuExperiment[] = [];
  const buffers = new Map<GPUBuffer, number>();
  let requests = 0;
  let destroys = 0;
  let firePipelines = 0;
  let scopes = 0;
  let maxScopes = 0;
  const createPipeline = GPUDevice.prototype.createRenderPipeline;
  GPUDevice.prototype.createRenderPipeline = function (descriptor) {
    firePipelines += 1;
    return createPipeline.call(this, descriptor);
  };
  GpuExperiment.create = async (gpu) => {
    requests += 1;
    const service = await create(gpu);
    services.push(service);
    const pushScope = service.device.pushErrorScope.bind(service.device);
    const popScope = service.device.popErrorScope.bind(service.device);
    service.device.pushErrorScope = (filter) => {
      scopes += 1;
      maxScopes = Math.max(maxScopes, scopes);
      pushScope(filter);
    };
    service.device.popErrorScope = () => {
      scopes -= 1;
      return popScope();
    };
    const createBuffer = service.device.createBuffer.bind(service.device);
    service.device.createBuffer = (descriptor) => {
      const buffer = createBuffer(descriptor);
      buffers.set(buffer, buffer.size);
      const destroy = buffer.destroy.bind(buffer);
      buffer.destroy = () => {
        buffers.delete(buffer);
        destroy();
      };
      return buffer;
    };
    const destroy = service.destroy.bind(service);
    service.destroy = () => {
      destroys += 1;
      destroy();
    };
    return service;
  };
  return {
    services,
    get requests() {
      return requests;
    },
    get destroys() {
      return destroys;
    },
    get firePipelines() {
      return firePipelines;
    },
    get scopes() {
      return { open: scopes, max: maxScopes };
    },
    allocation() {
      return {
        managedBytes: services.reduce((sum, service) => sum + service.managedBytes, 0),
        bufferBytes: [...buffers.values()].reduce((sum, bytes) => sum + bytes, 0),
      };
    },
    restore() {
      GpuExperiment.create = create;
      GPUDevice.prototype.createRenderPipeline = createPipeline;
    },
  };
}

export async function verifySharedTargets(sharedHost: boolean, disposedIndex: number) {
  const fixture = targets(sharedHost);
  const observation = observeServices();
  const effects: EffectHandle[] = [];
  const create = GpuExperiment.create;
  const numerics: { maxError: number; wrongSigns: number; width: number; height: number }[] = [];
  GpuExperiment.create = async (gpu) => {
    const service = await create(gpu);
    const prepare = service.prepare.bind(service);
    service.prepare = async (frame) => {
      const mask = classifyAlpha(frame);
      const truth = signedDistanceOracle(mask, frame.width, frame.height);
      const prepared = await prepare(frame);
      const sdf = await prepared.readSdf();
      const result = { maxError: 0, wrongSigns: 0, width: frame.width, height: frame.height };
      for (let i = 0; i < sdf.length; i++) {
        result.maxError = Math.max(result.maxError, Math.abs(sdf[i] - truth[i]));
        result.wrongSigns += Number(sdf[i] < 0 !== Boolean(mask[i]));
      }
      numerics.push(result);
      return prepared;
    };
    return service;
  };
  try {
    fixture.elements.forEach((target, index) => {
      effects.push(
        attachFire(target, {
          host: fixture.hosts[index],
          time: 1.5 + index,
          seed: 314 + index,
          intensity: 0.85 - index * 0.2,
        }),
      );
    });
    await Promise.all(effects.map((effect) => effect.ready));
    check(
      effects.every((effect) => effect.lifecycle === 'active'),
      'both targets active',
    );
    check(
      observation.requests === 1 && observation.firePipelines === 1,
      'one device/fire pipeline',
    );
    check(numerics.length === 2, 'both captured silhouettes prepared');
    // Float16 distance quantization for these <=248px rasters stays below .1px.
    check(
      numerics.every((result) => result.wrongSigns === 0 && result.maxError < 0.1),
      'SDF oracle',
    );
    const canvases = [...fixture.container.querySelectorAll('canvas')];
    // Match by independent bounds, since concurrent captures may finish in either order.
    const layers = fixture.elements.map((target) => {
      const bounds = target.getBoundingClientRect();
      const canvas = canvases.find(
        (candidate) => Math.abs(candidate.getBoundingClientRect().left + 32 - bounds.left) < 0.1,
      );
      check(Boolean(canvas), 'target-local placement');
      if (!canvas) {
        throw new Error('missing target layer');
      }
      const layer = canvas.getBoundingClientRect();
      check(
        Math.abs(layer.top + 32 - bounds.top) < 0.1 &&
          Math.abs(layer.width - 64 - bounds.width) < 0.1 &&
          Math.abs(layer.height - 64 - bounds.height) < 0.1,
        'independent bounds',
      );
      check(
        canvas.parentElement === fixture.hosts[fixture.elements.indexOf(target)],
        'canvas host',
      );
      return canvas;
    });
    check(canvases.length === 2 && layers[0] !== layers[1], 'two distinct canvases');
    const tick = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    // Explicitly repaint before each canvas readback; browser canvas storage is transient.
    async function images() {
      effects.forEach((effect) => {
        const time = effect.time;
        effect.time = time;
      });
      await tick();
      return layers.map((canvas) => canvas.toDataURL());
    }
    const initial = await images();
    effects[0].time = 4;
    const sought = await images();
    check(initial[0] !== sought[0] && initial[1] === sought[1], 'independent seek');
    effects[0].time = 1.5;
    effects[0].intensity = 0;
    const zero = await images();
    check(zero[0] !== initial[0] && zero[1] === initial[1], 'independent intensity');
    effects[0].intensity = 0.85;
    const repeated = await images();
    check(
      repeated.every((value, index) => value === initial[index]),
      'independent repeatability',
    );
    const both = observation.allocation();
    const survivorIndex = 1 - disposedIndex;
    const survivor = layers[survivorIndex];
    const expectedBytes = survivor.width * survivor.height * 36 + 20;
    effects[disposedIndex].dispose();
    effects[disposedIndex].dispose();
    const surviving = observation.allocation();
    check(
      surviving.managedBytes === expectedBytes && surviving.bufferBytes === 20,
      'survivor allocation baseline',
    );
    check(
      observation.destroys === 0 && !layers[disposedIndex].isConnected,
      'only disposed layer removed',
    );
    const remaining = await images();
    check(remaining[survivorIndex] === initial[survivorIndex], 'surviving output unchanged');
    effects[survivorIndex].time += 1;
    check((await images())[survivorIndex] !== remaining[survivorIndex], 'survivor still renders');
    check(
      observation.firePipelines === 1 && numerics.length === 2,
      'controls reuse pipeline and rasters',
    );
    effects[survivorIndex].dispose();
    const released = observation.allocation();
    check(
      released.managedBytes === 0 && released.bufferBytes === 0 && observation.destroys === 1,
      'last owner releases service',
    );
    const next = attachFire(fixture.elements[0], { host: fixture.hosts[0] });
    effects.push(next);
    await next.ready;
    check(
      next.lifecycle === 'active' && observation.requests === 2,
      'reattachment creates a new service',
    );
    next.dispose();
    check(
      observation.services.every((service) => service.errors.length === 0),
      'no GPU errors',
    );
    return {
      scopes: observation.scopes,
      sharedHost,
      disposedIndex,
      numerics,
      both,
      surviving,
      released,
      adapter: {
        vendor: observation.services[0].adapterInfo.vendor,
        architecture: observation.services[0].adapterInfo.architecture,
        description: observation.services[0].adapterInfo.description,
      },
      method:
        'Real DOM capture, SDF oracle, canvas pixels, managed ledger and observed GPUBuffer destruction; excludes driver memory and canvas backing stores.',
    };
  } finally {
    effects.forEach((effect) => effect.dispose());
    observation.restore();
    fixture.container.remove();
  }
}

export async function verifySharedInitialization(
  mode: 'one-disposed' | 'all-disposed' | 'failure' | 'prepare' | 'prepare-failure',
) {
  const fixture = targets(true);
  const observation = observeServices();
  const effects: EffectHandle[] = [];
  const entered = deferred();
  const release = deferred();
  const create = GpuExperiment.create;
  let initializationCalls = 0;
  const preparing = mode === 'prepare' || mode === 'prepare-failure';
  GpuExperiment.create = async (gpu) => {
    initializationCalls += 1;
    if (!preparing) {
      entered.resolve();
      await release.promise;
      if (mode === 'failure') {
        throw new Error('controlled shared initialization failure');
      }
    }
    const service = await create(gpu);
    if (preparing) {
      const submitted = service.device.queue.onSubmittedWorkDone.bind(service.device.queue);
      let first = true;
      service.device.queue.onSubmittedWorkDone = async () => {
        await submitted();
        if (first) {
          first = false;
          entered.resolve();
          await release.promise;
          if (mode === 'prepare-failure') {
            throw new Error('controlled shared preparation failure');
          }
        }
      };
    }
    return service;
  };
  try {
    for (const target of fixture.elements) {
      effects.push(attachFire(target, { host: fixture.hosts[0] }));
    }
    await entered.promise;
    check(initializationCalls === 1, 'concurrent initialization deduplicated');
    if (mode !== 'failure' && mode !== 'prepare-failure') {
      effects[0].dispose();
      effects[0].dispose();
      if (mode === 'all-disposed') {
        effects[1].dispose();
      } else {
        // Reclaim the cancelled target while the original service still initializes/prepares.
        effects.push(attachFire(fixture.elements[0], { host: fixture.hosts[0] }));
      }
    }
    check(observation.destroys === 0, 'pending work retains the device');
    release.resolve();
    await Promise.all(effects.map((effect) => effect.ready));
    const lifecycles = effects.map((effect) => effect.lifecycle);
    if (mode === 'failure') {
      check(
        effects.every((effect) => effect.lifecycle === 'unavailable'),
        'shared failure reaches both owners',
      );
      check(!fixture.container.querySelector('canvas'), 'failed initialization leaves no layers');
      GpuExperiment.create = create;
      const retry = attachFire(fixture.elements[0], { host: fixture.hosts[0] });
      effects.push(retry);
      await retry.ready;
      check(retry.lifecycle === 'active', 'failed entry removed for explicit reattachment');
    } else if (mode === 'prepare-failure') {
      check(
        effects.filter((effect) => effect.lifecycle === 'unavailable').length === 1,
        'preparation failure isolated',
      );
      check(
        effects.filter((effect) => effect.lifecycle === 'active').length === 1,
        'queue continues after failure',
      );
      check(
        fixture.container.querySelectorAll('canvas').length === 1 && observation.destroys === 0,
        'failed target preserves surviving service',
      );
    } else if (mode === 'all-disposed') {
      check(
        observation.destroys === 1 && !fixture.container.querySelector('canvas'),
        'late service released',
      );
    } else {
      check(
        initializationCalls === 1 && observation.requests === 1,
        'reattachment joins pending service',
      );
      check(
        effects[1].lifecycle === 'active' && effects[2].lifecycle === 'active',
        'survivor and new owner render',
      );
      check(fixture.container.querySelectorAll('canvas').length === 2, 'no duplicate layers');
      let rejected = false;
      try {
        attachFire(fixture.elements[0], { host: fixture.hosts[0] });
      } catch (error) {
        rejected = error instanceof Error && error.message === 'effect-target-owned';
      }
      check(rejected, 'late disposed owner cannot release replacement claim');
    }
    effects.forEach((effect) => effect.dispose());
    const allocation = observation.allocation();
    check(allocation.managedBytes === 0 && allocation.bufferBytes === 0, 'all resources released');
    check(observation.destroys === observation.requests, 'one cleanup per created service');
    check(
      observation.services.every((service) => service.errors.length === 0),
      'no GPU errors',
    );
    return {
      scopes: observation.scopes,
      mode,
      initializationCalls,
      lifecycles,
      allocation,
      devices: observation.requests,
      destroys: observation.destroys,
    };
  } finally {
    release.resolve();
    effects.forEach((effect) => effect.dispose());
    await Promise.all(effects.map((effect) => effect.ready));
    observation.restore();
    fixture.container.remove();
  }
}

export async function verifyDocumentIsolation() {
  const fixture = targets(true);
  const iframe = document.createElement('iframe');
  const loaded = new Promise<void>((resolve) =>
    iframe.addEventListener('load', () => resolve(), { once: true }),
  );
  iframe.srcdoc = '<!doctype html><html><body></body></html>';
  document.body.append(iframe);
  await loaded;
  const foreign = iframe.contentDocument;
  const view = foreign?.defaultView;
  if (!foreign || !view) {
    throw new Error('missing iframe document');
  }
  await new Promise<void>((resolve) => view.requestAnimationFrame(() => resolve()));
  const host = foreign.createElement('div');
  host.style.cssText = 'position:relative;width:150px;height:100px';
  const target = foreign.createElement('div');
  target.style.cssText = fixture.elements[0].style.cssText;
  host.append(target);
  foreign.body.append(host);
  const observation = observeServices();
  const effects: EffectHandle[] = [];
  try {
    effects.push(attachFire(fixture.elements[0], { host: fixture.hosts[0] }));
    effects.push(attachFire(target, { host }));
    await Promise.all(effects.map((effect) => effect.ready));
    check(
      effects.every((effect) => effect.lifecycle === 'active'),
      `both Documents render: ${effects.map((effect) => `${effect.lifecycle}/${effect.reasonDetail}`).join(', ')}`,
    );
    check(observation.services.length === 2, 'separate Document services');
    check(observation.services[0].device !== observation.services[1].device, 'distinct devices');
    effects[0].dispose();
    effects[1].time = 2;
    await new Promise<void>((resolve) => view.requestAnimationFrame(() => resolve()));
    check(
      effects[1].lifecycle === 'active' && observation.destroys === 1,
      'foreign service survives',
    );
    effects[1].dispose();
    // A foreign Document without WebGPU must not borrow the caller's navigator.
    Object.defineProperty(view.navigator, 'gpu', { value: undefined, configurable: true });
    const unavailable = attachFire(target, { host });
    effects.push(unavailable);
    await unavailable.ready;
    check(unavailable.reason === 'no-webgpu', 'uses owning Document capability');
    check(observation.services.length === 2 && observation.destroys === 2, 'no borrowed device');
    check(
      observation.services.every((service) => service.errors.length === 0),
      'no GPU errors',
    );
    return {
      devices: observation.services.length,
      destroys: observation.destroys,
      allocation: observation.allocation(),
    };
  } finally {
    effects.forEach((effect) => effect.dispose());
    observation.restore();
    iframe.remove();
    fixture.container.remove();
  }
}

/** Simulate the loss notification; all successful preparation/presentation is real GPU work. */
export async function verifySharedDeviceLoss() {
  const fixture = targets(true);
  const observation = observeServices();
  const effects: EffectHandle[] = [];
  let lose: (info: Pick<GPUDeviceLostInfo, 'reason' | 'message'>) => void = () => {};
  const lost = new Promise<Pick<GPUDeviceLostInfo, 'reason' | 'message'>>((resolve) => {
    lose = resolve;
  });
  const create = GpuExperiment.create;
  GpuExperiment.create = async (gpu) => {
    const service = await create(gpu);
    Object.defineProperty(service.device, 'lost', { value: lost });
    return service;
  };
  try {
    for (const target of fixture.elements) {
      effects.push(attachFire(target, { host: fixture.hosts[0] }));
    }
    await Promise.all(effects.map((effect) => effect.ready));
    check(
      effects.every((effect) => effect.lifecycle === 'active'),
      'both targets initially active',
    );
    lose({ reason: 'unknown', message: 'controlled shared device loss' });
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    check(
      effects.every(
        (effect) => effect.lifecycle === 'unavailable' && effect.reason === 'device-lost',
      ),
      'loss reaches both owners',
    );
    check(!fixture.container.querySelector('canvas'), 'loss removes all layers');
    check(
      observation.requests === 1 && observation.destroys === 1,
      'loss releases service without retry',
    );
    return { allocation: observation.allocation(), destroys: observation.destroys };
  } finally {
    effects.forEach((effect) => effect.dispose());
    observation.restore();
    fixture.container.remove();
  }
}
