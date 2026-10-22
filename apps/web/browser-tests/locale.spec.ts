import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { chromium, expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

async function expectHeaderControlsFit(page: Page) {
  const bounds = await page.locator('.nav-inner').evaluate((inner) => {
    const header = inner.closest('.site-nav')?.getBoundingClientRect();
    const controls = [...inner.children]
      .filter((element) => getComputedStyle(element).display !== 'none')
      .map((element) => element.getBoundingClientRect());
    return { header, controls };
  });
  expect(bounds.header).toBeTruthy();
  for (const [index, control] of bounds.controls.entries()) {
    expect(control.left).toBeGreaterThanOrEqual(bounds.header?.left ?? 0);
    expect(control.right).toBeLessThanOrEqual(bounds.header?.right ?? 0);
    expect(control.top).toBeGreaterThanOrEqual(bounds.header?.top ?? 0);
    expect(control.bottom).toBeLessThanOrEqual(bounds.header?.bottom ?? 0);
    if (index > 0) {
      expect(control.left).toBeGreaterThanOrEqual(bounds.controls[index - 1].right);
    }
  }
}

test('language links preserve query and matching anchors across marketing and docs', async ({
  page,
}) => {
  await page.goto('/docs/api/effects/fire/?mode=static#usage');
  await page.evaluate(() => {
    window.location.hash = 'controls';
  });
  await page.locator('.language-switcher summary').click();
  await page.locator('.site-nav .language-links [data-language-link="es"]').click();
  await expect(page).toHaveURL(/\/docs\/es\/api\/effects\/fire\/\?mode=static#controls$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');

  await page.goto('/es/effects/?category=Energy#missing');
  await page.locator('.language-switcher summary').click();
  await expect(page.locator('.site-nav .language-links [data-language-link="en"]')).toHaveAttribute(
    'href',
    '/effects/?category=Energy',
  );
});

test('changing language keeps the header actions and mobile gallery in place', async ({ page }) => {
  for (const width of [768, 1440]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/es/');
    await page.evaluate(() => document.fonts.ready);
    const spanishSearchX = await page
      .locator('.header-search')
      .evaluate((element) => element.getBoundingClientRect().x);
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    const englishSearchX = await page
      .locator('.header-search')
      .evaluate((element) => element.getBoundingClientRect().x);
    expect(Math.abs(spanishSearchX - englishSearchX), `${width}px header`).toBeLessThan(1);
  }

  for (const width of [320, 360]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/es/');
    await page.evaluate(() => document.fonts.ready);
    const spanishGalleryY = await page
      .locator('#collection')
      .evaluate((element) => element.getBoundingClientRect().y);
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    const englishGalleryY = await page
      .locator('#collection')
      .evaluate((element) => element.getBoundingClientRect().y);
    expect(Math.abs(spanishGalleryY - englishGalleryY), `${width}px gallery`).toBeLessThan(1);
  }
});

test('desktop language menu closes with Escape and an outside click', async ({ page }) => {
  await page.goto('/es/');
  const switcher = page.locator('.language-switcher');
  const trigger = switcher.locator('summary');
  await trigger.focus();
  await page.keyboard.press('Enter');
  await expect(switcher.getByRole('link', { name: 'View this page in English' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(switcher).not.toHaveAttribute('open', '');
  await expect(trigger).toBeFocused();

  await trigger.click();
  await page.locator('#hero-title').click();
  await expect(switcher).not.toHaveAttribute('open', '');
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
        await expect(page.locator('.site-nav .language-switcher')).toBeVisible();
      }
    }
  }
});

test('language controls remain operable with larger text', async ({ page }) => {
  for (const width of [320, 360, 768, 1440]) {
    await page.setViewportSize({ width, height: 800 });
    for (const route of ['/es/', '/docs/es/introduction/']) {
      await page.goto(route);
      await page.evaluate(() => {
        document.documentElement.style.fontSize = '200%';
      });
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width,
      );
      await expectHeaderControlsFit(page);
      const menuButton = page.getByRole('button', { name: 'Abrir menú del sitio' });
      if (await menuButton.isVisible()) {
        await menuButton.focus();
        await page.keyboard.press('Enter');
        await expect(page.locator('#site-menu [data-language-link="en"]')).toBeVisible();
        await page.keyboard.press('Escape');
      } else {
        await page.locator('.language-switcher summary').click();
        await expect(
          page.locator('.site-nav .language-links [data-language-link="en"]'),
        ).toBeVisible();
      }
    }
  }
});

test('language controls fit a 32px browser default font', async ({ baseURL }) => {
  const profile = await mkdtemp(join(tmpdir(), 'domfx-nav-font-'));
  try {
    await mkdir(join(profile, 'Default'));
    await writeFile(
      join(profile, 'Default', 'Preferences'),
      JSON.stringify({ webkit: { webprefs: { default_font_size: 32 } } }),
    );
    const context = await chromium.launchPersistentContext(profile, {
      baseURL,
      javaScriptEnabled: false,
      viewport: { width: 320, height: 800 },
    });
    try {
      const page = context.pages()[0];
      for (const width of [320, 360, 768, 1401, 1402, 1403, 1440]) {
        await page.setViewportSize({ width, height: 800 });
        for (const route of ['/es/', '/docs/es/introduction/']) {
          await page.goto(route);
          await page.evaluate(() => document.fonts.ready);
          expect(
            await page.evaluate(() => getComputedStyle(document.documentElement).fontSize),
          ).toBe('32px');
          await expectHeaderControlsFit(page);
          const menuButton = page.getByRole('button', { name: 'Abrir menú del sitio' });
          if (await menuButton.isVisible()) {
            await menuButton.focus();
            await page.keyboard.press('Enter');
            const english = page.locator('#site-menu [data-language-link="en"]');
            await expect(english).toBeVisible();
            await expect(english).toBeInViewport();
            await english.focus();
            await expect(english).toBeFocused();
            await page.keyboard.press('Enter');
          } else {
            await page.locator('.language-switcher summary').focus();
            await page.keyboard.press('Enter');
            const english = page.locator('.site-nav .language-links [data-language-link="en"]');
            await expect(english).toBeVisible();
            await english.focus();
            await expect(english).toBeFocused();
            await page.keyboard.press('Enter');
          }
          await expect(page).toHaveURL(route === '/es/' ? /\/$/ : /\/docs\/introduction\/$/);
          await expect(page.locator('html')).toHaveAttribute('lang', 'en');
        }
      }
    } finally {
      await context.close();
    }
  } finally {
    await rm(profile, { recursive: true, force: true });
  }
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('desktop and mobile links reach equivalent pages', async ({ page, request }) => {
    await page.goto('/docs/es/introduction/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'es');
    await page.locator('.language-switcher summary').click();
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

  test('open mobile menu remains dismissible after widening the viewport', async ({ page }) => {
    await page.setViewportSize({ width: 700, height: 800 });
    await page.goto('/es/effects/');
    await page.getByRole('button', { name: 'Abrir menú del sitio' }).click();
    await expect(page.locator('#site-menu')).toBeVisible();
    await page.setViewportSize({ width: 701, height: 800 });
    await page.keyboard.press('Escape');
    await expect(page.locator('#site-menu')).toBeHidden();
    await expect(page.locator('.site-nav .language-switcher')).toBeVisible();
  });
});
