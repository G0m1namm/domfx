import { CaptureError, type CaptureFrame, type EffectHandle } from '@domfx/browser';
import {
  attachFireWithAdapters,
  estimateFrameMemory,
  GpuExperiment,
  memoryFor,
} from '@domfx/browser/experimental';

/** Use a real producer without exporting the internal error constructor to the lab. */
function budgetFailure(message: string): Error {
  try {
    estimateFrameMemory(1001, 1000);
  } catch (error) {
    if (error instanceof Error) {
      error.message = message;
      return error;
    }
  }
  throw new Error('expected capture budget failure');
}

export async function verifyFailureClassification() {
  const checks: string[] = [];
  function check(condition: boolean, name: string) {
    if (!condition) {
      throw new Error(`failure classification: ${name}`);
    }
    checks.push(name);
  }
  const host = document.createElement('div');
  host.style.cssText = 'position:absolute;left:0;top:0;width:40px;height:40px';
  const target = document.createElement('div');
  target.style.cssText = 'width:7px;height:5px';
  host.append(target);
  document.body.append(host);
  const baseline = memoryFor(document).bytes;
  const effects: EffectHandle[] = [];
  const assetCause = new Error('image decoding context');
  const captureError = new CaptureError('capture-decode-failed', 'snapshot', assetCause);
  const cases = [
    { error: budgetFailure('first budget diagnostic'), typed: true },
    { error: budgetFailure('second budget diagnostic'), typed: true },
    { error: new Error('no-adapter'), typed: false },
    { error: new Error('unsupported-composition'), typed: false },
    { error: 'capture-budget', typed: false },
    {
      error: Object.assign(new Error('empty-mask'), { code: 'empty-mask', name: 'EffectError' }),
      typed: false,
    },
    { error: captureError, typed: false },
  ];
  try {
    for (const stage of ['setup', 'capture', 'prepare', 'paint'] as const) {
      for (const phase of ['initial', 'refresh'] as const) {
        if (stage === 'setup' && phase === 'refresh') {
          continue;
        }
        for (const { error, typed } of cases) {
          const label = `${stage}/${phase}/${String(error)}`;
          let fail = phase === 'initial';
          let services = 0;
          let serviceDestroys = 0;
          const releases: number[] = [];
          const destroys: number[] = [];
          let released = () => {};
          const drained = new Promise<void>((resolve) => {
            released = resolve;
          });
          const adapters = {
            capture: async (): Promise<CaptureFrame> => {
              if (fail && stage === 'capture') {
                throw error;
              }
              const id = releases.push(0) - 1;
              const pixels = new Uint8Array(7 * 5 * 4);
              pixels[(2 * 7 + 3) * 4 + 3] = 255;
              return {
                width: 7,
                height: 5,
                pixels,
                contentBounds: { x: 0, y: 0, width: 7, height: 5 },
                padding: { top: 0, right: 0, bottom: 0, left: 0 },
                pixelToLocal: { a: 1, d: 1, e: 0, f: 0 },
                release() {
                  releases[id] += 1;
                },
              };
            },
            createRenderer: async () => {
              if (fail && stage === 'setup') {
                throw error;
              }
              const service = await GpuExperiment.create();
              services += 1;
              return {
                device: service.device,
                prepare: async (frame: CaptureFrame) => {
                  if (fail && stage === 'prepare') {
                    throw error;
                  }
                  const prepared = await service.prepare(frame);
                  const id = destroys.push(0) - 1;
                  return {
                    ...prepared,
                    render(...args: Parameters<typeof prepared.render>) {
                      if (fail && stage === 'paint') {
                        throw error;
                      }
                      prepared.render(...args);
                    },
                    destroy() {
                      destroys[id] += 1;
                      prepared.destroy();
                    },
                  };
                },
                destroy() {
                  serviceDestroys += 1;
                  service.destroy();
                  released();
                },
              };
            },
          };
          const effect = attachFireWithAdapters(target, { host }, adapters);
          effects.push(effect);
          if (phase === 'refresh') {
            await effect.ready;
            check(effect.lifecycle === 'active', `${label}: initial success`);
            fail = true;
          }
          const rejection: unknown = await effect.refresh().catch((failure: unknown) => failure);
          await effect.ready;
          if (services) {
            await drained;
          }
          check(effect.lifecycle === 'unavailable', `${label}: ready settles unavailable`);
          check(
            effect.reason ===
              (typed
                ? 'capture-budget'
                : stage === 'capture'
                  ? 'capture-failed'
                  : 'renderer-failed'),
            `${label}: stable reason`,
          );
          check(
            effect.reasonDetail === (error instanceof Error ? error.message : String(error)),
            `${label}: diagnostic retained`,
          );
          check(rejection === error, `${label}: rejection retains identity`);
          if (rejection instanceof CaptureError) {
            check(
              rejection.cause === assetCause &&
                rejection.asset === 'snapshot' &&
                rejection.code === 'capture-decode-failed',
              `${label}: capture metadata retained`,
            );
          }
          check(
            releases.every((count) => count === 1) &&
              destroys.every((count) => count === 1) &&
              services === serviceDestroys,
            `${label}: exactly-once cleanup`,
          );
          check(
            memoryFor(document).bytes === baseline && !host.querySelector('canvas'),
            `${label}: no retained output or reservations`,
          );
          fail = false;
          const replacement = attachFireWithAdapters(target, { host }, adapters);
          effects.push(replacement);
          await replacement.ready;
          check(replacement.lifecycle === 'active', `${label}: replacement claims target`);
          effect.dispose();
          replacement.dispose();
          check(
            releases.every((count) => count === 1) &&
              destroys.every((count) => count === 1) &&
              services === serviceDestroys &&
              memoryFor(document).bytes === baseline,
            `${label}: disposal stays idempotent`,
          );
        }
      }
    }
    return checks;
  } finally {
    effects.forEach((effect) => effect.dispose());
    host.remove();
  }
}
