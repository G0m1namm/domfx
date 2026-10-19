import { expect, test } from '@playwright/test';

// Exercise real navigation and controls when decorative GPU output is unavailable.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
});

for (const width of [360, 1440]) {
  test(`home and gallery remain usable without GPU at ${width}px`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await expect(page.locator('#hero-title')).toBeVisible();
    await expect(page.locator('.effect-grid [data-card]')).toHaveCount(5);
    await expect(page.locator('[data-filter]')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    await page.getByRole('button', { name: 'Try Frost', exact: true }).click();
    await expect(page.locator('[data-preview-status]')).toContainText('WebGPU is unavailable');
    await expect(page.locator('.dialog-stage canvas')).toHaveCount(0);
    await page.getByRole('button', { name: 'Close preview' }).click();
    await page.getByRole('link', { name: 'Explore all 21 effects' }).click();
    await expect(page).toHaveURL(/\/effects\/$/);
    await expect(page.locator('.effect-grid [data-card]')).toHaveCount(21);
    await page.getByRole('button', { name: 'Material', exact: true }).click();
    await expect(page.locator('.effect-grid [data-card]:visible')).toHaveCount(3);
    await expect(page.locator('[data-count]')).toHaveText('3');
    const sizes = await page
      .locator('.effect-grid [data-card]:visible .card-art')
      .evaluateAll((elements) => elements.map((el) => el.getBoundingClientRect().height));
    expect(new Set(sizes).size).toBe(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
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
