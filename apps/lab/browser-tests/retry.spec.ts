import { expect, test } from '@playwright/test';

import type {} from '../src/manual.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/manual.html');
  await page.evaluate(async () => {
    await window.manual.effect.ready;
    window.manual.effect.dispose();
  });
});

for (const stage of ['renderer', 'capture', 'prepare'] as const) {
  for (const transition of ['retry', 'loss', 'motion', 'dispose', 'detach'] as const) {
    test(`${transition} during ${stage} serializes retry and releases old work`, async ({
      page,
    }) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.evaluate(async (stage) => {
        const fixture = window.manual.createMotionFixture('respect', stage);
        fixture.effect.pause();
        window.manual.motionFixture = fixture;
        await fixture.entered;
      }, stage);
      if (transition === 'motion') {
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await expect
          .poll(() => page.evaluate(() => window.manual.motionFixture?.effect.reason))
          .toBe('reduced-motion');
        await page.emulateMedia({ reducedMotion: 'no-preference' });
      } else if (transition === 'loss') {
        await page.evaluate(() => window.manual.motionFixture?.loseDevice());
        // Before createRenderer returns, the attachment has no device to watch.
        if (stage !== 'renderer') {
          await expect
            .poll(() => page.evaluate(() => window.manual.motionFixture?.effect.reason))
            .toBe('device-lost');
        }
      }
      const result = await page.evaluate(async (transition) => {
        const f = window.manual.motionFixture;
        if (!f) {
          throw new Error('missing-retry-fixture');
        }
        const first = f.effect.retry();
        const second = f.effect.retry();
        let settled = false;
        void first.then(() => {
          settled = true;
        });
        await new Promise<void>((resolve) => setTimeout(resolve, 20));
        const waiting = { ...f.snapshot(), settled, coalesced: first === second };
        f.effect.time = 9;
        f.effect.intensity = 0.4;
        if (transition === 'dispose') {
          f.effect.dispose();
        } else if (transition === 'detach') {
          f.target.remove();
          f.host.append(f.target);
        }
        f.release();
        await Promise.all([first, second, f.effect.ready]);
        const recovered = f.snapshot();
        const controls = {
          time: f.effect.time,
          intensity: f.effect.intensity,
          seed: f.effect.seed,
          paused: f.effect.paused,
        };
        f.dispose();
        return { waiting, recovered, controls, disposed: f.snapshot() };
      }, transition);
      expect(result.waiting).toMatchObject({
        settled: false,
        coalesced: true,
        services: 1,
        canvases: 0,
      });
      if (transition === 'dispose' || transition === 'detach') {
        expect(result.recovered).toMatchObject({ lifecycle: 'disposed', services: 1, canvases: 0 });
      } else {
        expect(result.recovered).toMatchObject({
          lifecycle: 'active',
          raster: 'fresh',
          services: 2,
          serviceDestroys: 1,
          canvases: 1,
        });
        expect(result.recovered.times).toEqual([9]);
      }
      expect(result.controls).toEqual({ time: 9, intensity: 0.4, seed: 314, paused: true });
      expect(result.disposed).toMatchObject({ managedBytes: 0, reservedBytes: 0, canvases: 0 });
      expect(result.disposed.releases).toBe(result.disposed.captures);
      expect(result.disposed.destroys).toBe(result.disposed.preparations);
      expect(result.disposed.serviceDestroys).toBe(result.disposed.services);
      expect(errors).toEqual([]);
    });
  }
}

test('retry rechecks motion at admission and during the new generation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(async () => {
    const f = window.manual.createMotionFixture('respect');
    window.manual.motionFixture = f;
    await f.effect.ready;
    await f.effect.retry();
  });
  expect(await page.evaluate(() => window.manual.motionFixture?.snapshot())).toMatchObject({
    lifecycle: 'unavailable',
    reason: 'reduced-motion',
    services: 0,
    captures: 0,
  });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.evaluate(async () => {
    const f = window.manual.motionFixture;
    if (!f) {
      throw new Error('missing-retry-fixture');
    }
    f.block('prepare');
    void f.effect.retry();
    await f.entered;
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect
    .poll(() => page.evaluate(() => window.manual.motionFixture?.effect.reason))
    .toBe('reduced-motion');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.evaluate(async () => {
    const f = window.manual.motionFixture;
    if (!f) {
      throw new Error('missing-retry-fixture');
    }
    const pending = f.effect.retry();
    f.release();
    await pending;
  });
  expect(await page.evaluate(() => window.manual.motionFixture?.snapshot())).toMatchObject({
    lifecycle: 'suspended',
    reason: 'reduced-motion',
    reservedBytes: 0,
    canvases: 0,
  });
  const recovered = await page.evaluate(async () => {
    const f = window.manual.motionFixture;
    if (!f) {
      throw new Error('missing-retry-fixture');
    }
    f.effect.pause();
    await f.effect.retry();
    const state = f.snapshot();
    f.dispose();
    return state;
  });
  expect(recovered).toMatchObject({ lifecycle: 'active', raster: 'fresh', canvases: 1 });
});

test('retry rechecks composition, assets, budgets, visibility and ownership', async ({ page }) => {
  const checks = await page.evaluate(() => window.manual.verifyRetryConditions());
  expect(checks.length).toBeGreaterThanOrEqual(14);
});
