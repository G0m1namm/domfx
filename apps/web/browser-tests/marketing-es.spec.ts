import { expect, test } from '@playwright/test';

import { effects } from '@domfx/site/effects';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
});

test('Spanish home and all gallery cards render complete copy and localized routes', async ({
  page,
}) => {
  await page.goto('/es/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Dale a tu HTML');
  await expect(page.getByRole('link', { name: /Explora los 21 efectos/ })).toHaveAttribute(
    'href',
    '/es/effects/',
  );
  await expect(page.getByRole('link', { name: 'Lee la guía de instalación' })).toHaveAttribute(
    'href',
    '/docs/es/standalone/',
  );
  await page.goto('/es/effects/');
  await expect(page.locator('[data-card]')).toHaveCount(effects.length);
  for (const effect of effects) {
    const card = page.getByRole('button', { name: `Probar ${effect.name}` });
    await expect(card.locator('p')).not.toBeEmpty();
  }
  await expect(page.getByRole('button', { name: 'Energía' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Patrones' })).toBeVisible();
});

test('Spanish preview retains keyboard, fallback, localized reference and executable code', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto('/es/effects/');
  const card = page.getByRole('button', { name: 'Probar Frost' });
  await card.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Frost' });
  await expect(dialog).toBeVisible();
  await expect(page.locator('[data-preview-status]')).toContainText('WebGPU no está disponible');
  await expect(dialog.getByRole('link', { name: 'Lee la referencia del efecto' })).toHaveAttribute(
    'href',
    '/docs/es/api/effects/frost/',
  );
  await expect(page.locator('[data-code]')).toContainText(
    "import { attachFrost } from '@domfx/browser'",
  );
  const spanishCode = await page.locator('[data-code]').textContent();
  await dialog.getByRole('button', { name: 'Ampliar' }).click();
  await expect(page.locator('[data-zoom-label]')).toHaveText('150%');
  await page.locator('.dialog-scene').press('0');
  await expect(page.locator('[data-zoom-label]')).toHaveText('100%');
  await page.keyboard.press('Escape');
  await expect(card).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  await page.goto('/effects/');
  await page.getByRole('button', { name: 'Try Frost' }).click();
  await expect(page.locator('[data-code]')).toHaveText(spanishCode ?? '');
});

test('Spanish effect terms and API names find the same gallery effect', async ({ page }) => {
  await page.goto('/es/');
  await page.getByRole('button', { name: 'Buscar efectos y documentación' }).click();
  const search = page.getByRole('searchbox');
  await search.fill('hielo');
  await expect(page.locator('[data-search-effect="frost"]')).toBeVisible();
  await search.fill('attachFrost');
  await expect(page.locator('[data-search-effect="frost"]')).toBeVisible();
  await search.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Frost' })).toBeVisible();
});

for (const width of [320, 360, 768, 1440]) {
  test(`Spanish marketing content reflows at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ['/es/', '/es/effects/']) {
      await page.goto(route);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    }
  });
}

test('Spanish labels remain operable with larger text at narrow width', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto('/es/effects/');
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  await page.getByRole('button', { name: 'Probar Frost' }).click();
  await expect(page.getByRole('dialog', { name: 'Frost' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  await page.getByRole('button', { name: 'Cerrar vista previa' }).click();
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('Spanish HTML, navigation and support limits remain available', async ({ page }) => {
    await page.goto('/es/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Dale a tu HTML');
    await expect(page.locator('.story-faq')).toContainText('El HTML original sigue disponible.');
    await page.goto('/es/effects/');
    await expect(page.locator('[data-card]')).toHaveCount(21);
    await expect(page.getByRole('link', { name: 'Tu primer efecto' })).toHaveAttribute(
      'href',
      '/docs/es/standalone/',
    );
  });
});
