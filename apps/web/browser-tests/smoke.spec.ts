import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { chromium, expect, test } from '@playwright/test';

// Exercise real navigation and controls when decorative GPU output is unavailable.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
});

test('missing pages return 404 with working English and Spanish recovery links', async ({
  page,
  request,
}) => {
  const response = await page.goto('/missing-domfx-route/');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'Page not found', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Go to the homepage' })).toHaveAttribute('href', '/');
  await expect(page.getByRole('link', { name: 'Ir al inicio' })).toHaveAttribute('href', '/es/');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
  for (const route of ['/docs/missing-domfx-route/', '/docs/es/missing-domfx-route/']) {
    expect((await request.get(route)).status()).toBe(404);
  }
});

test('body, control and code text follow the browser default font preference', async ({
  baseURL,
}, testInfo) => {
  test.setTimeout(90_000);
  const routes = ['/', '/effects/', '/docs/standalone/', '/docs/api/effects/frost/'];
  const baseline = new Map<string, number[]>();
  const headingBaseline = new Map<string, number>();

  for (const preference of [16, 24, 32]) {
    const profile = await mkdtemp(join(tmpdir(), 'domfx-font-preference-'));
    try {
      await mkdir(join(profile, 'Default'));
      await writeFile(
        join(profile, 'Default', 'Preferences'),
        JSON.stringify({ webkit: { webprefs: { default_font_size: preference } } }),
      );
      const context = await chromium.launchPersistentContext(profile, {
        baseURL,
        viewport: { width: 360, height: 900 },
      });
      try {
        // This context does not inherit the page fixture's GPU-unavailable setup.
        await context.addInitScript(() =>
          Object.defineProperty(navigator, 'gpu', { value: undefined }),
        );
        const page = context.pages()[0];
        for (const route of routes) {
          await page.goto(route, { waitUntil: 'networkidle' });
          await page.evaluate(() => document.fonts.ready);
          expect(
            await page.evaluate(() => getComputedStyle(document.documentElement).fontSize),
          ).toBe(`${preference}px`);
          const selectors = route.startsWith('/docs/')
            ? ['.sl-markdown-content p', '.docs-lab-copy', '.sl-markdown-content pre code']
            : ['.closing-cta p', '.closing-actions button', '.closing-actions code'];
          const sizes = [];
          for (const selector of selectors) {
            sizes.push(
              await page
                .locator(selector)
                .first()
                .evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize)),
            );
          }
          if (preference === 16) {
            baseline.set(route, sizes);
          } else {
            const original = baseline.get(route);
            expect(original).toBeDefined();
            for (const [index, size] of sizes.entries()) {
              expect(size, `${route}: ${selectors[index]} at ${preference}px`).toBeCloseTo(
                (original?.[index] ?? 0) * (preference / 16),
                2,
              );
            }
          }
          expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(360);
          await expect(page.locator('canvas')).toHaveCount(0);
          if (route === '/effects/') {
            await page.setViewportSize({ width: 320, height: 900 });
            await page.locator('[data-card]').first().click();
            for (const selector of ['.target-options button', '.preview-toolbar p']) {
              const contained = await page.locator(selector).evaluateAll((elements) =>
                elements.every((element) => {
                  const box = element.getBoundingClientRect();
                  const parent = element.parentElement?.getBoundingClientRect();
                  return (
                    parent &&
                    box.left >= parent.left &&
                    box.right <= parent.right &&
                    element.scrollWidth <= element.clientWidth
                  );
                }),
              );
              expect(contained, `${selector} at ${preference}px default`).toBe(true);
            }
            await page.getByRole('button', { name: 'Close preview' }).click();
            await page.setViewportSize({ width: 360, height: 900 });
          }
          if (route.startsWith('/docs/')) {
            const toggle = page.getByRole('button', { name: 'Docs', exact: true });
            const toggleLayout = await toggle.evaluate((element) => {
              const box = element.getBoundingClientRect();
              const range = document.createRange();
              range.selectNodeContents(element);
              const label = range.getBoundingClientRect();
              const title = document.querySelector('.docs-mobile-title')?.getBoundingClientRect();
              const content = document.querySelector('main')?.getBoundingClientRect();
              return {
                height: box.height,
                titleClear: !title || title.width === 0 || title.left >= box.right,
                contentClear: content && content.top >= box.bottom,
                fits:
                  label.top >= box.top && label.bottom <= box.bottom && label.right <= box.right,
              };
            });
            expect(
              toggleLayout.height,
              `Docs target at ${preference}px default`,
            ).toBeGreaterThanOrEqual(44);
            expect(toggleLayout.fits).toBe(true);
            expect(toggleLayout.titleClear).toBe(true);
            expect(toggleLayout.contentClear).toBe(true);

            await page.setViewportSize({ width: 1152, height: 900 });
            const headingSize = await page
              .locator('h1')
              .evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));
            if (preference === 16) {
              headingBaseline.set(route, headingSize);
            } else {
              expect(
                headingSize,
                `${route}: fluid heading at ${preference}px default`,
              ).toBeGreaterThan(headingBaseline.get(route) ?? 0);
            }
            await page.setViewportSize({ width: 1440, height: 900 });
            await expect(
              page.locator('#starlight__sidebar:visible, .docs-menu-toggle:visible'),
            ).toHaveCount(1);
            await page.setViewportSize({ width: 360, height: 900 });
          }
          if (route === '/docs/api/effects/frost/' && testInfo.project.name === 'production') {
            await page
              .getByRole('button', { name: 'Search effects and documentation', exact: true })
              .click();
            await page
              .getByRole('textbox', { name: 'Search effects and documentation', exact: true })
              .fill('frost');
            const title = page.locator('#starlight__search .pagefind-ui__result-title').first();
            await expect(title).toBeVisible();
            expect(
              await title.evaluate((element) =>
                Number.parseFloat(getComputedStyle(element).fontSize),
              ),
            ).toBeCloseTo(1.05 * preference, 2);
            expect(
              await page
                .getByRole('textbox', { name: 'Search effects and documentation', exact: true })
                .evaluate((element) => element.scrollWidth <= element.clientWidth),
            ).toBe(true);
            await page.keyboard.press('Escape');
          }
        }
      } finally {
        await context.close();
      }
    } finally {
      await rm(profile, { recursive: true, force: true });
    }
  }
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
