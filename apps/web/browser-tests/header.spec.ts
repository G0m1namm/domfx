import { expect, test } from '@playwright/test';

// These route and layout regressions must also pass when WebGPU is unavailable.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
});

for (const width of [360, 1440]) {
  for (const route of ['/', '/es/', '/effects/', '/es/effects/']) {
    test(`@routine header actions stay in place during startup and reload: ${route} at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      const actions = page.locator('.language-switcher, .star-cta, .nav-menu-button');
      const positions = () =>
        actions.evaluateAll((elements) =>
          elements
            .filter((element) => getComputedStyle(element).display !== 'none')
            .map((element) => {
              const { x, y, width, height } = element.getBoundingClientRect();
              return { x, y, width, height };
            }),
        );

      for (const reload of [false, true]) {
        let releaseScripts = () => {};
        const scriptsReady = new Promise<void>((resolve) => {
          releaseScripts = resolve;
        });
        await page.route('**/*', async (request) => {
          if (request.request().resourceType() === 'script') {
            await scriptsReady;
          }
          await request.continue();
        });

        try {
          if (reload) {
            await page.reload({ waitUntil: 'commit' });
          } else {
            await page.goto(route, { waitUntil: 'commit' });
          }
          await expect(page.locator('.site-nav')).toBeVisible();
          await page.evaluate(() => document.fonts.ready);
          await expect(page.locator('.header-search')).toBeHidden();
          const before = await positions();
          expect(before).toHaveLength(width === 360 ? 1 : 2);

          releaseScripts();
          await expect(page.locator('.header-search')).toBeVisible();
          expect(await positions()).toEqual(before);
        } finally {
          releaseScripts();
          await page.unrouteAll({ behavior: 'wait' });
        }
      }
    });
  }
}
