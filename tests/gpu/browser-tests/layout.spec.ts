import { expect, test } from '@playwright/test';

import type {} from '../src/layout.js';

test('public ambient fixture retains all 50 visible targets through sampling and refresh', async ({
  page,
}) => {
  await page.goto('/layout.html?count=50&effects=true');
  await page.waitForFunction(() => window.domfxLayout);
  const prepared = await page.evaluate(() => window.domfxLayout.prepare());
  expect(prepared.state.active).toBe(50);
  expect(prepared.state.unavailable).toEqual([]);
  expect(
    prepared.geometry.every(
      (rect) => rect.paddedVisible && rect.width === 24 && rect.height === 16,
    ),
  ).toBe(true);
  expect(prepared.rasters).toEqual(Array.from({ length: 50 }, () => ({ width: 176, height: 160 })));
  const trial = await page.evaluate(() => window.domfxLayout.sample(300));
  expect(trial.valid).toBe(true);
  expect(trial.minActive).toBe(50);
  expect(trial.maxSuspended).toBe(0);
  expect(trial.rafMs.length).toBeGreaterThan(0);
  const refresh = await page.evaluate(() => window.domfxLayout.refresh());
  expect(refresh.durationsMs).toHaveLength(50);
  expect(refresh.state.unavailable).toEqual([]);
  expect(await page.evaluate(() => window.domfxLayout.cleanup())).toEqual({
    disposed: true,
    layers: 0,
  });
});

test('matching no-effect fixture supplies intervals without active effects', async ({ page }) => {
  await page.goto('/layout.html?count=10');
  await page.waitForFunction(() => window.domfxLayout);
  const prepared = await page.evaluate(() => window.domfxLayout.prepare());
  expect(prepared.geometry).toHaveLength(10);
  expect(prepared.rasters).toEqual([]);
  const sample = await page.evaluate(() => window.domfxLayout.sample(100));
  expect(sample.valid).toBe(true);
  expect(sample.minActive).toBe(0);
  expect(await page.evaluate(() => window.domfxLayout.cleanup())).toEqual({
    disposed: true,
    layers: 0,
  });
});

test('unavailable effects and visibility interruptions cannot supply valid samples', async ({
  page,
}) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
  await page.goto('/layout.html?count=1&effects=true');
  await page.waitForFunction(() => window.domfxLayout);
  const prepared = await page.evaluate(() => window.domfxLayout.prepare());
  expect(prepared.state.unavailable).toEqual([{ reason: 'no-webgpu', detail: 'no-webgpu' }]);
  expect((await page.evaluate(() => window.domfxLayout.sample(100))).valid).toBe(false);
  expect(await page.evaluate(() => window.domfxLayout.cleanup())).toEqual({
    disposed: true,
    layers: 0,
  });
  await page.goto('/layout.html?count=1');
  await page.waitForFunction(() => window.domfxLayout);
  await page.evaluate(() => window.domfxLayout.prepare());
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  expect((await page.evaluate(() => window.domfxLayout.sample(100))).valid).toBe(false);
  await page.evaluate(() => window.domfxLayout.cleanup());
});
