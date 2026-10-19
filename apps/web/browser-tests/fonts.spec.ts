import { expect, test } from '@playwright/test';

for (const route of ['/', '/effects/']) {
  test(`${route} waits for fonts before capturing text`, async ({ page }) => {
    let releaseFonts = () => {};
    const fontGate = new Promise<void>((resolve) => {
      releaseFonts = resolve;
    });
    await page.route('**/fonts/*.woff2', async (request) => {
      await fontGate;
      await request.continue();
    });
    try {
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await page.locator('#frost').scrollIntoViewIfNeeded();
      expect(await page.evaluate(() => document.fonts.status)).toBe('loading');
      await expect(page.locator('#frost canvas')).toHaveCount(0);
      releaseFonts();
      await expect(page.locator('#frost canvas')).toHaveCount(1);
      expect(await page.evaluate(() => document.fonts.check('500 48px Cabinet'))).toBe(true);
    } finally {
      releaseFonts();
    }
  });
}
