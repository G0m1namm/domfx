import { expect, test } from '@playwright/test';

import type {} from '../src/performance.js';

declare global {
  interface Window {
    measurementProbe: { gpuRequests: number; submitted: boolean; release?: () => void };
  }
}

for (const targets of [1, 2]) {
  test(`measurement records ${targets}-target batches, warmups and cleanup`, async ({
    page,
  }, info) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') {
        errors.push(message.text());
      }
    });
    const effect = targets === 1 ? 'fire' : 'frost';
    await page.goto(`/performance.html?targets=${targets}&warm&effect=${effect}`);
    await page.waitForFunction(() => window.domfxPerformance.outcome !== 'running');
    const report = await page.evaluate(() => window.domfxPerformance);
    await info.attach('measurements.json', {
      body: JSON.stringify(report),
      contentType: 'application/json',
    });
    expect(report.outcome).toBe('complete');
    expect(report.effect).toBe(effect);
    expect(report.firstRender?.cpuSubmitMs).toBeGreaterThanOrEqual(0);
    expect(report.firstRender?.queueCompleteMs).toBeGreaterThanOrEqual(
      report.firstRender!.cpuSubmitMs,
    );
    expect(errors).toEqual([]);
    expect(report.assets?.urls).toHaveLength(targets);
    expect(report.initialization?.totalMs).toBeGreaterThan(0);
    expect(report.initialization?.navigationToSdfMs).toBeGreaterThan(
      report.assets!.navigationToReadyMs,
    );
    expect(report.warmups).toHaveLength(3);
    expect(report.rebuilds).toHaveLength(30);
    for (const batch of [
      report.initialization!.firstRebuild,
      ...report.warmups,
      ...report.rebuilds,
    ]) {
      expect(batch.targets).toHaveLength(targets);
      expect(batch.totalMs).toBeGreaterThan(0);
      expect(batch.targets[0]).toMatchObject({ id: 'headline', width: 688, height: 256 });
      if (targets === 2) {
        expect(batch.targets[1]).toMatchObject({ id: 'raster', width: 320, height: 256 });
      }
      for (const target of batch.targets) {
        expect(target.captureMs).toBeGreaterThan(0);
        expect(target.prepareMs).toBeGreaterThan(0);
      }
    }
    expect(report.checks).toEqual({ sdfReadbacks: targets * 2, managedBytesAfterCleanup: 0 });
  });
}

test('asset readiness precedes initialization, which waits for GPU completion', async ({
  page,
}) => {
  let releaseFont!: () => void;
  const fontGate = new Promise<void>((resolve) => {
    releaseFont = resolve;
  });
  await page.route('**/block.ttf', async (route) => {
    await fontGate;
    await route.continue();
  });
  await page.addInitScript(() => {
    window.measurementProbe = { gpuRequests: 0, submitted: false };
    const requestAdapter = navigator.gpu.requestAdapter.bind(navigator.gpu);
    navigator.gpu.requestAdapter = async (options) => {
      window.measurementProbe.gpuRequests += 1;
      const adapter = await requestAdapter(options);
      if (!adapter) {
        return adapter;
      }
      const requestDevice = adapter.requestDevice.bind(adapter);
      adapter.requestDevice = async (descriptor) => {
        const device = await requestDevice(descriptor);
        const submitted = device.queue.onSubmittedWorkDone.bind(device.queue);
        device.queue.onSubmittedWorkDone = async () => {
          await submitted();
          if (!window.measurementProbe.submitted) {
            window.measurementProbe.submitted = true;
            await new Promise<void>((resolve) => {
              window.measurementProbe.release = resolve;
            });
          }
        };
        return device;
      };
      return adapter;
    };
  });
  try {
    await page.goto('/performance.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(window.domfxPerformance));
    expect(await page.evaluate(() => window.domfxPerformance.assets)).toBeUndefined();
    expect(await page.evaluate(() => window.measurementProbe.gpuRequests)).toBe(0);
    releaseFont();
    await page.waitForFunction(() => window.measurementProbe.submitted);
    expect(await page.evaluate(() => window.domfxPerformance.assets)).toBeDefined();
    expect(await page.evaluate(() => window.domfxPerformance.initialization)).toBeUndefined();
    await page.evaluate(() => window.measurementProbe.release?.());
    await page.waitForFunction(() => window.domfxPerformance.outcome !== 'running');
    expect(await page.evaluate(() => window.domfxPerformance.outcome)).toBe('complete');
  } finally {
    releaseFont();
  }
});

test('missing GPU retains asset evidence without inventing initialization samples', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'gpu', { value: undefined });
  });
  await page.goto('/performance.html?warm');
  await page.waitForFunction(() => window.domfxPerformance.outcome !== 'running');
  const report = await page.evaluate(() => window.domfxPerformance);
  expect(report.outcome).toBe('unavailable');
  expect(report.assets).toBeDefined();
  expect(report.initialization).toBeUndefined();
  expect(report.rebuilds).toEqual([]);
  expect(report.checks.managedBytesAfterCleanup).toBe(0);
});
