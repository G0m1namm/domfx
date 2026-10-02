import { expect, test } from '@playwright/test';

// Opt-in local comparisons. Baselines belong to one platform/backend and pinned
// Chromium; reviewing an update is required, especially after a GPU change.
for (const width of [360, 1440]) {
  test(`website without motion at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator('.hero canvas')).toHaveCount(0);
    await expect(page).toHaveScreenshot(`home-${width}.png`, { animations: 'disabled' });
  });
}

test('paused fire renders on the website', async ({ page, browser }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    sessionStorage.setItem('domfx-showcase', JSON.stringify({ effect: 'fire', paused: true }));
  });
  await page.goto('/');
  await page.getByRole('link', { name: 'Try the live elements' }).click();
  const layer = page.locator('.ring-slot--center canvas');
  await expect(layer).toHaveCount(1);
  await expect(layer).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('#effect-play')).toHaveText('Resume');
  await expect(page.locator('.image-step')).toHaveScreenshot('fire-image.png', {
    animations: 'disabled',
    maxDiffPixelRatio: 0.005,
  });
  const adapter = await page.evaluate(async () => {
    const gpu = (
      navigator as Navigator & {
        gpu?: {
          requestAdapter(): Promise<{
            info: { vendor: string; architecture: string; device: string; description: string };
          } | null>;
        };
      }
    ).gpu;
    const info = (await gpu?.requestAdapter())?.info;
    return info
      ? {
          vendor: info.vendor,
          architecture: info.architecture,
          device: info.device,
          description: info.description,
        }
      : null;
  });
  await testInfo.attach('environment.json', {
    body: JSON.stringify({
      browser: browser.version(),
      adapter,
      gpuBackend: testInfo.config.metadata.gpuBackend,
    }),
    contentType: 'application/json',
  });
  expect(errors).toEqual([]);
});
