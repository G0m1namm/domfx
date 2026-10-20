import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

const pagefindPath = '**/docs/pagefind/pagefind.js';

async function openSearch(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Search effects and documentation', exact: true }).click();
  return page.getByRole('searchbox', { name: 'Search effects and documentation' });
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
