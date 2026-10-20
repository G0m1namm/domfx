import { expect, test } from '@playwright/test';

import { effects } from '../src/content/effects.js';

test('every catalog entry opens the matching preview and generates its named public import', async ({
  page,
}) => {
  const browserImports: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/packages/domfx/dist/')) {
      browserImports.push(request.url());
    }
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/effects/');
  for (const effect of effects) {
    await page.getByRole('button', { name: `Try ${effect.name}`, exact: true }).click();
    await expect(page.locator('#dialog-title')).toHaveText(effect.name);
    await expect(page.locator('[data-code]')).toContainText(
      `import { ${effect.exportName} } from '@domfx/browser'`,
    );
    await expect(page.locator('[data-code]')).not.toContainText('undefined');
    await expect(page.getByRole('link', { name: 'Read the effect reference' })).toHaveAttribute(
      'href',
      `/docs/api/effects/${effect.id}`,
    );
    await page.getByRole('button', { name: 'Close preview' }).click();
  }
  expect(browserImports).toEqual([]);
});

for (const path of ['/', '/effects/']) {
  test(`${path} has complete content without JavaScript`, async ({ browser, baseURL }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
    try {
      const page = await context.newPage();
      await page.goto(path);
      await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page.locator('.effect-grid [data-card]')).toHaveCount(path === '/' ? 5 : 21);
      await expect(page.getByRole('link', { name: 'Read the setup guide' })).toHaveAttribute(
        'href',
        '/docs/standalone',
      );
      await expect(page.locator('[data-search-open]')).toBeHidden();
      await expect(page.locator('noscript p')).toBeVisible();
      await expect(page.locator('noscript p')).toContainText('Enable JavaScript');
      if (path === '/') {
        await page.getByRole('link', { name: 'For agents', exact: true }).click();
        await expect(page.locator('#agents-panel')).toBeVisible();
        await expect(page.locator('#agents-panel')).toContainText(
          'consumer skill is not published',
        );
      }
    } finally {
      await context.close();
    }
  });
}

for (const width of [320, 360, 768, 1440]) {
  test(`marketing content reflows at ${width}px`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await expect(page.locator('#hero-title')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    await page.getByRole('tab', { name: 'For agents' }).click();
    await expect(page.locator('#agents-panel')).toContainText('consumer skill is not published');
    await expect(page.getByRole('tab', { name: 'For agents' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await page.getByRole('tab', { name: 'For agents' }).press('ArrowLeft');
    await expect(page.getByRole('tab', { name: 'For humans' })).toBeFocused();
    await page.locator('.footer-baseline').scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    await expect(page.locator('[data-closing-pause]')).toBeDisabled();
  });
}

test('global search opens an unfeatured effect, zooms and restores keyboard focus', async ({
  page,
}) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
  await page.goto('/');
  const trigger = page.getByRole('button', { name: 'Search effects and documentation' });
  await trigger.click();
  await page.getByRole('searchbox').fill('circuits');
  await expect(
    page.locator('[data-search-group="documentation"] a[href="/docs/api/effects/circuits"]'),
  ).toBeVisible();
  await page.getByRole('searchbox').press('Enter');
  await expect(page.locator('#dialog-title')).toHaveText('Circuits');
  await expect(page.locator('#site-search')).not.toBeVisible();
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await expect(page.locator('[data-zoom-label]')).toHaveText('150%');
  await page.locator('.dialog-scene').press('+');
  await expect(page.locator('[data-zoom-label]')).toHaveText('200%');
  await page.locator('.dialog-scene').press('0');
  await expect(page.locator('[data-zoom-label]')).toHaveText('100%');
  await page.getByRole('button', { name: 'Close preview' }).click();
  await expect(trigger).toBeFocused();
  await trigger.press('ControlOrMeta+k');
  await page.getByRole('searchbox').fill('reduced motion');
  await expect(page.locator('[data-search-group="documentation"]')).toBeVisible();
  await page.getByRole('searchbox').press('Escape');
  await expect(trigger).toBeFocused();
});

test('copy reports success only after a write and supplies a manual fallback', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() =>
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async (text: string) => sessionStorage.setItem('copied', text) },
    }),
  );
  await page.goto('/');
  await page.getByRole('button', { name: 'Copy package install command' }).click();
  await expect(page.locator('.toast')).toHaveText('Copied to clipboard');
  expect(await page.evaluate(() => sessionStorage.getItem('copied'))).toBe(
    'pnpm add @domfx/browser',
  );
  await page.evaluate(() =>
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: async () => {
          throw new Error('Denied');
        },
      },
    }),
  );
  await page.getByRole('button', { name: 'Copy package install command' }).click();
  await expect(page.locator('.toast')).toContainText('Copy it manually: pnpm add @domfx/browser');
  await page.getByRole('button', { name: 'Try Frost', exact: true }).click();
  await page.getByRole('button', { name: 'Copy attachment code' }).click();
  const feedback = page.getByRole('dialog').locator('[data-copy-status]');
  await expect(feedback).toBeVisible();
  await expect(feedback).toContainText('Select and copy the attachment code above');
});

for (const stars of [49, 50]) {
  test(`GitHub CTA uses the approved label at ${stars} stars`, async ({ page }) => {
    await page.route('https://api.github.com/repos/G0m1namm/domfx', (route) =>
      route.fulfill({ json: { stargazers_count: stars } }),
    );
    await page.goto('/');
    await expect(page.locator('[data-star-label]')).toHaveText(
      stars < 50 ? 'Star on GitHub' : 'Stars',
    );
    if (stars >= 50) {
      await expect(page.locator('[data-star-count]')).toHaveText('50');
    } else {
      await expect(page.locator('[data-star-count]')).toBeHidden();
    }
  });
}

test('legacy examples route redirects to the complete gallery', async ({ page }) => {
  await page.goto('/examples');
  await expect(page).toHaveURL(/\/effects\/$/);
  await expect(page.locator('.effect-grid [data-card]')).toHaveCount(21);
});
