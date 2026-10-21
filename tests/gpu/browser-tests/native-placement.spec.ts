import { expect, test } from '@playwright/test';

test('native verification fixture exercises public placement and cleans up', async ({ page }) => {
  await page.goto('/placement-native.html');
  await page.getByRole('button', { name: 'Run placement checks' }).click();
  await expect(page.locator('#status')).toHaveText('passed');
  const result = JSON.parse((await page.locator('#report').textContent()) ?? '{}');
  expect(result).toMatchObject({ outcome: 'passed', errors: [], cleanup: true });
  expect(result.samples.map((sample: { step: string }) => sample.step)).toEqual([
    'initial',
    'nested-scroll',
    'paused-transform',
    'refresh',
    'reattach',
  ]);
  await expect(page.locator('#fixture canvas')).toHaveCount(0);
});

test('visual qualification waits for painted output at every placement step', async ({ page }) => {
  await page.goto('/placement-native.html');
  await page.getByRole('checkbox', { name: 'Confirm painted output visually' }).check();
  await page.getByRole('button', { name: 'Run placement checks' }).click();
  const confirmation = page.getByRole('button', { name: 'All three effects are visible' });
  for (const step of ['initial', 'nested-scroll', 'paused-transform', 'refresh', 'reattach']) {
    await expect(page.locator('#status')).toHaveText(`Inspect ${step}: text, SVG and image`);
    await expect(confirmation).toBeVisible();
    for (const layer of await page.locator('#fixture canvas').all()) {
      const screenshot = await layer.screenshot();
      // Read compositor output, independently of the WebGPU canvas snapshot API.
      const warmPixels = await page.evaluate(async (png) => {
        const image = new Image();
        image.src = `data:image/png;base64,${png}`;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const context = canvas.getContext('2d');
        if (!context) {
          throw new Error('missing-screenshot-context');
        }
        context.drawImage(image, 0, 0);
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
        let count = 0;
        for (let y = 0; y < canvas.height; y += 1) {
          // Exclude neighboring targets where the padded layer boxes overlap.
          for (let x = Math.ceil(canvas.width / 3); x < (canvas.width * 2) / 3; x += 1) {
            const offset = (y * canvas.width + x) * 4;
            if (pixels[offset] > 150 && pixels[offset] > pixels[offset + 2] + 60) {
              count += 1;
            }
          }
        }
        return count;
      }, screenshot.toString('base64'));
      expect(warmPixels).toBeGreaterThan(10);
    }
    await confirmation.click();
  }
  await expect(page.locator('#status')).toHaveText('passed');
  const result = JSON.parse((await page.locator('#report').textContent()) ?? '{}');
  expect(result.samples).toHaveLength(5);
  for (const sample of result.samples) {
    expect(sample).toMatchObject({
      paintVerification: 'visual-confirmation',
      paintConfirmed: true,
      painted: null,
      valid: true,
    });
  }
  await expect(page.locator('#fixture canvas')).toHaveCount(0);
  await expect(confirmation).toBeHidden();
});

test('leaving during visual confirmation cancels and cleans up the run', async ({ page }) => {
  await page.goto('/placement-native.html');
  const visualCheck = page.getByRole('checkbox', { name: 'Confirm painted output visually' });
  await visualCheck.check();
  const run = page.getByRole('button', { name: 'Run placement checks' });
  await run.click();
  await expect(page.locator('#status')).toHaveText('Inspect initial: text, SVG and image');
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide')));
  await expect(page.locator('#status')).toHaveText('failed');
  const result = JSON.parse((await page.locator('#report').textContent()) ?? '{}');
  expect(result).toMatchObject({ outcome: 'failed', cleanup: true });
  expect(result.samples[0]).toMatchObject({ paintConfirmed: false, valid: false });
  await expect(page.locator('#fixture canvas')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'All three effects are visible' })).toBeHidden();
  await expect(run).toBeEnabled();
  await visualCheck.uncheck();
  await run.click();
  await expect(page.locator('#status')).toHaveText('passed');
});
