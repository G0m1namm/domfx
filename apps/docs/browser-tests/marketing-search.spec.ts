import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

const pagefindPath = '**/docs/pagefind/pagefind.js';

async function openSearch(page: Page, locale: 'en' | 'es' = 'en') {
  await page.goto(locale === 'es' ? '/es/' : '/');
  const name =
    locale === 'es' ? 'Buscar efectos y documentación' : 'Search effects and documentation';
  await page.getByRole('button', { name, exact: true }).click();
  return page.getByRole('searchbox', { name });
}

test('marketing searches the built docs index and generated effect references', async ({
  page,
}) => {
  const input = await openSearch(page);
  const indexRequest = page.waitForRequest(pagefindPath);
  await input.fill('installation');
  await indexRequest;
  const docs = page.locator('[data-search-group="documentation"]');
  await expect(docs.locator('a[href="/docs/installation/"]')).toBeVisible();
  await input.fill('attachElectricity');
  const reference = docs.locator('a[href="/docs/api/effects/electricity/"]');
  await expect(reference).toBeVisible();
  await reference.click();
  await expect(page).toHaveURL(/\/docs\/api\/effects\/electricity\/$/);
});

test('a delayed docs index respects the latest query and closed dialog', async ({ page }) => {
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(pagefindPath, async (route) => {
    await gate;
    await route.continue();
  });
  const input = await openSearch(page);
  const indexRequest = page.waitForRequest(pagefindPath);
  await input.fill('installation');
  await indexRequest;
  await input.fill('attachElectricity');
  release();
  const docs = page.locator('[data-search-group="documentation"]');
  await expect(docs.locator('a[href="/docs/api/effects/electricity/"]')).toBeVisible();
  await expect(docs.locator('a[href="/docs/installation/"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Close search', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Search effects and documentation', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Control+k');
  await expect(input).toHaveValue('');
  await expect(docs.locator('a')).toHaveCount(0);
});

test('effects remain searchable when the docs index cannot load', async ({ page }) => {
  await page.route(pagefindPath, (route) => route.abort());
  const input = await openSearch(page);
  await input.fill('frost');
  await expect(page.locator('.site-search-status')).toContainText(
    'Documentation search is unavailable',
  );
  await page.locator('[data-search-effect="frost"]').click();
  await expect(page.locator('.effect-dialog')).toBeVisible();
  await expect(page.locator('#dialog-title')).toHaveText('Frost');
});

test('Spanish marketing search finds translated effects and same-language documentation', async ({
  page,
}) => {
  const input = await openSearch(page, 'es');
  await expect(page.locator('.site-search-status')).toHaveText('Efectos y documentación');
  await input.fill('energia');
  await expect(page.locator('[data-search-effect="electricity"]')).toBeVisible();
  await input.fill('attachElectricity');
  await expect(page.locator('[data-search-effect="electricity"]')).toBeVisible();
  const docs = page.locator('[data-search-group="documentation"]');
  await expect(docs.locator('a[href="/docs/es/api/effects/electricity/"]')).toBeVisible();
  await expect(docs.locator('a[href^="/docs/"]:not([href^="/docs/es/"])')).toHaveCount(0);
  await input.fill('instalación');
  const installation = docs.locator('a[href="/docs/es/installation/"]');
  await expect(installation).toBeVisible();
  await expect(installation.locator('strong')).toHaveText('Instalación');
  await expect(page.locator('.site-search-status')).toContainText('resultados');
  await input.fill('efecto');
  await expect(page.locator('.site-search-status')).toContainText('se muestran los primeros 10');
  await input.fill('zznocomparablezz');
  await expect(page.locator('.site-search-status')).toHaveText('0 resultados');
  await expect(page.locator('.site-search-empty')).toBeVisible();
});

test('Spanish marketing search localizes loading and unavailable states', async ({ page }) => {
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(pagefindPath, async (route) => {
    await gate;
    await route.abort();
  });
  const input = await openSearch(page, 'es');
  const indexRequest = page.waitForRequest(pagefindPath);
  await input.fill('frost');
  await indexRequest;
  await expect(page.locator('.site-search-status')).toHaveText('Buscando documentación…');
  release();
  await expect(page.locator('.site-search-status')).toContainText('no está disponible');
  await expect(page.locator('.site-search-status a[href="/docs/es/introduction/"]')).toBeVisible();
  await expect(page.locator('[data-search-effect="frost"]')).toBeVisible();
});

test('built-in docs search stays in the current language', async ({ page }) => {
  for (const [path, expected] of [
    ['/docs/installation/', '/docs/api/effects/frost/'],
    ['/docs/es/installation/', '/docs/es/api/effects/frost/'],
  ]) {
    await page.goto(path);
    await page.locator('button[data-open-modal]').click();
    const search = page.locator('site-search dialog');
    await search.getByRole('textbox').fill('frost');
    await expect(search.locator(`a[href="${expected}"]`).first()).toBeVisible();
    const otherLocale = path.includes('/es/')
      ? '/docs/api/effects/frost/'
      : '/docs/es/api/effects/frost/';
    await expect(search.locator(`a[href="${otherLocale}"]`)).toHaveCount(0);
  }
});
