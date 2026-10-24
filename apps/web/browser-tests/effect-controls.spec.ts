import { expect, test } from '@playwright/test';

import { effectCreationFields } from '@domfx/site/effect-extent';
import { effects } from '@domfx/site/effects';

for (const locale of ['en', 'es'] as const) {
  for (const gallery of [false, true]) {
    test(`${locale} ${gallery ? 'gallery' : 'Home'} previews expose matching creation controls and copied settings`, async ({
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
      const prefix = locale === 'es' ? '/es' : '';
      await page.goto(`${prefix}/${gallery ? 'effects/' : ''}`);
      const dialog = page.locator('.effect-dialog');
      const catalog = gallery ? effects : effects.slice(0, 5);
      for (const effect of catalog) {
        await page.locator(`[data-card][data-id="${effect.id}"]`).click();
        await expect(dialog).toBeVisible();
        await expect(dialog.locator('.dialog-stage'), effect.id).toHaveAttribute(
          'data-status',
          'active',
        );
        const fields = effectCreationFields(effect);
        const controls = dialog.locator('[data-creation-controls]');
        await expect(controls.locator('input')).toHaveCount(fields.length);
        const first = await dialog.locator('canvas').elementHandle();
        if (!first) {
          throw new Error(`Missing output for ${effect.id}`);
        }
        await dialog.locator('#effect-intensity').fill('45');
        expect(await first.evaluate((canvas) => canvas.isConnected)).toBe(true);
        for (const field of fields) {
          const input = controls.locator(`[data-creation-option="${field.name}"]`);
          await expect(input).toHaveAccessibleName(new RegExp(field.label[locale]));
          await expect(input).toHaveValue(String(Math.round(field.example * 100)));
          const previous = await dialog.locator('canvas').elementHandle();
          if (!previous) {
            throw new Error(`Missing output for ${effect.id}`);
          }
          await input.fill(field.name === 'dripDensity' ? '90' : '17');
          await expect.poll(() => previous.evaluate((canvas) => canvas.isConnected)).toBe(false);
          await expect(dialog.locator('.dialog-stage'), effect.id).toHaveAttribute(
            'data-status',
            'active',
          );
          await expect(dialog.locator('canvas')).toHaveCount(1);
        }
        await dialog.locator('[data-copy-code]').click();
        const copied = await page.locator('html').getAttribute('data-copied-settings');
        expect(copied).toContain(effect.exportName);
        expect(copied).toContain('intensity: 0.45');
        for (const field of fields) {
          expect(copied).toContain(
            `${field.name}: ${field.name === 'dripDensity' ? '0.9' : '0.17'}`,
          );
        }
        await page.keyboard.press('Escape');
        await expect(dialog).not.toBeVisible();
        await expect(dialog.locator('canvas')).toHaveCount(0);
      }
    });
  }
}

test('Spanish Slime controls reflow and work with the keyboard at narrow and wide sizes', async ({
  page,
}) => {
  for (const width of [320, 360, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/es/effects/');
    await page.locator('[data-card][data-id="slime"]').click();
    const dialog = page.locator('.effect-dialog');
    const density = dialog.locator('[data-creation-option="dripDensity"]');
    await density.scrollIntoViewIfNeeded();
    await density.focus();
    await page.keyboard.press('ArrowRight');
    await expect(density).toHaveValue('57');
    await expect(dialog.locator('[data-code]')).toContainText('dripDensity: 0.57');
    const layout = await dialog.evaluate((element) => ({
      fits: element.scrollWidth <= element.clientWidth + 1,
      pageFits: document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
      targets: Array.from(element.querySelectorAll<HTMLInputElement>('[data-creation-option]')).map(
        (input) => input.getBoundingClientRect().height,
      ),
    }));
    expect(layout).toMatchObject({ fits: true, pageFits: true });
    expect(layout.targets.every((height) => height >= 44)).toBe(true);
    await dialog.locator('[data-dialog-target]').scrollIntoViewIfNeeded();
    await expect(dialog.locator('.dialog-stage')).toHaveAttribute('data-status', 'active');
    await page.keyboard.press('Escape');
  }
});

test('creation controls stay disabled without WebGPU', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
  await page.goto('/effects/');
  await page.locator('[data-card][data-id="slime"]').click();
  const controls = page.locator('[data-creation-controls]');
  await expect(controls.locator('[data-creation-option="dripDensity"]')).toBeDisabled();
  await expect(page.locator('.dialog-stage canvas')).toHaveCount(0);
  await expect(page.locator('[data-code]')).toContainText('dripDensity: 0.56');
});
