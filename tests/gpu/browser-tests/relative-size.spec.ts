import { expect, test } from '@playwright/test';

import type {} from '../src/effects.js';

test.use({ deviceScaleFactor: 1 });
for (const kind of ['text', 'svg', 'image'] as const) {
  test(`material and pattern rendered reach/detail across 100/400 ${kind} border boxes`, async ({
    page,
  }, info) => {
    await page.goto('/effects.html');
    await page.waitForFunction(() => Boolean(window.verifyRelativeSizes));
    const result = await page.evaluate((kind) => window.verifyRelativeSizes(kind), kind);
    await info.attach('relative-size.json', {
      body: JSON.stringify({
        ...result,
        results: result.results.map(({ image: _image, ...sample }) => sample),
      }),
      contentType: 'application/json',
    });
    for (const sample of result.results) {
      await info.attach(`${sample.effect}-${sample.size}-${sample.fraction}.png`, {
        body: Buffer.from(sample.image.slice('data:image/png;base64,'.length), 'base64'),
        contentType: 'image/png',
      });
      const label = `${kind}/${sample.effect}/${sample.size}/${sample.fraction}`;
      expect(sample.maxOutside, label).toBeLessThanOrEqual(sample.reach + 9);
      expect(sample.maxInside, label).toBeLessThanOrEqual(
        Math.min(sample.depth + 7, sample.availableDepth),
      );
      expect(sample.boundaryAlpha, sample.effect).toBe(0);
      expect(sample.detailSamples, sample.effect).toBeGreaterThan(0);
      if (sample.materialDetailDifference !== undefined) {
        expect(sample.materialDetailPixels, label).toBeGreaterThan(0);
        expect(sample.materialDetailDifference, label).toBeLessThanOrEqual(1);
      }
      if (sample.matchedDifference !== undefined) {
        expect(
          sample.matchedDifference,
          `${kind}/${sample.effect}/${sample.reach}`,
        ).toBeLessThanOrEqual(2);
      }
    }
    for (const effect of new Set(result.results.map((sample) => sample.effect))) {
      const find = (size: number, fraction: number) => {
        const sample = result.results.find(
          (sample) =>
            sample.effect === effect && sample.size === size && sample.fraction === fraction,
        );
        if (!sample) {
          throw new Error('Missing size evidence');
        }
        return sample;
      };
      for (const fraction of [0.1, 0.2]) {
        const small = find(100, fraction);
        const large = find(400, fraction);
        // Reach is an envelope. Aggregate five deterministic times to demonstrate
        // useful increased travel without requiring an exact visible tip.
        expect(large.maxOutside, `${kind}/${effect}/${fraction}`).toBeGreaterThan(
          small.maxOutside * 1.5,
        );
        // A population of thresholded minimum-axis runs measures thickness, not
        // individual mark identity. One CSS pixel accommodates rasterized edges.
        if (!['frost', 'slime', 'burned-paper'].includes(effect)) {
          expect(
            (large.exteriorRunMedian + 1) / (small.exteriorRunMedian + 1),
            `${kind}/${effect}/${fraction}`,
          ).toBeLessThanOrEqual(2);
        }
      }
      expect(find(100, 0.2).maxOutside, `${kind}/${effect}/fraction`).toBeGreaterThan(
        find(100, 0.1).maxOutside,
      );
      if (kind === 'image' && !['contour-echoes', 'brush-fringe'].includes(effect)) {
        // The PNG contains a thick circle; text/other thin components can cap depth.
        expect(find(400, 0.2).maxInside, effect).toBeGreaterThan(find(100, 0.2).maxInside);
      }
    }
    expect(result.errors).toEqual([]);
    expect(result.managedBytes).toBe(0);
  });
}
