import { captureElement, type FireOptions } from '@domfx/browser';
import { attachFireWithAdapters, GpuExperiment, memoryFor } from '@domfx/browser/experimental';

function deferred() {
  let resolve = () => {};
  const promise = new Promise<void>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

type Stage = 'renderer' | 'capture' | 'prepare';

/** Delay real browser/GPU work to exercise preference changes at async boundaries. */
export function createMotionFixture(
  motion: FireOptions['motion'],
  initialStage?: Stage,
  ancestor?: HTMLElement,
) {
  const host = document.createElement('div');
  host.style.cssText = 'position:absolute;left:0;top:0;width:80px;height:80px';
  const target = document.createElement('div');
  target.style.cssText = 'width:24px;height:24px;background:blue;border-radius:50%';
  if (ancestor) {
    ancestor.append(target);
    host.append(ancestor);
  } else {
    host.append(target);
  }
  document.body.append(host);
  const baseline = memoryFor(document).bytes;
  const stats = {
    captures: 0,
    releases: 0,
    preparations: 0,
    destroys: 0,
    services: 0,
    serviceDestroys: 0,
    times: [] as number[],
  };
  let stage = initialStage;
  let entered = deferred();
  let gate = deferred();
  let service: GpuExperiment | undefined;
  let output: HTMLCanvasElement | null = null;
  async function wait(at: Stage) {
    if (stage === at) {
      entered.resolve();
      await gate.promise;
    }
  }
  const effect = attachFireWithAdapters(
    target,
    { host, motion, clock: 'ambient', time: 7, seed: 314 },
    {
      capture: async () => {
        stats.captures += 1;
        const frame = await captureElement(target);
        await wait('capture');
        return {
          ...frame,
          release() {
            stats.releases += 1;
            frame.release();
          },
        };
      },
      createRenderer: async () => {
        stats.services += 1;
        const renderer = await GpuExperiment.create();
        service = renderer;
        await wait('renderer');
        return {
          device: renderer.device,
          prepare: async (frame) => {
            stats.preparations += 1;
            const prepared = await renderer.prepare(frame);
            await wait('prepare');
            return {
              ...prepared,
              render(time, seed, intensity, rasterScale) {
                stats.times.push(time);
                prepared.render(time, seed, intensity, rasterScale);
              },
              destroy() {
                stats.destroys += 1;
                prepared.destroy();
              },
            };
          },
          destroy() {
            stats.serviceDestroys += 1;
            renderer.destroy();
          },
        };
      },
    },
  );
  return {
    host,
    target,
    effect,
    stats,
    get entered() {
      return entered.promise;
    },
    block(next: Stage) {
      output = host.querySelector('canvas');
      stage = next;
      entered = deferred();
      gate = deferred();
    },
    release() {
      gate.resolve();
    },
    snapshot() {
      return {
        ...stats,
        managedBytes: service?.managedBytes ?? 0,
        reservedBytes: memoryFor(document).bytes - baseline,
        canvases: host.querySelectorAll('canvas').length,
        previousWidth: output?.width ?? 0,
        lifecycle: effect.lifecycle,
        raster: effect.raster,
        reason: effect.reason,
      };
    },
    pixels() {
      return host.querySelector('canvas')?.toDataURL();
    },
    dispose() {
      effect.dispose();
      host.remove();
    },
  };
}
