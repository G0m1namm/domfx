import { expect, test } from '@playwright/test';

const pages = [
  ['Gallery', '/', 'Real elements. Remarkable edges.'],
  ['Manual', '/manual.html', 'Manual attachment'],
  ['GSAP', '/gsap.html', 'Timeline control'],
  ['Assets', '/assets.html', 'Capture assets'],
] as const;

for (const width of [360, 768, 1440]) {
  test(`lab navigation and controls fit at ${width}px with reduced motion`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    for (const [label, path, title] of pages) {
      await page
        .getByRole('navigation', { name: 'Lab navigation' })
        .getByRole('link', { name: label, exact: true })
        .click();
      await expect(page).toHaveURL((url) => url.pathname === path);
      await expect(page.getByRole('heading', { name: title, level: 1 })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      const controls = await page.locator('.ui-controls button, .site-nav a').evaluateAll((nodes) =>
        nodes.map((node) => {
          const rect = node.getBoundingClientRect();
          return { left: rect.left, right: rect.right, height: rect.height };
        }),
      );
      for (const rect of controls) {
        expect(rect.left).toBeGreaterThanOrEqual(0);
        expect(rect.right).toBeLessThanOrEqual(width);
        expect(rect.height).toBeGreaterThanOrEqual(44);
      }
      if (label === 'Gallery') {
        await expect(page.locator('#result-summary')).toContainText('UNAVAILABLE');
        await expect(page.locator('#transparent')).toBeVisible();
        expect(
          await page
            .locator('#transparent')
            .evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0),
        ).toBe(true);
        await page.getByText('Full experiment report · JSON', { exact: true }).click();
        await expect(page.locator('#report')).toBeVisible();
        await page.getByRole('button', { name: 'Rounded button', exact: true }).press('Enter');
        await expect(page.locator('#interaction')).toContainText('1');
      }
    }
  });
}

test.describe('static fallback', () => {
  test.use({ javaScriptEnabled: false, viewport: { width: 360, height: 800 } });
  test('all example pages retain content and navigation without JavaScript', async ({ page }) => {
    for (const [, path, title] of pages) {
      await page.goto(path);
      await expect(page.getByRole('heading', { name: title, level: 1 })).toBeVisible();
      await expect(page.locator('noscript .status-line')).toBeVisible();
      await expect(page.getByRole('navigation', { name: 'Lab navigation' })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    }
  });
});
