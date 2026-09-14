import { expect, test } from '@playwright/test';

import type {} from '../src/manual.js';

for (const dpr of [1, 2]) {
  test.describe(`fractional placement at DPR ${dpr}`, () => {
    test.use({ deviceScaleFactor: dpr });
    for (const clock of ['manual', 'ambient'] as const) {
      test(`${clock} paused paint follows layout and transforms without recapture`, async ({
        page,
        browser,
      }, testInfo) => {
        const errors: string[] = [];
        page.on('pageerror', (error) => errors.push(error.message));
        page.on('console', (message) => {
          if (message.type() === 'error') {
            errors.push(message.text());
          }
        });
        await page.goto('/manual.html');
        await expect(page.locator('#state')).toContainText('"lifecycle":"active"');
        await page.evaluate(async (clock) => {
          window.manual.effect.dispose();
          window.manual.placementFixture = await window.manual.createPlacementFixture(clock);
        }, clock);
        for (const step of ['initial', 'layout', 'ancestor', 'target', 'animation'] as const) {
          const sample = await page.evaluate(async (step) => {
            const fixture = window.manual.placementFixture!;
            if (step !== 'initial') {
              fixture.move(step);
            }
            for (let i = 0; i < 3; i += 1) {
              await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
            }
            return fixture.sample();
          }, step);
          await testInfo.attach(`${step}-geometry.json`, {
            body: JSON.stringify({
              browser: browser.version(),
              viewport: page.viewportSize(),
              ...sample,
            }),
            contentType: 'application/json',
          });
          await testInfo.attach(`${step}.png`, {
            body: await page.screenshot(),
            contentType: 'image/png',
          });
          expect(sample).toMatchObject({
            lifecycle: 'active',
            raster: 'fresh',
            time: 2.75,
            paused: true,
            captures: 1,
            renders: 1,
            samePixels: true,
            dpr,
          });
          for (const point of sample.points) {
            expect(point.errorPhysical).toBeLessThanOrEqual(1);
          }
        }
        await page.evaluate(() => window.manual.placementFixture!.dispose());
        await expect(page.locator('#placement-host')).toHaveCount(0);
        expect(errors).toEqual([]);
      });
    }
  });
}

for (const change of ['mixed-paint', 'descendant-transform', 'unsupported-transform'] as const) {
  test(`${change} cannot reuse the fresh raster as a placement-only change`, async ({ page }) => {
    await page.goto('/manual.html');
    await expect(page.locator('#state')).toContainText('"lifecycle":"active"');
    const result = await page.evaluate(async (change) => {
      window.manual.effect.dispose();
      const fixture = await window.manual.createPlacementFixture('manual');
      const target = document.querySelector<HTMLElement>('#placement-target')!;
      const marker = target.querySelector('rect')!;
      if (change === 'mixed-paint') {
        target.style.transform = 'translate(20.25px, 10.125px)';
        target.style.background = 'red';
        // Drain queued mutations in the same task as a control write.
        fixture.effect.time = 2.75;
      } else if (change === 'descendant-transform') {
        marker.style.transform = 'translate(2.25px, 3.5px)';
        fixture.effect.time = 2.75;
      } else {
        target.style.transform = 'rotate(15deg)';
        for (let i = 0; i < 2; i += 1) {
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        }
      }
      const canvas = document.querySelector<HTMLCanvasElement>('#placement-host > canvas');
      const result = {
        lifecycle: fixture.effect.lifecycle,
        raster: fixture.effect.raster,
        reason: fixture.effect.reason,
        hidden: !canvas || canvas.style.display === 'none',
        targetConnected: target.isConnected,
      };
      fixture.dispose();
      return result;
    }, change);
    expect(result).toEqual({
      lifecycle: change === 'unsupported-transform' ? 'unavailable' : 'suspended',
      raster: 'stale',
      reason: change === 'unsupported-transform' ? 'unsupported-placement' : 'stale-raster',
      hidden: true,
      targetConnected: true,
    });
  });
}
