import { expect, test } from '@playwright/test';

import type {} from '../src/assets.js';

for (const dpr of [1, 2]) {
  test.describe(`responsive capture at DPR ${dpr}`, () => {
    test.use({ deviceScaleFactor: dpr, viewport: { width: 390, height: 900 } });

    test('image paint retains its live size across breakpoints @smoke', async ({ page }) => {
      await page.goto('/assets.html');
      await page.evaluate(() => {
        const style = document.createElement('style');
        style.textContent = `
          #responsive-host { position: fixed; inset: 0 auto auto 0; width: 350px; height: 300px;
            display: flex; align-items: center; justify-content: center; padding-bottom: 58px;
            box-sizing: border-box; }
          #responsive-target { width: min(78%, 320px); height: 240px; object-fit: contain; }
          @media (max-width: 700px) {
            #responsive-target { width: min(76%, 250px); height: auto;
              max-height: calc(100% - 24px); }
          }
        `;
        const host = document.createElement('div');
        host.id = 'responsive-host';
        const image = document.createElement('img');
        image.id = 'responsive-target';
        image.src = '/asset-fixtures/split.png';
        host.append(image);
        document.head.append(style);
        document.body.append(host);
      });

      for (const width of [390, 320, 768, 1440, 390]) {
        await page.setViewportSize({ width, height: 900 });
        const result = await page.evaluate(async () => {
          const target = document.querySelector<HTMLImageElement>('#responsive-target')!;
          await target.decode();
          const before = target.outerHTML;
          const rect = target.getBoundingClientRect();
          const frame = await window.assets.captureElement(target);
          try {
            let left = frame.width;
            let top = frame.height;
            let right = 0;
            let bottom = 0;
            for (let y = 0; y < frame.height; y += 1) {
              for (let x = 0; x < frame.width; x += 1) {
                if (frame.pixels[(y * frame.width + x) * 4 + 3] >= 128) {
                  left = Math.min(left, x);
                  top = Math.min(top, y);
                  right = Math.max(right, x + 1);
                  bottom = Math.max(bottom, y + 1);
                }
              }
            }
            const mapping = frame.pixelToLocal;
            const actual = [
              left * mapping.a + mapping.e,
              top * mapping.d + mapping.f,
              right * mapping.a + mapping.e,
              bottom * mapping.d + mapping.f,
            ];
            const scale = Math.min(
              rect.width / target.naturalWidth,
              rect.height / target.naturalHeight,
            );
            const width = target.naturalWidth * scale;
            const height = target.naturalHeight * scale;
            const expected = [
              (rect.width - width) / 2,
              (rect.height - height) / 2,
              (rect.width + width) / 2,
              (rect.height + height) / 2,
            ];
            return {
              actual,
              expected,
              preserved: target.outerHTML === before,
              error: Math.max(...actual.map((value, index) => Math.abs(value - expected[index]))),
            };
          } finally {
            frame.release();
          }
        });
        expect(result.preserved).toBe(true);
        expect(result.error, JSON.stringify({ width, dpr, ...result })).toBeLessThanOrEqual(
          1 / dpr,
        );
      }
    });
  });
}
