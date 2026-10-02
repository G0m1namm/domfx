import { expect, test } from '@playwright/test';

import type {} from '../src/manual.js';

for (const stage of ['renderer', 'capture', 'prepare'] as const) {
  for (const phase of ['initial', 'refresh', 'active'] as const) {
    if (
      (stage === 'renderer' && phase === 'refresh') ||
      (phase === 'active' && stage !== 'prepare')
    ) {
      continue;
    }
    test(`reduced motion during ${phase === 'active' ? 'active output' : `${phase} ${stage}`} releases allocations`, async ({
      page,
    }) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto('/manual.html');
      await page.evaluate(
        async ({ stage, phase }) => {
          await window.manual.effect.ready;
          window.manual.effect.dispose();
          const fixture = window.manual.createMotionFixture(
            'respect',
            phase === 'initial' ? stage : undefined,
          );
          window.manual.motionFixture = fixture;
          if (phase !== 'initial') {
            await fixture.effect.ready;
            fixture.block(stage);
          }
          if (phase === 'refresh') {
            void fixture.effect.refresh().catch((error: Error) => {
              document.documentElement.dataset.settlement = error.message;
            });
          }
          if (phase !== 'active') {
            await fixture.entered;
          }
        },
        { stage, phase },
      );
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await expect
        .poll(() => page.evaluate(() => window.manual.motionFixture?.snapshot().reason))
        .toBe('reduced-motion');
      const suspended = await page.evaluate(() => window.manual.motionFixture?.snapshot());
      expect(suspended).toMatchObject({
        lifecycle: 'suspended',
        raster: 'stale',
        canvases: 0,
        previousWidth: 0,
      });
      if (phase !== 'initial') {
        expect(suspended?.destroys).toBe(1);
      }
      if (phase === 'active') {
        expect(suspended).toMatchObject({ managedBytes: 0, reservedBytes: 0, serviceDestroys: 1 });
      }
      if (phase === 'refresh') {
        await expect(page.locator('html')).toHaveAttribute(
          'data-settlement',
          'refresh-invalidated',
        );
      }
      // Change back before the late result arrives: it must still be obsolete.
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await page.evaluate(async () => {
        const fixture = window.manual.motionFixture;
        if (!fixture) {
          throw new Error('missing-motion-fixture');
        }
        fixture.release();
        await fixture.effect.ready;
      });
      await expect
        .poll(() => page.evaluate(() => window.manual.motionFixture?.snapshot().reservedBytes))
        .toBe(0);
      const settled = await page.evaluate(() => window.manual.motionFixture?.snapshot());
      expect(settled).toMatchObject({
        lifecycle: 'suspended',
        reason: 'reduced-motion',
        managedBytes: 0,
        serviceDestroys: 1,
        canvases: 0,
      });
      expect(settled?.releases).toBe(settled?.captures);
      expect(settled?.destroys).toBe(settled?.preparations);
      if (phase === 'initial') {
        expect(settled?.times).toEqual([]);
      }
      const recovery = await page.evaluate(async () => {
        const fixture = window.manual.motionFixture;
        if (!fixture) {
          throw new Error('missing-motion-fixture');
        }
        fixture.effect.time = 9;
        fixture.effect.resume();
        const error = await fixture.effect.refresh().catch((error: Error) => error.message);
        fixture.dispose();
        fixture.dispose();
        return { error, state: fixture.snapshot() };
      });
      expect(recovery.error).toBe('reduced-motion');
      expect(recovery.state).toMatchObject({
        lifecycle: 'disposed',
        serviceDestroys: 1,
        managedBytes: 0,
        reservedBytes: 0,
      });
      expect(errors).toEqual([]);
    });
  }
}

for (const stage of ['capture', 'prepare'] as const) {
  for (const dispose of [false, true]) {
    test(`static ${stage} survives preference transitions${dispose ? ' and disposal' : ''}`, async ({
      page,
    }) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto('/manual.html');
      await page.evaluate(async (stage) => {
        const fixture = window.manual.createMotionFixture('static', stage);
        window.manual.motionFixture = fixture;
        await fixture.entered;
      }, stage);
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.evaluate(async (dispose) => {
        const fixture = window.manual.motionFixture;
        if (!fixture) {
          throw new Error('missing-motion-fixture');
        }
        if (dispose) {
          fixture.dispose();
        }
        fixture.release();
        await fixture.effect.ready;
      }, dispose);
      if (!dispose) {
        const result = await page.evaluate(async () => {
          const fixture = window.manual.motionFixture;
          if (!fixture) {
            throw new Error('missing-motion-fixture');
          }
          const before = fixture.pixels();
          const renders = fixture.stats.times.length;
          fixture.effect.resume();
          for (let i = 0; i < 4; i += 1) {
            await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
          }
          const ambientRenders = fixture.stats.times.length - renders;
          fixture.effect.time = 99;
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
          const after = fixture.pixels();
          await fixture.effect.refresh();
          return {
            before,
            after,
            refreshed: fixture.pixels(),
            ambientRenders,
            paused: fixture.effect.paused,
            times: fixture.stats.times,
          };
        });
        expect(result.before).toBeTruthy();
        expect(result.after).toBe(result.before);
        expect(result.refreshed).toBe(result.before);
        expect(result.ambientRenders).toBe(0);
        expect(result.paused).toBe(true);
        expect(result.times.every((time) => time === 0)).toBe(true);
        await page.emulateMedia({ reducedMotion: 'no-preference' });
        const restored = await page.evaluate(async () => {
          const fixture = window.manual.motionFixture;
          if (!fixture) {
            throw new Error('missing-motion-fixture');
          }
          fixture.effect.resume();
          for (let i = 0; i < 4; i += 1) {
            await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
          }
          const result = {
            pixels: fixture.pixels(),
            renders: fixture.stats.times.length,
            paused: fixture.effect.paused,
          };
          fixture.dispose();
          return result;
        });
        expect(restored.pixels).toBe(result.before);
        expect(restored.renders).toBe(result.times.length);
        expect(restored.paused).toBe(true);
      }
      const state = await page.evaluate(() => window.manual.motionFixture?.snapshot());
      expect(state).toMatchObject({
        lifecycle: 'disposed',
        managedBytes: 0,
        reservedBytes: 0,
        canvases: 0,
        serviceDestroys: 1,
      });
      expect(state?.releases).toBe(state?.captures);
      expect(state?.destroys).toBe(state?.preparations);
      if (dispose) {
        expect(state?.times).toEqual([]);
      }
      expect(errors).toEqual([]);
    });
  }
}
