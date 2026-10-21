import { expect, test } from '@playwright/test';

import type {} from '../src/assets.js';

for (const dpr of [1, 2]) {
  test.describe(`capture alignment at DPR ${dpr}`, () => {
    test.use({ deviceScaleFactor: dpr });

    test('positioned paint keeps its target-local coordinates at every padding', async ({
      page,
      browser,
    }, testInfo) => {
      await page.goto('/assets.html');
      const samples = await page.evaluate(async (dpr) => {
        const target = document.createElement('div');
        target.style.cssText =
          'position:relative;width:120.375px;height:80.625px;transform:translate(7.125px,3.25px) scale(1.2,.85)';
        target.innerHTML =
          '<svg width="120.375" height="80.625" style="display:block;overflow:visible">' +
          '<rect x="10.25" y="10.125" width="10" height="8" fill="red"/>' +
          '<rect x="85.625" y="15.25" width="10" height="8" fill="lime"/>' +
          '<rect x="-8.25" y="-6.125" width="4" height="4" fill="blue"/>' +
          '<rect x="126.25" y="86.125" width="4" height="4" fill="magenta"/>' +
          '</svg>';
        document.querySelector('#host')!.append(target);
        const original = target.outerHTML;
        const samples = [];
        try {
          for (const padding of [0, 32, 80]) {
            const frame = await window.assets.captureElement(target, { paddingCss: padding, dpr });
            try {
              const landmarks = [
                [255, 0, 0],
                [0, 255, 0],
                [0, 0, 255],
                [255, 0, 255],
              ].map((color) => {
                let weight = 0;
                let x = 0;
                let y = 0;
                for (let row = 0; row < frame.height; row += 1) {
                  for (let column = 0; column < frame.width; column += 1) {
                    const offset = (row * frame.width + column) * 4;
                    if (
                      color.some(
                        (value, channel) => Math.abs(frame.pixels[offset + channel] - value) > 8,
                      )
                    ) {
                      continue;
                    }
                    const alpha = frame.pixels[offset + 3] / 255;
                    weight += alpha;
                    x += (column + 0.5) * alpha;
                    y += (row + 0.5) * alpha;
                  }
                }
                return {
                  weight,
                  x: (x / weight) * frame.pixelToLocal.a + frame.pixelToLocal.e,
                  y: (y / weight) * frame.pixelToLocal.d + frame.pixelToLocal.f,
                };
              });
              samples.push({ padding, landmarks, preserved: target.outerHTML === original });
            } finally {
              frame.release();
            }
          }
        } finally {
          target.remove();
        }
        return samples;
      }, dpr);
      await testInfo.attach('capture-alignment.json', {
        body: JSON.stringify({ browser: browser.version(), dpr, samples }),
        contentType: 'application/json',
      });
      const centers = [
        [15.25, 14.125],
        [90.625, 19.25],
        [-6.25, -4.125],
        [128.25, 88.125],
      ];
      for (const sample of samples) {
        expect(sample.preserved).toBe(true);
        for (const [index, landmark] of sample.landmarks.entries()) {
          if (sample.padding === 0 && index >= 2) {
            expect(landmark.weight).toBe(0);
            continue;
          }
          expect(landmark.weight).toBeGreaterThan(0);
          expect(Math.abs(landmark.x - centers[index][0]) * dpr).toBeLessThanOrEqual(1);
          expect(Math.abs(landmark.y - centers[index][1]) * dpr).toBeLessThanOrEqual(1);
        }
      }
      await expect(page.locator('#snapdom-sandbox')).toHaveCount(0);
    });
  });
}
