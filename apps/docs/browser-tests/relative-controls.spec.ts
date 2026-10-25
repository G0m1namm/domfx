import { expect, test } from '@playwright/test';

import {
  effectColorField,
  effectCreationFields,
  effectSettingApiValue,
  effectWritableFields,
} from '@domfx/site/effect-extent';
import { effects } from '@domfx/site/effects';

function changedControlValue(field: ReturnType<typeof effectCreationFields>[number]) {
  if (field.kind === 'preset') {
    return '100';
  }
  if (field.unit === 'css-px') {
    return '12';
  }
  return '17';
}

function presetLabel(name: string, locale: 'en' | 'es') {
  if (name === 'dripDensity') {
    return locale === 'es' ? 'Media' : 'Medium';
  }
  return locale === 'es' ? 'Completa' : 'Full';
}

function presetValues(name: string) {
  return name === 'dripDensity' ? ['0', '20', '56', '100'] : ['0', '50', '100'];
}

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
      const fields = effectCreationFields(effect);
      const colorField = effectColorField(effect);
      if (!fields.length) {
        throw new Error(`Missing extent metadata: ${effect.id}`);
      }
      await page.goto(`${prefix}/api/effects/${effect.id}/`);
      const lab = page.locator('[data-docs-lab]');
      await expect(lab.locator('[data-docs-lab-extent]')).toHaveCount(fields.length);
      for (const field of fields) {
        await expect(lab.locator(`[data-docs-lab-extent="${field.name}"]`)).toHaveValue(
          String(field.defaultValue),
        );
        const input = lab.locator(`[data-docs-lab-extent="${field.name}"]`);
        await expect(input).toHaveAccessibleName(new RegExp(`^${field.name}`));
        if (field.kind === 'preset') {
          await expect(input.locator('option:checked')).toHaveText(presetLabel(field.name, locale));
          expect(
            await input
              .locator('option')
              .evaluateAll((options) => options.map((option) => option.getAttribute('value'))),
          ).toEqual(presetValues(field.name));
        } else {
          await expect(lab.locator(`[data-effect-setting-output="${field.name}"]`)).toHaveText(
            field.unit === 'css-px' ? `${field.defaultValue} px` : `${field.defaultValue}%`,
          );
          await expect(input).toHaveAttribute(
            'aria-valuetext',
            field.unit === 'css-px' ? /px .+/ : /% .+/,
          );
        }
        await expect(lab.locator('[data-docs-lab-code]')).toContainText(
          `${field.name}: ${effectSettingApiValue(field, String(field.defaultValue))}`,
        );
        await expect(page.locator('#effect-options + p').first()).toBeVisible();
        await expect(page.locator('main')).toContainText(field.name);
      }
      await expect(lab.locator('[data-docs-lab-intensity]')).toBeDisabled();
      await expect(lab.locator('[data-docs-lab-intensity]')).toHaveAccessibleName('intensity');
      await expect(lab.locator('[data-docs-lab-code]')).toContainText(
        "clock: 'auto', motion: 'respect'",
      );
      if (colorField) {
        await expect(lab.locator('[data-docs-lab-color]')).toBeDisabled();
        await expect(lab.locator('[data-docs-lab-color]')).toHaveAccessibleName('color');
        await expect(lab.locator('[data-color-output]')).toHaveText(
          locale === 'es' ? 'Colores originales' : 'Original colors',
        );
        await expect(lab.locator('[data-color-reset]')).toBeDisabled();
      } else {
        await expect(lab.locator('[data-docs-lab-color]')).toHaveCount(0);
      }
      await expect(lab.locator('[data-docs-lab-code]')).not.toContainText('color:');
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
      const fields = effectCreationFields(effect);
      const colorField = effectColorField(effect);
      if (!fields.length) {
        throw new Error(`Missing extent metadata: ${effect.id}`);
      }
      for (const field of fields) {
        const previous = await lab.locator('canvas').elementHandle();
        if (!previous) {
          throw new Error(`Missing output: ${effect.id}`);
        }
        const input = lab.locator(`[data-docs-lab-extent="${field.name}"]`);
        if (field.kind === 'preset') {
          await input.selectOption('100');
        } else {
          await input.fill(changedControlValue(field));
        }
        await expect(lab.locator(`[data-docs-lab-extent-code="${field.name}"]`)).toHaveText(
          effectSettingApiValue(field, changedControlValue(field)).toString(),
        );
        await expect.poll(() => previous.evaluate((canvas) => canvas.isConnected)).toBe(false);
        await expect(lab).toHaveAttribute('data-status', 'active');
        await expect(lab.locator('canvas')).toHaveCount(1);
      }
      for (const field of effectWritableFields(effect)) {
        const previous = await lab.locator('canvas').elementHandle();
        if (!previous) {
          throw new Error(`Missing writable output: ${effect.id}`);
        }
        await lab.locator(`[data-docs-lab-writable="${field.name}"]`).fill('40');
        expect(await previous.evaluate((canvas) => canvas.isConnected)).toBe(true);
        await expect(lab.locator('[data-docs-lab-code]')).toContainText(
          `effect.${field.name} = 0.4`,
        );
      }
      if (colorField) {
        const color = lab.locator('[data-docs-lab-color]');
        const colorCanvas = await lab.locator('canvas').elementHandle();
        if (!colorCanvas) {
          throw new Error(`Missing color output: ${effect.id}`);
        }
        await color.fill('#ff0000');
        expect(await colorCanvas.evaluate((canvas) => canvas.isConnected)).toBe(true);
        await expect(lab.locator('[data-docs-lab-code]')).toContainText('color: "#ff0000",');
      }
      await lab.locator('[data-docs-lab-copy]').click();
      const copied = await page.locator('html').getAttribute('data-copied-settings');
      expect(copied, effect.id).toContain(`const effect = ${effect.exportName}(target`);
      expect(copied, effect.id).toContain('intensity: 0.45');
      if (colorField) {
        expect(copied, effect.id).toContain('color: "#ff0000",');
      } else {
        expect(copied, effect.id).not.toContain('color:');
      }
      for (const field of fields) {
        expect(copied, effect.id).toContain(
          `${field.name}: ${effectSettingApiValue(field, changedControlValue(field))}`,
        );
      }
      for (const subject of ['text', 'svg', 'image']) {
        await lab.locator(`[data-docs-lab-subject][value="${subject}"]`).check();
        await expect(lab.locator(`[data-docs-lab-target="${subject}"]`)).toBeVisible();
        await expect(lab).toHaveAttribute('data-status', 'active');
        await expect(lab.locator('canvas')).toHaveCount(1);
        if (colorField) {
          await expect(lab.locator('[data-docs-lab-color]')).toHaveValue('#ff0000');
          await expect(lab.locator('[data-docs-lab-code]')).toContainText('color: "#ff0000",');
        }
      }
      if (colorField) {
        await lab.locator('[data-color-reset]').click();
        await expect(lab.locator('[data-docs-lab-code]')).not.toContainText('color:');
      }
    }
  });
}

test('EN and ES keep API names and values identical while translating preset labels', async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
  const page = await context.newPage();
  const snapshots = [];
  for (const prefix of ['/docs', '/docs/es']) {
    await page.goto(`${prefix}/api/effects/slime/`);
    const lab = page.locator('[data-docs-lab]');
    snapshots.push({
      code: await lab.locator('[data-docs-lab-code]').textContent(),
      values: await lab.locator('input, select, option').evaluateAll((elements) =>
        elements.map((element) => ({
          name: element.getAttribute('data-docs-lab-extent'),
          value: element.getAttribute('value'),
        })),
      ),
    });
  }
  expect(snapshots[1]).toEqual(snapshots[0]);
  await expect(page.locator('[data-docs-lab-extent="dripDensity"] option')).toHaveText([
    'Sin gotas',
    'Baja',
    'Media',
    'Alta',
  ]);
  await context.close();
});

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
