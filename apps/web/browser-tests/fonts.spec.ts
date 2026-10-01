import { expect, test } from '@playwright/test';

for (const route of ['/', '/examples']) {
  test(`${route} waits for self-hosted fonts before capturing effects`, async ({ page }) => {
    let releaseFonts = () => {};
    const fontGate = new Promise<void>((resolve) => {
      releaseFonts = resolve;
    });
    let fontRequests = 0;
    await page.route('**/fonts/*.woff2', async (request) => {
      fontRequests += 1;
      await fontGate;
      await request.continue();
    });
    try {
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('#effect-status')).toContainText('Preparing');
      await expect.poll(() => fontRequests).toBeGreaterThan(0);
      expect(await page.evaluate(() => document.fonts.status)).toBe('loading');
      await expect(page.locator('canvas')).toHaveCount(0);
      releaseFonts();
      await expect(page.locator('.hero canvas')).toHaveCount(route === '/' ? 5 : 1);
      expect(await page.evaluate(() => document.fonts.check('500 48px "Cabinet Grotesk"'))).toBe(
        true,
      );
      expect(await page.evaluate(() => document.fonts.status)).toBe('loaded');
    } finally {
      releaseFonts();
    }
  });
}
