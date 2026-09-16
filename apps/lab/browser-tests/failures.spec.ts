import { expect, test } from '@playwright/test';

import type {} from '../src/manual.js';

test('failure identity preserves reasons, diagnostics, settlement and cleanup', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/manual.html');
  await expect(page.locator('#state')).toContainText('"lifecycle":"active"');
  const checks = await page.evaluate(() => {
    window.manual.effect.dispose();
    return window.manual.verifyFailureClassification();
  });
  await testInfo.attach('failure-classification.json', {
    body: JSON.stringify(checks, null, 2),
    contentType: 'application/json',
  });
  expect(checks.length).toBeGreaterThan(400);
  expect(errors).toEqual([]);
});

for (const phase of ['initial', 'refresh'] as const) {
  test(`GPU validation retains its cause and renderer reason during ${phase}`, async ({ page }) => {
    await page.goto('/manual.html');
    await expect(page.locator('#state')).toContainText('"lifecycle":"active"');
    const result = await page.evaluate(async (phase) => {
      const host = document.querySelector<HTMLElement>('#manual-host');
      const target = document.querySelector<HTMLElement>('#manual-target');
      if (!host || !target) {
        throw new Error('fixture');
      }
      let effect = window.manual.effect;
      if (phase === 'initial') {
        effect.dispose();
      }
      const popScope = GPUDevice.prototype.popErrorScope;
      const injected = new GPUValidationError('no-adapter');
      GPUDevice.prototype.popErrorScope = async function () {
        return (await popScope.call(this)) ?? injected;
      };
      try {
        if (phase === 'initial') {
          effect = window.manual.attach(target, { host });
        }
        const rejection: unknown = await effect.refresh().catch((error: unknown) => error);
        await effect.ready;
        return {
          reason: effect.reason,
          detail: effect.reasonDetail,
          lifecycle: effect.lifecycle,
          cause: rejection instanceof Error && rejection.cause === injected,
          layers: host.querySelectorAll('canvas').length,
        };
      } finally {
        GPUDevice.prototype.popErrorScope = popScope;
        effect.dispose();
      }
    }, phase);
    expect(result).toEqual({
      reason: 'renderer-failed',
      detail: 'no-adapter',
      lifecycle: 'unavailable',
      cause: true,
      layers: 0,
    });
  });
}
