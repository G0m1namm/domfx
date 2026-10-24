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

for (const kind of ['image', 'svg']) {
  test(`${kind} preview retains its canvas and capture through camera clipping`, async ({
    page,
  }) => {
    await page.addInitScript(() => {
      document.createElement = new Proxy(document.createElement, {
        apply(target, receiver, args) {
          if (args[0] === 'canvas') {
            const root = document.documentElement;
            root.dataset.testCanvasCreations = String(
              Number(root.dataset.testCanvasCreations ?? 0) + 1,
            );
          }
          return Reflect.apply(target, receiver, args);
        },
      });
    });
    await page.goto('/effects/');
    await page.locator('[data-card][data-id="slime"]').click();
    const dialog = page.locator('.effect-dialog');
    const scene = dialog.locator('.dialog-scene');
    const stage = dialog.locator('.dialog-stage');
    await dialog.locator(`[data-target="${kind}"]`).click();
    await expect(stage).toHaveAttribute('data-status', 'active');
    const canvas = await stage.locator('canvas').elementHandle();
    if (!canvas) {
      throw new Error(`Missing ${kind} output`);
    }
    const creations = await page.locator('html').getAttribute('data-test-canvas-creations');
    const retained = async () => {
      // Hold beyond the camera transition and observer delivery: a count of one
      // immediately after clicking can miss disposal or a replacement canvas.
      await page.waitForTimeout(400);
      expect(await canvas.evaluate((element) => element.isConnected)).toBe(true);
      await expect(stage.locator('canvas')).toHaveCount(1);
      await expect(stage).toHaveAttribute('data-status', 'active');
      await expect(page.locator('html')).toHaveAttribute(
        'data-test-canvas-creations',
        creations ?? '',
      );
      const frame = await scene.screenshot();
      await expect.poll(async () => frame.equals(await scene.screenshot())).toBe(false);
    };

    await scene.hover({ position: { x: 20, y: 20 } });
    await expect(dialog.locator('[data-zoom-label]')).toHaveText('200%');
    await retained();
    await page.mouse.move(0, 0);
    await retained();
    await dialog.locator('[data-zoom-in]').click();
    await dialog.locator('[data-zoom-in]').click();
    await expect(dialog.locator('[data-zoom-label]')).toHaveText('200%');
    await retained();
    await scene.focus();
    await page.keyboard.press('+');
    await page.keyboard.press('+');
    await expect(dialog.locator('[data-zoom-label]')).toHaveText('300%');
    await expect
      .poll(() =>
        scene.evaluate((element) => {
          const frame = element.getBoundingClientRect();
          const target = element.querySelector('[data-dialog-target]')?.getBoundingClientRect();
          return Boolean(
            target &&
            (target.top < frame.top ||
              target.bottom > frame.bottom ||
              target.left < frame.left ||
              target.right > frame.right),
          );
        }),
      )
      .toBe(true);
    await retained();
    for (const key of ['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown']) {
      await page.keyboard.press(key);
      await retained();
    }
    for (const direction of ['left', 'up', 'right', 'down']) {
      await dialog.locator(`[data-pan="${direction}"]`).click();
      await retained();
    }
    await dialog.locator('[data-zoom-reset]').click();
    await expect(dialog.locator('[data-zoom-label]')).toHaveText('100%');
    await retained();

    for (let step = 0; step < 4; step += 1) {
      await dialog.locator('[data-zoom-in]').click();
    }
    await expect(dialog.locator('[data-zoom-label]')).toHaveText('300%');
    await dialog.locator('[data-creation-option="dripDensity"]').fill('90');
    await expect.poll(() => canvas.evaluate((element) => element.isConnected)).toBe(false);
    await expect(stage).toHaveAttribute('data-status', 'active');
    await expect(stage.locator('canvas')).toHaveCount(1);
    await expect(dialog.locator('[data-code]')).toContainText('dripDensity: 0.9');
    await dialog.locator('[data-close]').click();
    await expect(stage.locator('canvas')).toHaveCount(0);
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide')));
    await expect(page.locator('canvas')).toHaveCount(0);
    await page.setViewportSize({ width: 768, height: 900 });
    await page.waitForTimeout(400);
    await expect(page.locator('canvas')).toHaveCount(0);
  });
}

test('Spanish Slime controls reflow and work with the keyboard at narrow and wide sizes', async ({
  page,
}) => {
  for (const width of [320, 360, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/es/effects/');
    await page.locator('[data-card][data-id="slime"]').click();
    const dialog = page.locator('.effect-dialog');
    await expect(dialog.locator('.dialog-stage')).toHaveAttribute('data-status', 'active');
    const previous = await dialog.locator('canvas').elementHandle();
    if (!previous) {
      throw new Error('Missing Slime output');
    }
    const density = dialog.locator('[data-creation-option="dripDensity"]');
    await density.scrollIntoViewIfNeeded();
    if (width <= 360) {
      await expect.poll(() => previous.evaluate((canvas) => canvas.isConnected)).toBe(false);
      await expect(dialog.locator('canvas')).toHaveCount(0);
    }
    await density.focus();
    await page.keyboard.press('ArrowRight');
    await expect(density).toHaveValue('57');
    await expect(dialog.locator('[data-code]')).toContainText('dripDensity: 0.57');
    if (width <= 360) {
      await page.waitForTimeout(400);
      await expect(dialog.locator('canvas')).toHaveCount(0);
    }
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
