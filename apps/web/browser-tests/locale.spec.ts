import { expect, test } from '@playwright/test';

test('language links preserve query and matching anchors across marketing and docs', async ({
  page,
}) => {
  await page.goto('/docs/api/effects/fire/?mode=static#usage');
  await page.evaluate(() => {
    window.location.hash = 'controls';
  });
  await page.locator('.site-nav .language-links [data-language-link="es"]').click();
  await expect(page).toHaveURL(/\/docs\/es\/api\/effects\/fire\/\?mode=static#controls$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');

  await page.goto('/es/effects/?category=Energy#missing');
  await expect(page.locator('.site-nav .language-links [data-language-link="en"]')).toHaveAttribute(
    'href',
    '/effects/?category=Energy',
  );
});

test('language controls fit the approved header widths', async ({ page }) => {
  for (const width of [320, 360, 768, 1440]) {
    await page.setViewportSize({ width, height: 800 });
    for (const route of ['/es/', '/docs/es/introduction/']) {
      await page.goto(route);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width,
      );
      if (width < 701) {
        await expect(page.getByRole('button', { name: 'Abrir menú del sitio' })).toBeVisible();
      } else {
        await expect(page.locator('.site-nav .language-links')).toBeVisible();
      }
    }
  }
});

test('language controls remain operable with larger text', async ({ page }) => {
  for (const width of [320, 768]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/docs/es/introduction/');
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '200%';
    });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    );
    if (width === 320) {
      await expect(page.getByRole('button', { name: 'Abrir menú del sitio' })).toBeVisible();
    } else {
      await expect(page.locator('.site-nav .language-links')).toBeVisible();
    }
  }
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('desktop and mobile links reach equivalent pages', async ({ page, request }) => {
    await page.goto('/docs/es/introduction/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'es');
    await page.locator('.site-nav .language-links [data-language-link="en"]').click();
    await expect(page).toHaveURL(/\/docs\/introduction\/$/);

    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto('/es/effects/');
    await page.getByRole('button', { name: 'Abrir menú del sitio' }).focus();
    await page.keyboard.press('Enter');
    const menu = page.locator('#site-menu');
    await expect(menu).toBeVisible();
    await menu.getByRole('link', { name: 'English' }).focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/effects\/$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');

    expect((await request.get('/es/unknown/')).status()).toBe(404);
    expect((await request.get('/docs/es/unknown/')).status()).toBe(404);
  });
});
