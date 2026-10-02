import { expect, test } from '@playwright/test';

import type {} from '../src/steady.js';

for (const targets of [0, 1, 2]) {
  test(`steady ${targets}-target trials retain activity, samples and cleanup`, async ({
    page,
  }, info) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`/steady.html?targets=${targets}`);
    await page.waitForFunction(() => window.domfxSteady.outcome !== 'running');
    const report = await page.evaluate(() => window.domfxSteady);
    await info.attach('steady.json', {
      body: JSON.stringify(report),
      contentType: 'application/json',
    });
    expect(errors).toEqual([]);
    expect(report.outcome).toBe('complete');
    expect(report.preparedCount).toBe(targets);
    expect(report.dimensions).toEqual(
      [
        { width: 688, height: 256 },
        { width: 320, height: 256 },
      ].slice(0, targets),
    );
    expect(report.trials).toHaveLength(5);
    for (const trial of report.trials) {
      expect(trial.durationMs).toBeGreaterThanOrEqual(2000);
      expect(trial.active).toBe(true);
      expect(trial.rafMs.length).toBeGreaterThan(1);
      expect(trial.renderedFrames).toEqual(Array(targets).fill(trial.cpuSubmitMs.length));
      expect(trial.gpuMs).toHaveLength(
        report.timestampQuery && targets ? trial.cpuSubmitMs.length : 0,
      );
      expect(trial.timestampPairsNs).toHaveLength(trial.gpuMs.length * targets);
      expect(trial.gpuMs.every((value) => Number.isFinite(value) && value >= 0)).toBe(true);
    }
    expect(report.managedBytesAfterCleanup).toBe(0);
    expect(await page.locator('canvas').count()).toBe(0);
  });
}

test('missing timestamps records responsiveness without GPU durations', async ({ page }) => {
  await page.addInitScript(() => {
    const requestAdapter = navigator.gpu.requestAdapter.bind(navigator.gpu);
    navigator.gpu.requestAdapter = async (options) => {
      const adapter = await requestAdapter(options);
      if (adapter) {
        Object.defineProperty(adapter, 'features', {
          value: new Set([...adapter.features].filter((feature) => feature !== 'timestamp-query')),
        });
      }
      return adapter;
    };
  });
  await page.goto('/steady.html?targets=2');
  await page.waitForFunction(() => window.domfxSteady.trials[0]?.rafMs.length > 2);
  await page.evaluate(() => {
    setTimeout(() => {
      const until = performance.now() + 80;
      while (performance.now() < until) {
        /* Deliberate page task; DevTools evaluation is not a Long Tasks entry. */
      }
    }, 0);
  });
  await page.waitForFunction(() => window.domfxSteady.outcome !== 'running');
  const report = await page.evaluate(() => window.domfxSteady);
  expect(report.outcome).toBe('complete');
  expect(report.timestampQuery).toBe(false);
  expect(
    report.trials.flatMap((trial) => trial.longTasks).some((entry) => entry.duration > 50),
  ).toBe(true);
  expect(report.trials).toHaveLength(5);
  expect(report.trials.every((trial) => trial.gpuMs.length === 0 && trial.rafMs.length > 1)).toBe(
    true,
  );
});

test('unavailable GPU cannot produce samples', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'gpu', { value: undefined });
  });
  await page.goto('/steady.html');
  await page.waitForFunction(() => window.domfxSteady.outcome !== 'running');
  const report = await page.evaluate(() => window.domfxSteady);
  expect(report.outcome).toBe('unavailable');
  expect(report.trials).toEqual([]);
  expect(report.managedBytesAfterCleanup).toBe(0);
});

test('visibility interruptions retain raw evidence but invalidate the run', async ({ page }) => {
  await page.goto('/steady.html?targets=1');
  await page.waitForFunction(() => window.domfxSteady.trials[0]?.rafMs.length > 2);
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await page.waitForFunction(() => window.domfxSteady.outcome !== 'running');
  const report = await page.evaluate(() => window.domfxSteady);
  expect(report.outcome).toBe('failed');
  expect(report.visibilityChanges).toBe(1);
  expect(report.trials.some((trial) => !trial.active)).toBe(true);
  expect(report.trials[0].rafMs.length).toBeGreaterThan(2);
  expect(report.managedBytesAfterCleanup).toBe(0);
});
