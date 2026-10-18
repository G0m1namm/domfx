import { expect, test } from '@playwright/test';

// Prove the website remains usable on runners without WebGPU. Actual rendering
// belongs to the explicitly invoked local GPU and visual suites.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
});

for (const width of [360, 1440]) {
  test(`home and examples remain usable without GPU at ${width}px`, async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await expect(page.locator('#hero-title')).toBeVisible();
    await expect(page.locator('#effect-status')).toContainText('WebGPU is unavailable');
    await expect(page.locator('.home-hero canvas')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    await testInfo.attach('home.png', { body: await page.screenshot(), contentType: 'image/png' });
    await page
      .getByRole('navigation', { name: 'Main navigation' })
      .getByRole('link', { name: 'Examples', exact: true })
      .click();
    await expect(page.locator('#example-image')).toBeInViewport();
    expect(
      await page
        .locator('#example-image')
        .evaluate(
          (image) => image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0,
        ),
    ).toBe(true);
    await page.getByRole('link', { name: 'SVG', exact: true }).click();
    await expect(page.locator('#example-svg')).toBeInViewport();
    await testInfo.attach('example.png', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
    expect(errors).toEqual([]);
  });
}

for (const path of ['/docs/installation', '/docs/standalone', '/docs/gsap']) {
  test(`${path} is readable without GPU`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator('main pre').first()).toBeVisible();
    expect(errors).toEqual([]);
  });
}
