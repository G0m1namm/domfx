import { type CaptureFrame, type EffectHandle } from '@domfx/browser';
import { attachFireWithAdapters, GpuExperiment, memoryFor } from '@domfx/browser/experimental';

function deferred() {
  let resolve = () => {};
  const promise = new Promise<void>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

/** Controlled adapter timing; rendering and canvas presentation still use WebGPU. */
export async function verifyRefresh() {
  const baseline = memoryFor(document).bytes;
  const checks: string[] = [];
  function check(condition: boolean, name: string) {
    if (!condition) {
      throw new Error(`refresh: ${name}`);
    }
    checks.push(name);
  }
  const host = document.createElement('div');
  host.style.cssText = 'position:relative;width:40px;height:40px';
  const target = document.createElement('div');
  target.style.cssText = 'width:7px;height:5px';
  host.append(target);
  document.body.append(host);
  const effects: EffectHandle[] = [];
  let targetCaptures = 0;
  let maxTargetCaptures = 0;
  try {
    async function fixture(onAttached?: () => void) {
      const service = await GpuExperiment.create();
      const events: string[] = [];
      const releases: number[] = [];
      const destroys: number[] = [];
      let captures = 0;
      let liveCaptures = 0;
      let maxCaptures = 0;
      let gate: ReturnType<typeof deferred> | undefined;
      let entered = deferred();
      let stage: 'capture' | 'prepare' = 'capture';
      let fail = false;
      let deviceDestroys = 0;
      const disposed = deferred();
      const effect = attachFireWithAdapters(
        target,
        { host, time: 1.5 },
        {
          capture: async () => {
            const id = captures++;
            liveCaptures += 1;
            targetCaptures += 1;
            maxTargetCaptures = Math.max(maxTargetCaptures, targetCaptures);
            maxCaptures = Math.max(maxCaptures, liveCaptures);
            const blocked = stage === 'capture' ? gate : undefined;
            const failure = fail && stage === 'capture';
            if (blocked) {
              entered.resolve();
              await blocked.promise;
            }
            liveCaptures -= 1;
            targetCaptures -= 1;
            if (failure) {
              throw new Error('controlled capture failure');
            }
            releases[id] = 0;
            const pixels = new Uint8Array(7 * 5 * 4);
            pixels[(2 * 7 + 3) * 4 + 3] = 255;
            const frame: CaptureFrame = {
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
            return frame;
          },
          createRenderer: async () => ({
            device: service.device,
            prepare: async (frame) => {
              const id = captures - 1;
              const prepared = await service.prepare(frame);
              const blocked = stage === 'prepare' ? gate : undefined;
              const failure = fail && stage === 'prepare';
              if (blocked) {
                entered.resolve();
                await blocked.promise;
              }
              destroys[id] = 0;
              if (failure) {
                prepared.destroy();
                destroys[id] += 1;
                throw new Error('controlled prepare failure');
              }
              return {
                ...prepared,
                present(texture) {
                  events.push(`present:${id}`);
                  prepared.present(texture);
                },
                destroy() {
                  destroys[id] += 1;
                  events.push(`destroy:${id}`);
                  prepared.destroy();
                },
              };
            },
            destroy() {
              deviceDestroys += 1;
              service.destroy();
              disposed.resolve();
            },
          }),
        },
      );
      effects.push(effect);
      onAttached?.();
      await Promise.all([effect.ready, effect.refresh()]);
      check(effect.lifecycle === 'active', 'initial capture commits');
      return {
        effect,
        events,
        releases,
        destroys,
        service,
        disposed: disposed.promise,
        get captures() {
          return captures;
        },
        get maxCaptures() {
          return maxCaptures;
        },
        get deviceDestroys() {
          return deviceDestroys;
        },
        block(nextStage: 'capture' | 'prepare', failure = false) {
          stage = nextStage;
          fail = failure;
          entered = deferred();
          gate = deferred();
          return entered.promise;
        },
        release() {
          const blocked = gate;
          gate = undefined;
          fail = false;
          blocked?.resolve();
        },
      };
    }

    // Superseded capture, including a failed one, must not settle newer requests.
    for (const failure of [false, true]) {
      const f = await fixture();
      const entered = f.block('capture', failure);
      const settlements: number[] = [];
      const first = f.effect.refresh().then(() => settlements.push(1));
      check(host.querySelector('canvas')?.style.display === 'none', 'refresh hides synchronously');
      await entered;
      const second = f.effect.refresh().then(() => settlements.push(2));
      const third = f.effect.refresh().then(() => settlements.push(3));
      await Promise.resolve();
      check(settlements.length === 0, 'superseded requests remain pending');
      f.release();
      await Promise.all([first, second, third]);
      check(settlements.join() === '1,2,3', 'requested-or-newer settlement order');
      check(f.captures === 3 && f.maxCaptures === 1, 'one capture and newest revision coalescing');
      check(
        f.events.join() === 'present:0,present:2,destroy:0',
        'replacement presents before previous release',
      );
      check(
        f.releases.every((count) => count === 1),
        'capture frames released once',
      );
      f.effect.dispose();
      check(
        f.destroys.every((count) => count === 1),
        'prepared frames released once',
      );
      check(
        f.service.managedBytes === 0 &&
          f.deviceDestroys === 1 &&
          memoryFor(document).bytes === baseline,
        'disposed renderer releases allocations',
      );
    }

    // A superseded prepared result owns GPU resources and must release them too.
    {
      const f = await fixture();
      const entered = f.block('prepare');
      const first = f.effect.refresh();
      await entered;
      const second = f.effect.refresh();
      f.release();
      await Promise.all([first, second]);
      check(
        f.events.join() === 'present:0,destroy:1,present:2,destroy:0',
        'late preparation never presents',
      );
      f.effect.dispose();
      check(
        f.releases.every((n) => n === 1) && f.destroys.every((n) => n === 1),
        'superseded preparation releases once',
      );
    }

    for (const stage of ['capture', 'prepare'] as const) {
      const f = await fixture();
      const entered = f.block(stage, true);
      // Both same-task requests are affected by the newest failure.
      const first = f.effect.refresh().catch((error: Error) => error.message);
      const second = f.effect.refresh().catch((error: Error) => error.message);
      await entered;
      f.release();
      check(
        (await first) === `controlled ${stage} failure` &&
          (await second) === `controlled ${stage} failure`,
        'newest failure rejects affected refreshes',
      );
      check(
        f.effect.raster === 'stale' && !host.querySelector('canvas'),
        'failure leaves stale output hidden',
      );
      check(f.deviceDestroys === 1 && f.service.managedBytes === 0, 'failure cleans renderer');
      check(
        f.releases.every((n) => n === 1) && f.destroys.every((n) => n === 1),
        'failed revision releases once',
      );
      check(
        (await f.effect.refresh().catch((error: Error) => error.message)) === 'effect-unavailable',
        'unavailable refresh rejects without retry',
      );
      f.effect.dispose();
      check(
        memoryFor(document).bytes === baseline,
        'revision cleanup restores reservation baseline',
      );
    }

    {
      const f = await fixture();
      await f.effect.refresh().then(() => f.effect.refresh());
      check(f.captures === 3, 'refresh from settlement callback starts new work');
      const entered = f.block('prepare');
      const invalidated = f.effect.refresh().catch((error: Error) => error.message);
      await entered;
      target.textContent = 'changed generation';
      await Promise.resolve();
      check((await invalidated) === 'refresh-invalidated', 'old generation rejects immediately');
      const replacement = f.effect.refresh();
      f.release();
      await replacement;
      check(
        f.effect.raster === 'fresh' && !f.events.includes('present:3'),
        'new generation survives late old preparation',
      );
      f.effect.dispose();
      check(
        f.releases.every((n) => n === 1) && f.destroys.every((n) => n === 1),
        'generation replacement releases once',
      );
      check(
        (await f.effect.refresh().catch((error: Error) => error.message)) === 'effect-disposed',
        'disposed refresh rejects',
      );
      target.textContent = '';
    }

    for (const stage of ['capture', 'prepare'] as const) {
      for (const transition of ['dispose', 'mutation', 'resize', 'detach'] as const) {
        const f = await fixture();
        const entered = f.block(stage);
        const result = f.effect.refresh().catch((error: Error) => error.message);
        await entered;
        if (transition === 'dispose') {
          f.effect.dispose();
        } else if (transition === 'mutation') {
          target.textContent = 'changed';
          await Promise.resolve();
        } else if (transition === 'resize') {
          window.dispatchEvent(new Event('resize'));
        } else {
          target.remove();
          f.effect.time = 2;
        }
        f.release();
        check(
          (await result) === (transition === 'dispose' ? 'effect-disposed' : 'refresh-invalidated'),
          `${stage}/${transition} rejects pending refresh`,
        );
        // Let the late adapter complete its finally before checking ownership.
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
        check(
          f.events.every((event) => event !== 'present:1'),
          `${stage}/${transition} prevents late commit`,
        );
        f.effect.dispose();
        // Observed invalidations can start another capture on an intervening
        // frame. Disposal must drain that work before asserting final cleanup.
        await f.disposed;
        check(
          f.releases.every((n) => n === 1) && f.destroys.every((n) => n === 1),
          `${stage}/${transition} releases once`,
        );
        check(
          f.deviceDestroys === 1 && f.service.managedBytes === 0,
          `${stage}/${transition} releases device`,
        );
        host.append(target);
        target.textContent = '';
      }
    }
    {
      const f = await fixture();
      const entered = f.block('capture');
      const cancelled = f.effect.refresh().catch((error: Error) => error.message);
      await entered;
      f.effect.dispose();
      const attached = deferred();
      const nextFixture = fixture(attached.resolve);
      await attached.promise;
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      f.release();
      const next = await nextFixture;
      check((await cancelled) === 'effect-disposed', 'old attachment refresh rejects');
      check(maxTargetCaptures === 1, 'reattachment waits for the old target capture');
      check(
        f.releases.every((n) => n === 1) && f.deviceDestroys === 1,
        'late old attachment releases ownership',
      );
      next.effect.dispose();
    }
    check(memoryFor(document).bytes === baseline, 'all refresh reservations released');
    return checks;
  } finally {
    for (const effect of effects) {
      effect.dispose();
    }
    host.remove();
  }
}
