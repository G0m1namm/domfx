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

for (const path of ['/docs/installation/', '/docs/standalone/', '/docs/gsap/']) {
  test(`${path} is readable without GPU`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const response = await page.goto(path);
    await page.waitForLoadState('networkidle');
    expect(response?.status()).toBe(200);
    await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator('main pre').first()).toBeVisible();
    expect(errors).toEqual([]);
  });
}

for (const width of [320, 360, 768, 1440]) {
  test(`docs effect controls remain aligned and contained at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/docs/api/effects/fire/', { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    const lab = page.locator('[data-docs-lab]');
    await lab.scrollIntoViewIfNeeded();
    const layout = await lab.evaluate((element) => {
      const box = element.getBoundingClientRect();
      const segments = Array.from(
        element.querySelectorAll('.docs-lab-segments label span'),
        (label) => label.getBoundingClientRect().toJSON(),
      );
      const controls = Array.from(
        element.querySelectorAll('.docs-lab-segments, .docs-lab-row input, .docs-lab-row output'),
        (control) => control.getBoundingClientRect().toJSON(),
      );
      const statusElement = element.querySelector('.docs-lab-status');
      const toggleElement = element.querySelector('.docs-lab-toggle');
      if (!statusElement || !toggleElement) {
        throw new Error('missing-lab-overlay-controls');
      }
      const status = statusElement.getBoundingClientRect();
      const toggle = toggleElement.getBoundingClientRect();
      return {
        box: box.toJSON(),
        segments,
        controls,
        statusCenter: status.top + status.height / 2,
        toggleCenter: toggle.top + toggle.height / 2,
      };
    });
    expect(
      Math.max(...layout.segments.map((box) => box.top)) -
        Math.min(...layout.segments.map((box) => box.top)),
    ).toBeLessThanOrEqual(1);
    expect(Math.abs(layout.statusCenter - layout.toggleCenter)).toBeLessThanOrEqual(1);
    for (const control of layout.controls) {
      expect(control.left).toBeGreaterThanOrEqual(layout.box.left);
      expect(control.right).toBeLessThanOrEqual(layout.box.right);
    }
    const facts = await page.locator('.docs-effect-facts > div').evaluateAll((elements) =>
      elements.map((element) => {
        const term = element.querySelector('dt');
        const description = element.querySelector('dd');
        if (!term || !description) {
          throw new Error('missing-effect-fact');
        }
        return {
          top: element.getBoundingClientRect().top,
          termLeft: term.getBoundingClientRect().left,
          descriptionLeft: description.getBoundingClientRect().left,
        };
      }),
    );
    expect(Math.abs(facts[0].top - facts[1].top)).toBeLessThanOrEqual(1);
    for (const fact of facts) {
      expect(Math.abs(fact.termLeft - fact.descriptionLeft)).toBeLessThanOrEqual(1);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}
