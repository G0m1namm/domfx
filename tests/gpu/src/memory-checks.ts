import { attachFire, captureElement, type EffectHandle } from '@domfx/browser';
import { attachFireWithAdapters, GpuExperiment, memoryFor } from '@domfx/browser/experimental';

function deferred() {
  let resolve = () => {};
  const promise = new Promise<void>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

/** Hold real capture before rasterization; successful frames use the real renderer. */
export async function verifyMemory() {
  const checks: string[] = [];
  const ledger = memoryFor(document);
  const baseline = ledger.bytes;
  function check(condition: boolean, name: string) {
    if (!condition) {
      throw new Error(`memory: ${name}`);
    }
    checks.push(name);
  }
  const host = document.createElement('div');
  host.style.cssText =
    'position:absolute;left:0;top:0;display:grid;grid-template-columns:repeat(2,436px)';
  const targets = Array.from({ length: 4 }, () => {
    const target = document.createElement('div');
    // At DPR 2 the requested padded raster is exactly 1,000,000 pixels.
    target.style.cssText = 'width:436px;height:436px;background:white';
    host.append(target);
    return target;
  });
  document.body.append(host);
  const service = await GpuExperiment.create();
  const effects: EffectHandle[] = [];
  let lose: () => void = () => {};
  const lost = new Promise<Pick<GPUDeviceLostInfo, 'reason' | 'message'>>((resolve) => {
    lose = () => resolve({ reason: 'unknown', message: 'controlled loss during capture' });
  });
  Object.defineProperty(service.device, 'lost', { value: lost });
  let gate = deferred();
  let entered = deferred();
  let captures = 0;
  const attach = (target: Element) => {
    const effect = attachFireWithAdapters(
      target,
      { host },
      {
        capture: async (element) => {
          captures += 1;
          entered.resolve();
          await gate.promise;
          return captureElement(element);
        },
        createRenderer: async () => ({
          device: service.device,
          prepare: (frame) => service.prepare(frame),
          destroy() {},
        }),
      },
    );
    effects.push(effect);
    return effect;
  };
  try {
    const first = targets.map(attach);
    await entered.promise;
    await first[3].ready;
    check(captures === 3, 'fourth initial request rejects before capture');
    check(
      first[3].reason === 'aggregate-budget' && first[3].lifecycle === 'unavailable',
      'initial rejection is typed unavailable',
    );
    check(
      ledger.bytes - baseline === 132_000_156,
      'pending capture GPU and output estimates counted',
    );
    gate.resolve();
    await Promise.all(first.map((effect) => effect.ready));
    check(
      first.slice(0, 3).every((effect) => effect.lifecycle === 'active'),
      'three admitted targets render',
    );
    check(ledger.bytes - baseline === 120_000_156, 'CPU release reconciles retained frames');
    first[2].dispose();
    gate = deferred();
    entered = deferred();
    const replacement = first[0].refresh();
    await entered.promise;
    const rejected = await first[1].refresh().catch((error: Error) => error.message);
    check(rejected === 'aggregate-budget', 'concurrent replacement rejects its promise');
    check(
      first[1].raster === 'stale' && first[1].lifecycle === 'unavailable',
      'rejected refresh remains stale and hidden',
    );
    check(
      host.querySelectorAll('canvas').length === 1 &&
        host.querySelector('canvas')?.style.display === 'none',
      'no rejected or stale output visible',
    );
    check(
      ledger.bytes - baseline === 84_000_104,
      'failed refresh frees only its retained resources',
    );
    gate.resolve();
    await replacement;
    check(
      first[0].lifecycle === 'active' && ledger.bytes - baseline === 40_000_052,
      'replacement transfers reservation without double counting',
    );
    first[0].dispose();
    check(
      ledger.bytes === baseline && service.managedBytes === 0,
      'success and failure release all reservations',
    );

    targets[0].style.cssText = 'width:7px;height:5px;background:white';
    for (const stage of ['capture', 'prepare'] as const) {
      let preparedDestroys = 0;
      let rasterized = false;
      const mismatch = attachFireWithAdapters(
        targets[0],
        { host },
        {
          capture: async (element, options, reserve) => {
            if (stage === 'capture') {
              // Report authoritative dimensions before allocating raster pixels.
              reserve?.(1001, 1000);
            }
            rasterized = true;
            return captureElement(element, options);
          },
          createRenderer: async () => ({
            device: service.device,
            prepare: async (frame) => {
              const prepared = await service.prepare(frame);
              return {
                ...prepared,
                managedBytes: 48_000_000,
                destroy() {
                  preparedDestroys += 1;
                  prepared.destroy();
                },
              };
            },
            destroy() {},
          }),
        },
      );
      effects.push(mismatch);
      await mismatch.ready;
      check(
        mismatch.reason === (stage === 'capture' ? 'capture-budget' : 'target-budget'),
        `${stage} actual size rejects over-budget reconciliation`,
      );
      check(
        rasterized === (stage === 'prepare') && preparedDestroys === Number(stage === 'prepare'),
        `${stage} rejection releases only allocated resources`,
      );
      check(
        ledger.bytes === baseline && service.managedBytes === 0,
        `${stage} reconciliation failure releases reservation`,
      );
    }
    targets[0].style.cssText = 'width:436px;height:436px;background:white';

    // Non-cancellable captures remain charged after disposal or a loss notification.
    for (const transition of ['dispose', 'device-loss'] as const) {
      gate = deferred();
      entered = deferred();
      const pending = attach(targets[0]);
      await entered.promise;
      if (transition === 'dispose') {
        pending.dispose();
        pending.dispose();
      } else {
        lose();
        await Promise.resolve();
        check(pending.reason === 'device-lost', 'loss invalidates pending owner');
      }
      check(ledger.bytes - baseline === 44_000_052, `${transition} retains pending reservation`);
      gate.resolve();
      await pending.ready;
      check(ledger.bytes === baseline, `${transition} late capture releases once`);
    }

    targets[0].style.width = '437px';
    const oversized = attachFire(targets[0], { host });
    effects.push(oversized);
    await oversized.ready;
    check(
      oversized.reason === 'capture-budget' && ledger.bytes === baseline,
      'over pixel boundary allocates no reservation',
    );
    return {
      checks,
      bytes: ledger.bytes - baseline,
      adapter: {
        vendor: service.adapterInfo.vendor,
        architecture: service.adapterInfo.architecture,
        description: service.adapterInfo.description,
      },
    };
  } finally {
    gate.resolve();
    effects.forEach((effect) => effect.dispose());
    await Promise.all(effects.map((effect) => effect.ready));
    service.destroy();
    host.remove();
  }
}
