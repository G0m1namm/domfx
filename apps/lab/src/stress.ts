import { attachFire, captureElement } from '@domfx/browser';
import { attachFireWithAdapters, GpuExperiment, memoryFor } from '@domfx/browser/experimental';

import { installStressProbe } from './stress-probe.js';

const turn = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

function check(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function until(predicate: () => boolean, name: string) {
  const deadline = performance.now() + 10_000;
  while (!predicate()) {
    check(performance.now() < deadline, `timeout: ${name}`);
    await turn();
  }
}

async function settle<T>(promise: Promise<T>, name: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(`unresolved promise: ${name}`)), 10_000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function deferred() {
  let resolve = () => {};
  const promise = new Promise<void>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

function targets() {
  const host = document.createElement('div');
  host.style.cssText = 'position:absolute;left:40px;top:100px;width:240px;height:100px';
  const elements = [0, 1].map((index) => {
    const target = document.createElement('div');
    target.style.cssText = `position:absolute;left:${index * 110}px;width:24px;height:24px;background:blue;border-radius:50%`;
    host.append(target);
    return target;
  });
  document.body.append(host);
  return { host, elements };
}

function hide(hidden: boolean) {
  Object.defineProperty(document, 'hidden', { configurable: true, value: hidden });
  document.dispatchEvent(new Event('visibilitychange'));
}

type Stage = 'capture' | 'prepare';
function raceTarget(target: HTMLElement, host: HTMLElement, seed: number) {
  const services: GpuExperiment[] = [];
  const counts = {
    captures: 0,
    releases: 0,
    preparations: 0,
    destroys: 0,
    leases: 0,
    renders: 0,
    staleRenders: 0,
    duplicateReleases: 0,
  };
  let gate: ReturnType<typeof block> | undefined;
  const tokens = new WeakMap<object, { obsolete: boolean }>();
  function block(stage: Stage, fail: boolean) {
    const entered = deferred();
    const released = deferred();
    const token = { obsolete: false };
    const next = { stage, fail, entered, released, token };
    gate = next;
    return next;
  }
  const effect = attachFireWithAdapters(
    target,
    { host, seed, time: 2 },
    {
      capture: async () => {
        const current = gate;
        const captured = await captureElement(target);
        counts.captures += 1;
        let released = false;
        const result = {
          ...captured,
          release() {
            counts.duplicateReleases += Number(released);
            released = true;
            counts.releases += 1;
            captured.release();
          },
        };
        if (current) {
          tokens.set(result, current.token);
        }
        if (current?.stage === 'capture') {
          gate = undefined;
          current.entered.resolve();
          await current.released.promise;
          if (current.fail) {
            result.release();
            throw new Error('seeded-capture-failure');
          }
        }
        return result;
      },
      createRenderer: async () => {
        const service = await GpuExperiment.create();
        services.push(service);
        counts.leases += 1;
        return {
          device: service.device,
          prepare: async (captured) => {
            const current = gate;
            const prepared = await service.prepare(captured);
            const token = tokens.get(captured);
            counts.preparations += 1;
            let destroyed = false;
            const result = {
              ...prepared,
              render(...args: Parameters<typeof prepared.render>) {
                counts.staleRenders += Number(token?.obsolete ?? false);
                check(!token?.obsolete, 'stale prepared frame rendered');
                counts.renders += 1;
                prepared.render(...args);
              },
              destroy() {
                counts.duplicateReleases += Number(destroyed);
                destroyed = true;
                counts.destroys += 1;
                prepared.destroy();
              },
            };
            if (current?.stage === 'prepare') {
              gate = undefined;
              current.entered.resolve();
              await current.released.promise;
              if (current.fail) {
                result.destroy();
                throw new Error('seeded-prepare-failure');
              }
            }
            return result;
          },
          destroy() {
            counts.leases -= 1;
            service.destroy();
          },
        };
      },
    },
  );
  return { effect, target, counts, services, block };
}

const transitions = [
  'visibility',
  'zero',
  'loss',
  'retry',
  'revert',
  'dispose',
  'failure',
] as const;

/** Seed controls operation order, values, completion order and failures; stage/transition
 * coverage is balanced so every saved seed exercises every required boundary. */
async function runSeed(seed: number) {
  const started = performance.now();
  let randomState = seed >>> 0;
  function random() {
    randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
    return randomState / 0x1_0000_0000;
  }
  const trace: string[] = [];
  const samples: object[] = [];
  const probe = installStressProbe();
  // Load GSAP after instrumenting frames so its cached request function is observed.
  const [{ gsap }, { bindFire }] = await Promise.all([import('gsap'), import('@domfx/gsap')]);
  const baselineBytes = memoryFor(document).bytes;
  const errors: string[] = [];
  const onRejection = (event: PromiseRejectionEvent) => errors.push(String(event.reason));
  window.addEventListener('unhandledrejection', onRejection);
  // Learn only the existing GSAP ticker callback, before any attachment is created.
  const warmup = gsap.timeline({ paused: true });
  await new Promise<void>((resolve) => setTimeout(resolve, 50));
  warmup.kill();
  probe.finishWarmup();
  const baseline = probe.snapshot();
  let pendingPromises = 0;
  function track(promise: Promise<void>) {
    pendingPromises += 1;
    return promise.then(
      () => {
        pendingPromises -= 1;
        return 'resolved';
      },
      (error: unknown) => {
        pendingPromises -= 1;
        return String(error);
      },
    );
  }
  function op(cycle: number, name: string) {
    trace.push(`${cycle}:${name}`);
  }
  try {
    // 28 two-target cycles, covering each stage/transition twice per seed.
    for (let cycle = 0; cycle < 28; cycle += 1) {
      const transition = transitions[(cycle + (seed % transitions.length)) % transitions.length];
      const stage: Stage = Math.floor(cycle / transitions.length) % 2 ? 'prepare' : 'capture';
      const fail = transition === 'failure' || random() < 0.5;
      const { host, elements } = targets();
      const fixtures = elements.map((target, index) => {
        op(cycle, `attach:${index}`);
        return raceTarget(target, host, seed + index);
      });
      const timeline = gsap.timeline({ paused: true });
      const sibling = gsap.to({ value: 0 }, { value: 1, duration: 1, paused: true });
      timeline.add(sibling, 0);
      const contexts = fixtures.map(({ effect }, index) =>
        gsap.context(() => {
          op(cycle, `bind:${index}`);
          bindFire(effect, timeline, { time: 5, intensity: 0.6, duration: 1, disposeEffect: true });
        }),
      );
      const gates: ReturnType<ReturnType<typeof raceTarget>['block']>[] = [];
      try {
        await settle(Promise.all(fixtures.map((f) => f.effect.ready)), 'initial readiness');
        check(
          fixtures.every((f) => f.effect.lifecycle === 'active'),
          'initial attachment unavailable',
        );
        for (const [index, f] of fixtures.entries()) {
          op(cycle, `time:${index}`);
          f.effect.time = random() * 10;
          op(cycle, `intensity:${index}`);
          f.effect.intensity = random();
        }
        await frame();
        // Fresh visibility re-entry retains pixels and manual time, without capture.
        const before = fixtures.map((f) => ({ time: f.effect.time, captures: f.counts.captures }));
        op(cycle, 'hide-fresh');
        hide(true);
        await frame();
        op(cycle, 'show-fresh');
        hide(false);
        await frame();
        fixtures.forEach((f, index) => {
          check(
            f.effect.time === before[index].time && f.counts.captures === before[index].captures,
            'fresh visibility re-entry changed time or captured',
          );
        });
        const refreshes = fixtures.map((f, index) => {
          op(cycle, `block-${stage}:${index}:${fail}`);
          gates.push(f.block(stage, fail));
          op(cycle, `refresh:${index}`);
          return track(f.effect.refresh());
        });
        await settle(Promise.all(gates.map((gate) => gate.entered.promise)), 'gate entry');
        const renders = fixtures.map((f) => f.counts.renders);
        const retries: Promise<string>[] = [];
        const order = random() < 0.5 ? [0, 1] : [1, 0];
        if (transition !== 'failure') {
          gates.forEach((gate) => {
            gate.token.obsolete = true;
          });
        }
        for (const index of order) {
          const f = fixtures[index];
          op(cycle, `${transition}:${index}`);
          switch (transition) {
            case 'visibility':
              hide(true);
              break;
            case 'zero':
              f.target.style.width = '0px';
              break;
            case 'loss':
              f.services.at(-1)?.device.destroy();
              break;
            case 'retry':
              retries.push(track(f.effect.retry()));
              break;
            case 'revert':
              contexts[index].revert();
              break;
            case 'dispose':
              f.effect.dispose();
              break;
            case 'failure':
              break;
          }
        }
        if (transition === 'zero') {
          await until(() => fixtures.every((f) => f.effect.lifecycle === 'suspended'), 'zero size');
          await frame();
        } else if (transition === 'loss') {
          await until(
            () => fixtures.every((f) => f.effect.reason === 'device-lost'),
            'device loss',
          );
        }
        await turn();
        if (transition !== 'failure') {
          check(
            pendingPromises === retries.length,
            'invalidated refresh waited for late completion',
          );
        }
        for (const index of [...order].reverse()) {
          op(cycle, `complete:${index}`);
          gates[index].released.resolve();
          await turn();
        }
        const outcomes = await settle(Promise.all(refreshes), 'refresh settlement');
        check(
          outcomes.every((outcome) => outcome !== 'resolved'),
          'obsolete/failed refresh resolved',
        );
        if (transition !== 'retry') {
          check(
            fixtures.every((f, index) => f.counts.renders === renders[index]),
            'late work committed',
          );
        }
        if (transition === 'failure') {
          check(
            fixtures.every((f) => f.effect.lifecycle === 'unavailable'),
            'current failure ignored',
          );
        }
        if (transition === 'dispose' || transition === 'revert') {
          check(
            fixtures.every((f) => f.effect.lifecycle === 'disposed'),
            'late completion revived disposal',
          );
        } else if (transition === 'loss') {
          check(
            fixtures.every((f) => f.effect.reason === 'device-lost'),
            'late failure replaced device loss',
          );
        } else if (transition === 'visibility' || transition === 'zero') {
          check(
            fixtures.every(
              (f) => f.effect.lifecycle === 'suspended' && f.effect.raster === 'stale',
            ),
            'late completion revived stale output',
          );
        }
        if (transition === 'visibility') {
          op(cycle, 'show-stale');
          hide(false);
          await frame();
          check(
            fixtures.every((f) => f.effect.raster === 'stale'),
            'stale re-entry committed',
          );
        }
        if (transition === 'zero') {
          for (const f of fixtures) {
            op(cycle, 'restore-size');
            f.target.style.width = '24px';
          }
        }
        if (!['dispose', 'revert', 'retry'].includes(transition)) {
          for (const [index, f] of fixtures.entries()) {
            op(cycle, `recover:${index}`);
            retries.push(
              track(transition === 'visibility' ? f.effect.refresh() : f.effect.retry()),
            );
          }
        }
        await settle(Promise.all(retries), 'recovery');
        if (!['dispose', 'revert'].includes(transition)) {
          check(
            fixtures.every((f) => f.effect.lifecycle === 'active' && f.effect.raster === 'fresh'),
            'recovery failed',
          );
        }
        for (const index of order) {
          op(cycle, `context-revert:${index}`);
          contexts[index].revert();
          op(cycle, `dispose-again:${index}`);
          fixtures[index].effect.dispose();
        }
        check(
          timeline.getChildren().length === 1 && timeline.getChildren()[0] === sibling,
          'binding cleanup removed sibling or retained child',
        );
        await until(() => fixtures.every((f) => f.counts.leases === 0), 'late resource cleanup');
        await turn();
        const snapshot = {
          cycle,
          ...probe.snapshot(),
          reservedBytes: memoryFor(document).bytes - baselineBytes,
          managedBytes: fixtures
            .flatMap((f) => f.services)
            .reduce((sum, service) => sum + service.managedBytes, 0),
          bindings: timeline.getChildren().length - 1,
          pendingPromises,
          canvases: host.querySelectorAll('canvas').length,
          targets: fixtures.map((f) => ({ ...f.counts })),
        };
        samples.push(snapshot);
        check(
          JSON.stringify(probe.snapshot()) === JSON.stringify(baseline),
          `observer/scheduler leak: ${JSON.stringify(snapshot)}`,
        );
        check(
          snapshot.reservedBytes === 0 &&
            snapshot.managedBytes === 0 &&
            snapshot.bindings === 0 &&
            snapshot.pendingPromises === 0 &&
            snapshot.canvases === 0,
          `resource leak: ${JSON.stringify(snapshot)}`,
        );
        for (const f of fixtures) {
          check(f.counts.staleRenders === 0, 'stale render attempted');
          check(f.counts.duplicateReleases === 0, 'resource released more than once');
          check(f.counts.captures === f.counts.releases, 'capture release imbalance');
          check(
            f.counts.preparations === f.counts.destroys,
            'prepared frame destruction imbalance',
          );
          check(
            f.services.every((service) => service.errors.length === 0),
            'GPU validation errors',
          );
        }
        check(errors.length === 0, `unhandled rejections: ${errors.join('; ')}`);
      } finally {
        gates.forEach((gate) => gate.released.resolve());
        contexts.forEach((context) => context.revert());
        fixtures.forEach((f) => f.effect.dispose());
        timeline.kill();
        sibling.kill();
        host.remove();
        hide(false);
      }
    }
    check(trace.length >= 500, 'fewer than 500 operations');
    return {
      seed,
      operations: trace.length,
      cycles: samples.length,
      durationMs: performance.now() - started,
      trace,
      samples,
      errors,
      ...probe.peaks(),
      method:
        'Real capture/GPU work with seeded completion gates and injected failures; synthetic document visibility and intentional device destruction.',
    };
  } catch (error) {
    throw new Error(
      `seed=${seed}; operation=${trace.length}; ${String(error)}; trace=${JSON.stringify(trace)}`,
    );
  } finally {
    window.removeEventListener('unhandledrejection', onRejection);
    Reflect.deleteProperty(document, 'hidden');
    probe.restore();
  }
}

/** Smaller public-API soak: actual capture, shared renderer, native scrolling and GPU output. */
async function runSoak(iterations = 24) {
  const started = performance.now();
  const baseline = memoryFor(document).bytes;
  const samples: object[] = [];
  const adapter = await navigator.gpu.requestAdapter();
  check(adapter !== null, 'WebGPU adapter unavailable');
  const probe = installStressProbe();
  probe.finishWarmup();
  const resourceBaseline = probe.snapshot();
  try {
    for (let iteration = 0; iteration < iterations; iteration += 1) {
      const { host, elements } = targets();
      const effects = elements.map((target) => attachFire(target, { host, time: 2, seed: 314 }));
      try {
        await Promise.all(effects.map((effect) => effect.ready));
        check(
          effects.every((effect) => effect.lifecycle === 'active'),
          'soak unavailable',
        );
        // Concurrent captures append in completion order, not target order.
        const canvases = [...host.querySelectorAll('canvas')].sort(
          (a, b) => Number.parseFloat(a.style.left) - Number.parseFloat(b.style.left),
        );
        const pixels = canvases.map((canvas) => canvas.toDataURL());
        check(
          pixels.length === 2 && pixels.every((value) => value.length > 100),
          'missing soak pixels',
        );
        effects.forEach((effect) => {
          effect.intensity = 0;
        });
        await frame();
        check(
          canvases.every((canvas, index) => canvas.toDataURL() !== pixels[index]),
          'fire output is empty',
        );
        effects.forEach((effect) => {
          effect.intensity = 1;
        });
        await frame();
        check(
          canvases.every((canvas, index) => canvas.toDataURL() === pixels[index]),
          'fixed-time output changed',
        );
        // Keep native observer/geometry scheduling alive between lifecycle operations.
        await new Promise<void>((resolve) => setTimeout(resolve, 250));
        host.style.top = '1800px';
        await until(
          () => effects.every((effect) => effect.lifecycle === 'suspended'),
          'offscreen soak',
        );
        window.scrollTo(0, 1700);
        await until(
          () => effects.every((effect) => effect.lifecycle === 'active'),
          'scroll re-entry',
        );
        check(
          effects.every((effect) => effect.time === 2),
          'soak time changed',
        );
        check(
          canvases.every((canvas, index) => canvas.toDataURL() === pixels[index]),
          're-entry pixels changed',
        );
        await Promise.all(effects.map((effect) => effect.refresh()));
        await frame();
        // Refresh installs a new raster; compare survival with that committed output.
        const refreshedPixels = canvases.map((canvas) => canvas.toDataURL());
        effects[iteration % 2].dispose();
        check(effects[1 - (iteration % 2)].lifecycle === 'active', 'shared survivor unavailable');
        const survivor = 1 - (iteration % 2);
        effects[survivor].intensity = 0;
        await frame();
        effects[survivor].intensity = 1;
        await frame();
        check(
          canvases[survivor].toDataURL() === refreshedPixels[survivor],
          `shared survivor lost its resources: ${JSON.stringify({ iteration, survivor, expected: refreshedPixels[survivor].length, actual: canvases[survivor].toDataURL().length, lifecycle: effects[survivor].lifecycle, raster: effects[survivor].raster, reason: effects[survivor].reason, time: effects[survivor].time, intensity: effects[survivor].intensity, scroll: scrollY, bounds: elements[survivor].getBoundingClientRect().toJSON(), resources: probe.snapshot() })}`,
        );
      } finally {
        effects.forEach((effect) => effect.dispose());
        host.remove();
        window.scrollTo(0, 0);
      }
      await frame();
      samples.push({
        iteration,
        ...probe.snapshot(),
        reservedBytes: memoryFor(document).bytes - baseline,
        canvases: document.querySelectorAll('canvas').length,
      });
      check(memoryFor(document).bytes === baseline, 'soak reservation leak');
      check(
        JSON.stringify(probe.snapshot()) === JSON.stringify(resourceBaseline),
        `soak resource leak: ${JSON.stringify(probe.snapshot())}`,
      );
      check(document.querySelectorAll('canvas').length === 0, 'soak canvas leak');
    }
    return {
      iterations,
      durationMs: performance.now() - started,
      samples,
      ...probe.peaks(),
      browser: navigator.userAgent,
      adapter: {
        vendor: adapter.info.vendor,
        architecture: adapter.info.architecture,
        description: adapter.info.description,
      },
      viewport: [innerWidth, innerHeight],
      dpr: devicePixelRatio,
      visibility: document.visibilityState,
      reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
      memoryMethod:
        'Attachment reservation ledger; explicit GPUBuffer create/destroy bytes and GPUTexture create/destroy counts; canvas, observer and scheduled-frame counts after each teardown. Seeded runs also count managed frames, releases and GSAP children. No forced GC, process heap, driver caches, canvas backing-store bytes or total VRAM measurement.',
    };
  } finally {
    probe.restore();
  }
}

declare global {
  interface Window {
    stress: { runSeed: typeof runSeed; runSoak: typeof runSoak };
  }
}
window.stress = { runSeed, runSoak };
