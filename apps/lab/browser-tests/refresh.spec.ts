import { expect, test } from '@playwright/test';

import type {} from '../src/manual.js';

test('controlled refresh revisions settle in order and release every frame once', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/manual.html');
  await expect(page.locator('#state')).toContainText('"lifecycle":"active"');
  const checks = await page.evaluate(() => {
    // The fixture dispatches Document-wide resize signals. Keep the unrelated
    // manual example from refreshing against its reservation baseline.
    window.manual.effect.dispose();
    return window.manual.verifyRefresh();
  });
  await testInfo.attach('refresh-checks.json', {
    body: JSON.stringify(checks, null, 2),
    contentType: 'application/json',
  });
  expect(checks.length).toBeGreaterThan(50);
  expect(errors).toEqual([]);
});

test('explicit refresh replaces real changed DOM pixels on the same canvas @smoke', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/manual.html');
  await expect(page.locator('#state')).toContainText('"lifecycle":"active"');
  const result = await page.evaluate(async () => {
    const { effect, capture } = window.manual;
    const target = document.querySelector<HTMLElement>('#manual-target');
    const canvas = document.querySelector<HTMLCanvasElement>('#manual-host canvas');
    if (!target || !canvas) {
      throw new Error('fixture');
    }
    const initial = await capture(1.5, 0.85);
    target.style.borderRadius = '50%';
    target.style.width = '100px';
    const pending = effect.refresh();
    const hidden = canvas.style.display === 'none' && effect.raster === 'refreshing';
    await pending;
    const sameCanvas = canvas === document.querySelector('#manual-host canvas');
    const resized = canvas.width === 328; // (100 CSS px + 64 padding) at DPR 2.
    const replacement = await capture(1.5, 0.85);
    await effect.refresh();
    const repeated = await capture(1.5, 0.85);
    // A fresh attachment is an independent reference for the changed silhouette.
    effect.dispose();
    const host = document.querySelector<HTMLElement>('#manual-host');
    if (!host) {
      throw new Error('fixture');
    }
    const next = window.manual.attach(target, { host, seed: 314, time: 1.5, intensity: 0.85 });
    await next.ready;
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const reference = host.querySelector('canvas')?.toDataURL();
    const active = next.lifecycle;
    next.dispose();
    return {
      hidden,
      sameCanvas,
      resized,
      changed: initial !== replacement,
      repeated: replacement === repeated,
      reference: replacement === reference,
      width: canvas.width,
      active,
    };
  });
  expect(result).toEqual({
    hidden: true,
    sameCanvas: true,
    resized: true,
    changed: true,
    repeated: true,
    reference: true,
    width: 0,
    active: 'active',
  });
  expect(errors).toEqual([]);
  await testInfo.attach('changed-dom-refresh.json', {
    body: JSON.stringify(result),
    contentType: 'application/json',
  });
});

for (const transition of ['motion', 'visibility'] as const) {
  test(`runtime ${transition} invalidates a pending refresh without late paint`, async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const decode = HTMLImageElement.prototype.decode;
      HTMLImageElement.prototype.decode = async function () {
        await decode.call(this);
        if (document.documentElement.dataset.delayRefresh === 'true') {
          document.documentElement.dataset.captureWaiting = 'true';
          await new Promise<void>((resolve) =>
            document.addEventListener('release-capture', () => resolve(), { once: true }),
          );
          document.documentElement.dataset.captureFinished = 'true';
        }
      };
    });
    await page.goto('/manual.html');
    await expect(page.locator('#state')).toContainText('"lifecycle":"active"');
    await page.evaluate(() => {
      document.documentElement.dataset.delayRefresh = 'true';
      void window.manual.effect.refresh().then(
        () => {
          document.documentElement.dataset.settlement = 'resolved';
        },
        (error: Error) => {
          document.documentElement.dataset.settlement = error.message;
        },
      );
    });
    await expect(page.locator('html')).toHaveAttribute('data-capture-waiting', 'true');
    if (transition === 'motion') {
      await page.emulateMedia({ reducedMotion: 'reduce' });
    } else {
      await page.evaluate(() => {
        Object.defineProperty(document, 'hidden', { configurable: true, value: true });
        document.dispatchEvent(new Event('visibilitychange'));
      });
    }
    await expect(page.locator('html')).toHaveAttribute('data-settlement', 'refresh-invalidated');
    await page.evaluate(() => document.dispatchEvent(new Event('release-capture')));
    await expect(page.locator('html')).toHaveAttribute('data-capture-finished', 'true');
    await expect(page.locator('#manual-host canvas')).toBeHidden();
    expect(await page.evaluate(() => window.manual.effect.raster)).toBe('stale');
    await page.evaluate(() => {
      window.manual.effect.dispose();
    });
  });
}
