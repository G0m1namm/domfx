import { expect, test } from '@playwright/test';

import type {} from '../src/stress.js';

// Keep seeds fixed for replay. Add any newly failing seed here before fixing its cause.
for (const seed of [29, 0x5eed]) {
  test(`seeded lifecycle races: ${seed}`, async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') {
        errors.push(message.text());
      }
    });
    await page.goto('/stress.html');
    const report = await page.evaluate((seed) => window.stress.runSeed(seed), seed);
    await testInfo.attach('seeded-lifecycle.json', {
      body: JSON.stringify(report, null, 2),
      contentType: 'application/json',
    });
    expect(report.operations).toBeGreaterThanOrEqual(500);
    expect(report.cycles).toBe(28);
    expect(errors).toEqual([]);
  });
}

test('public two-target browser/GPU soak', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') {
      errors.push(message.text());
    }
  });
  await page.goto('/stress.html');
  const report = await page.evaluate(() => window.stress.runSoak());
  await testInfo.attach('lifecycle-soak.json', {
    body: JSON.stringify(report, null, 2),
    contentType: 'application/json',
  });
  expect(report.iterations).toBe(24);
  expect(errors).toEqual([]);
});
