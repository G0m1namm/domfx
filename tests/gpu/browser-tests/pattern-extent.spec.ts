import { expect, test } from '@playwright/test';

import type {} from '../src/pattern-extent.js';

test('all fifteen relative patterns scale premultiplied strength and preserve seeks', async ({
  page,
}, info) => {
  await page.goto('/pattern-extent.html');
  await page.waitForFunction(() => Boolean(window.patternStrength));
  const result = await page.evaluate(() => window.patternStrength());
  await info.attach('pattern-strength.json', {
    body: JSON.stringify(result),
    contentType: 'application/json',
  });
  expect(result.errors).toEqual([]);
  expect(result.results).toHaveLength(15);
  for (const sample of result.results) {
    expect(sample.maximumError, sample.effect).toBeLessThanOrEqual(1);
    expect(sample, sample.effect).toMatchObject({
      nonempty: true,
      repeated: true,
      zeroStrength: true,
      zeroExtent: true,
    });
  }
});

for (const dpr of [1, 1.25, 2]) {
  test(`all relative patterns keep phase and full free margin with extra padding at DPR ${dpr}`, async ({
    page,
  }, info) => {
    await page.goto('/pattern-extent.html');
    await page.waitForFunction(() => Boolean(window.patternSupportChecks));
    const result = await page.evaluate((dpr) => window.patternSupportChecks(dpr), dpr);
    await info.attach('pattern-support.json', {
      body: JSON.stringify(result),
      contentType: 'application/json',
    });
    expect(result.errors).toEqual([]);
    for (const sample of result.results) {
      expect(sample.boundaryAlpha, sample.effect).toBe(0);
      expect(sample.maximumError, sample.effect).toBeLessThanOrEqual(2);
      expect(sample.extended, sample.effect).toBe(true);
    }
  });
}

test('public pattern attachments validate ownership, reserve resized fractional geometry and clean up', async ({
  page,
}, info) => {
  await page.goto('/pattern-extent.html');
  await page.waitForFunction(() => Boolean(window.publicPatternChecks));
  const result = await page.evaluate(() => window.publicPatternChecks());
  await info.attach('pattern-public.json', {
    body: JSON.stringify(result),
    contentType: 'application/json',
  });
  for (const sample of result.results) {
    expect(sample, sample.effect).toMatchObject({
      invalid: 5,
      active: true,
      empty: true,
      canvases: 0,
    });
    expect(sample.initialSize, sample.effect).toEqual(sample.expectedInitial);
    expect(sample.resizedSize, sample.effect).toEqual(sample.expectedResized);
  }
  expect(result.budget).toEqual({ lifecycle: 'unavailable', reason: 'capture-budget' });
});
