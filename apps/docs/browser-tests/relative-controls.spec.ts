import { expect, test } from '@playwright/test';

import { effectExtentReference } from '@domfx/site/effect-extent';
import { effects } from '@domfx/site/effects';

for (const locale of ['en', 'es'] as const) {
  const prefix = locale === 'es' ? '/docs/es' : '/docs';

  test(`@smoke all 21 ${locale} references render effect-owned relative controls and ratio snippets`, async ({
    browser,
    baseURL,
  }) => {
    test.setTimeout(120_000);
    const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
    const page = await context.newPage();
    for (const effect of effects) {
      const reference = effectExtentReference(effect);
      if (!reference) {
        throw new Error(`Missing extent metadata: ${effect.id}`);
      }
      await page.goto(`${prefix}/api/effects/${effect.id}/`);
      const lab = page.locator('[data-docs-lab]');
      await expect(lab.locator('[data-docs-lab-extent]')).toHaveCount(reference.fields.length);
      for (const field of reference.fields) {
        await expect(lab.locator(`[data-docs-lab-extent="${field.name}"]`)).toHaveValue(
          String(field.example * 100),
        );
        await expect(lab.locator(`[data-docs-lab-extent-output="${field.name}"]`)).toHaveText(
          `${field.example * 100}%`,
        );
        await expect(lab.locator('[data-docs-lab-code]')).toContainText(
          `${field.name}: ${field.example}`,
        );
        await expect(page.locator('#effect-options + p').first()).toBeVisible();
        await expect(page.locator('main')).toContainText(field.name);
      }
      await expect(lab.locator('[data-docs-lab-intensity]')).toBeDisabled();
      await expect(lab.locator('canvas')).toHaveCount(0);
    }
    await context.close();
  });

  test(`all 21 ${locale} labs replace creation geometry, retain strength canvas and copy settled ratios`, async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', {
        value: {
          writeText: async (text: string) => {
            document.documentElement.dataset.copiedSettings = text;
          },
        },
      });
    });
    for (const effect of effects) {
      await page.goto(`${prefix}/api/effects/${effect.id}/`);
      const lab = page.locator('[data-docs-lab]');
      await lab.scrollIntoViewIfNeeded();
      await expect(lab, effect.id).toHaveAttribute('data-status', 'active');
      const firstCanvas = await lab.locator('canvas').elementHandle();
      if (!firstCanvas) {
        throw new Error(`Missing output: ${effect.id}`);
      }
      await lab.locator('[data-docs-lab-intensity]').fill('45');
      await expect(lab.locator('[data-docs-lab-intensity-code]')).toHaveText('0.45');
      expect(await firstCanvas.evaluate((canvas) => canvas.isConnected), effect.id).toBe(true);
      const reference = effectExtentReference(effect);
      if (!reference) {
        throw new Error(`Missing extent metadata: ${effect.id}`);
      }
      for (const field of reference.fields) {
        const previous = await lab.locator('canvas').elementHandle();
        if (!previous) {
          throw new Error(`Missing output: ${effect.id}`);
        }
        await lab.locator(`[data-docs-lab-extent="${field.name}"]`).fill('17');
        await expect(lab.locator(`[data-docs-lab-extent-code="${field.name}"]`)).toHaveText('0.17');
        await expect.poll(() => previous.evaluate((canvas) => canvas.isConnected)).toBe(false);
        await expect(lab).toHaveAttribute('data-status', 'active');
        await expect(lab.locator('canvas')).toHaveCount(1);
      }
      await lab.locator('[data-docs-lab-copy]').click();
      const copied = await page.locator('html').getAttribute('data-copied-settings');
      expect(copied, effect.id).toContain(`const effect = ${effect.exportName}(target`);
      expect(copied, effect.id).toContain('intensity: 0.45');
      for (const field of reference.fields) {
        expect(copied, effect.id).toContain(`${field.name}: 0.17`);
      }
      for (const subject of ['text', 'svg', 'image']) {
        await lab.locator(`[data-docs-lab-subject][value="${subject}"]`).check();
        await expect(lab.locator(`[data-docs-lab-target="${subject}"]`)).toBeVisible();
        await expect(lab).toHaveAttribute('data-status', 'active');
        await expect(lab.locator('canvas')).toHaveCount(1);
      }
    }
  });
}

test('logical font rectangles may exceed paint bounds inside the finite source guard', async ({
  page,
}) => {
  await page.goto('/docs/api/effects/fire/');
  const lab = page.locator('[data-docs-lab]');
  await lab.scrollIntoViewIfNeeded();
  await lab.locator('[data-docs-lab-subject][value="text"]').check();
  const geometry = await lab.locator('[data-docs-lab-target="text"]').evaluate((target) => {
    const box = target.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(target);
    const text = range.getBoundingClientRect();
    return {
      fontSize: getComputedStyle(target).fontSize,
      lineHeight: getComputedStyle(target).lineHeight,
      top: box.top - text.top,
      bottom: text.bottom - box.bottom,
    };
  });
  expect(geometry.fontSize).toBe('92px');
  expect(geometry.lineHeight).toBe('78.2px');
  expect(geometry.top).toBeGreaterThan(2);
  expect(geometry.bottom).toBeGreaterThan(2);
  expect(geometry.top).toBeLessThan(8);
  expect(geometry.bottom).toBeLessThan(8);
  await expect(lab).toHaveAttribute('data-status', 'active');
  await expect(lab.locator('canvas')).toHaveCount(1);
});
