import { expect, test } from '@playwright/test';

import type {} from '../src/manual.js';

for (const sharedHost of [false, true]) {
  for (const disposedIndex of [0, 1]) {
    test(`shared GPU with ${sharedHost ? 'one host' : 'separate hosts'}, dispose target ${disposedIndex}`, async ({
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
      const result = await page.evaluate(
        async ({ sharedHost, disposedIndex }) => {
          window.manual.effect.dispose();
          return window.manual.verifySharedTargets(sharedHost, disposedIndex);
        },
        { sharedHost, disposedIndex },
      );
      await testInfo.attach('shared-targets.json', {
        body: JSON.stringify({ browser: browser.version(), ...result }, null, 2),
        contentType: 'application/json',
      });
      expect(result.released).toEqual({ managedBytes: 0, bufferBytes: 0 });
      expect(result.scopes).toEqual({ open: 0, max: 1 });
      expect(errors).toEqual([]);
    });
  }
}

for (const mode of [
  'one-disposed',
  'all-disposed',
  'failure',
  'prepare',
  'prepare-failure',
] as const) {
  test(`shared initialization and cleanup: ${mode}`, async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') {
        errors.push(message.text());
      }
    });
    await page.goto('/manual.html');
    await expect(page.locator('#state')).toContainText('"lifecycle":"active"');
    const result = await page.evaluate(async (mode) => {
      window.manual.effect.dispose();
      return window.manual.verifySharedInitialization(mode);
    }, mode);
    await testInfo.attach('shared-initialization.json', {
      body: JSON.stringify(result, null, 2),
      contentType: 'application/json',
    });
    expect(result.initializationCalls).toBe(1);
    expect(result.scopes.open).toBe(0);
    expect(result.scopes.max).toBeLessThanOrEqual(1);
    expect(result.allocation).toEqual({ managedBytes: 0, bufferBytes: 0 });
    expect(errors).toEqual([]);
  });
}

for (const scenario of ['verifyDocumentIsolation', 'verifySharedDeviceLoss'] as const) {
  test(scenario, async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') {
        errors.push(message.text());
      }
    });
    await page.goto('/manual.html');
    await expect(page.locator('#state')).toContainText('"lifecycle":"active"');
    const result = await page.evaluate(async (scenario) => {
      window.manual.effect.dispose();
      return window.manual[scenario]();
    }, scenario);
    await testInfo.attach(`${scenario}.json`, {
      body: JSON.stringify(result, null, 2),
      contentType: 'application/json',
    });
    expect(result.allocation).toEqual({ managedBytes: 0, bufferBytes: 0 });
    expect(errors).toEqual([]);
  });
}

for (const stage of [
  'initialization',
  'capture',
  'pipelines',
  'prepare',
  'validation',
  'prepared',
] as const) {
  for (const refresh of stage === 'initialization' ? [false] : [false, true]) {
    test(`simulated shared loss during ${refresh ? 'refresh' : 'initial'} ${stage}`, async ({
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
      const result = await page.evaluate(
        async ({ stage, refresh }) => {
          window.manual.effect.dispose();
          return window.manual.verifySharedDeviceLoss(stage, refresh);
        },
        { stage, refresh },
      );
      await testInfo.attach('simulated-loss.json', {
        body: JSON.stringify({ browser: browser.version(), ...result }, null, 2),
        contentType: 'application/json',
      });
      expect(result.allocation).toEqual({ managedBytes: 0, bufferBytes: 0 });
      expect(errors).toEqual([]);
      await page.locator('#manual-target').click();
      await page.locator('#manual-target').press('Enter');
      await expect(page.locator('#clicks')).toHaveText('Target clicks: 2');
    });
  }
}

test('destroyed loss notification invalidates live owners', async ({ page }) => {
  await page.goto('/manual.html');
  await expect(page.locator('#state')).toContainText('"lifecycle":"active"');
  await page.evaluate(async () => {
    window.manual.effect.dispose();
    await window.manual.verifySharedDeviceLoss('active', false, 'destroyed');
  });
});
