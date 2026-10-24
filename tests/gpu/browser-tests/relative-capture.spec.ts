import { expect, test } from '@playwright/test';

import type {} from '../src/effects.js';

test('all 21 relative resolution listeners recapture on a synthetic event and detach on disposal', async ({
  page,
}, info) => {
  await page.goto('/effects.html');
  await page.waitForFunction(() => Boolean(window.qualifyRelativeResolutionListeners));
  const result = await page.evaluate(() => window.qualifyRelativeResolutionListeners());
  await info.attach('relative-resolution-listeners.json', {
    body: JSON.stringify(result),
    contentType: 'application/json',
  });
  expect(result.results).toHaveLength(21);
  for (const sample of result.results) {
    expect(sample, sample.effect).toMatchObject({
      refreshed: true,
      disposedCapturesStable: true,
      releasedBytes: 0,
    });
  }
  expect(result.canvases).toBe(0);
});

test.describe('public relative catalog at DPR 1', () => {
  test.use({ deviceScaleFactor: 1 });
  test('all 21 public effects retain strength and placement resources and resize from 100 to 400', async ({
    page,
  }, info) => {
    await page.goto('/effects.html');
    await page.waitForFunction(() => Boolean(window.qualifyRelativeCatalog));
    const result = await page.evaluate(() => window.qualifyRelativeCatalog());
    await info.attach('relative-catalog.json', {
      body: JSON.stringify(result),
      contentType: 'application/json',
    });
    expect(result.results).toHaveLength(21);
    for (const sample of result.results) {
      expect(sample, sample.effect).toMatchObject({
        stableStrength: true,
        stablePlacement: true,
        nonempty: true,
        zero: true,
        repeated: true,
        resizedState: 'active',
      });
      expect(sample.maximumStrengthError, sample.effect).toBeLessThanOrEqual(2);
      expect(sample.resizedWidth, sample.effect).toBeGreaterThan(sample.initialWidth * 3);
    }
    expect(result.releasedBytes).toBe(0);
    expect(result.canvases).toBe(0);
  });
});

for (const dpr of [1, 1.25, 2]) {
  for (const kind of ['flat', 'text', 'svg', 'image', 'image-integer']) {
    test(`all 21 relative effects preserve ${kind} capture phase and support at DPR ${dpr}`, async ({
      page,
    }, info) => {
      await page.goto('/effects.html');
      await page.waitForFunction(() => Boolean(window.qualifyRelativeCapture));
      const result = await page.evaluate(
        ([kind, dpr]) => window.qualifyRelativeCapture(kind, dpr),
        [kind, dpr] as const,
      );
      await info.attach('relative-capture.json', {
        body: JSON.stringify(result),
        contentType: 'application/json',
      });
      expect(result.box).toMatchObject(
        kind === 'image-integer' ? { width: 160, height: 100 } : { width: 160.5, height: 100.25 },
      );
      expect(result.mapping.a).toBeCloseTo(1 / dpr, 12);
      expect(result.mapping.d).toBeCloseTo(1 / dpr, 12);
      expect(result.mapping.e).toBe(-60);
      expect(result.mapping.f).toBe(-60);
      expect(result.padding).toMatchObject({ top: 60, left: 60 });
      for (const value of [result.padding.right, result.padding.bottom]) {
        expect(value).toBeGreaterThanOrEqual(60);
        expect(value).toBeLessThan(60 + 1 / dpr);
      }
      expect(result.maskDifferences).toBe(0);
      expect(result.sourceDifference).toBe(0);
      expect(result.sdfDifference).toBeLessThanOrEqual(0.125);
      expect(result.errors).toEqual([]);
      expect(result.results).toHaveLength(21);
      for (const sample of result.results) {
        expect(sample.maximumDifference, sample.effect).toBeLessThanOrEqual(2);
        expect(sample.boundaryAlpha, sample.effect).toBe(0);
      }
    });
  }
}
