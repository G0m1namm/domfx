import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import {
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

function presetLabels(name: string, locale: 'en' | 'es') {
  if (name === 'dripDensity') {
    return locale === 'es'
      ? ['Sin gotas', 'Baja', 'Media', 'Alta']
      : ['None', 'Low', 'Medium', 'High'];
  }
  return locale === 'es' ? ['Sin brasas', 'Media', 'Completa'] : ['None', 'Half', 'Full'];
}

async function hasVisiblePixels(canvas: Locator) {
  return canvas.evaluate(async (element) => {
    const image = new Image();
    const loaded = new Promise<void>((resolve, reject) => {
      image.addEventListener('load', () => resolve(), { once: true });
      image.addEventListener('error', () => reject(new Error('Could not inspect effect canvas')), {
        once: true,
      });
    });
    image.src = (element as HTMLCanvasElement).toDataURL();
    await loaded;
    const copy = document.createElement('canvas');
    copy.width = image.width;
    copy.height = image.height;
    const context = copy.getContext('2d');
    if (!context) {
      throw new Error('Could not read effect canvas');
    }
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, copy.width, copy.height).data;
    return pixels.some((value, index) => index % 4 === 3 && value > 0);
  });
}

type RendererDevice = {
  createBuffer(descriptor: { label?: string }): object;
  queue: {
    writeBuffer(
      buffer: object,
      offset: number,
      data: ArrayBufferView,
      dataOffset?: number,
      size?: number,
    ): void;
  };
};

type RendererAdapter = {
  requestDevice(...options: unknown[]): Promise<RendererDevice>;
};

type RendererGpu = {
  requestAdapter(...options: unknown[]): Promise<RendererAdapter | null>;
};

async function gateRendererDevice(page: Page) {
  await page.addInitScript(() => {
    const gpu = (navigator as Navigator & { gpu?: RendererGpu }).gpu;
    if (!gpu) {
      return;
    }
    let releaseDevice = () => {};
    const deviceReady = new Promise<void>((resolve) => {
      releaseDevice = resolve;
    });
    document.addEventListener('domfx-test-release-device', () => releaseDevice(), { once: true });
    const requestAdapter = gpu.requestAdapter.bind(gpu);
    Object.defineProperty(gpu, 'requestAdapter', {
      configurable: true,
      value: async (...args: unknown[]) => {
        const adapter = await requestAdapter(...args);
        if (!adapter) {
          return adapter;
        }
        const requestDevice = adapter.requestDevice.bind(adapter);
        Object.defineProperty(adapter, 'requestDevice', {
          configurable: true,
          value: async (...options: unknown[]) => {
            const device = await requestDevice(...options);
            const controls = new WeakSet<object>();
            const createBuffer = device.createBuffer.bind(device);
            Object.defineProperty(device, 'createBuffer', {
              configurable: true,
              value: (descriptor: { label?: string }) => {
                const buffer = createBuffer(descriptor);
                if (descriptor.label === 'domfx effect controls') {
                  controls.add(buffer);
                }
                return buffer;
              },
            });
            const queue = device.queue;
            const writeBuffer = queue.writeBuffer.bind(queue);
            Object.defineProperty(queue, 'writeBuffer', {
              configurable: true,
              value: (
                buffer: object,
                offset: number,
                data: ArrayBufferView,
                dataOffset?: number,
                size?: number,
              ) => {
                if (controls.has(buffer) && data instanceof Float32Array) {
                  const previous = document.documentElement.dataset.testControlMistOpacityWrites;
                  document.documentElement.dataset.testControlMistOpacityWrites = previous
                    ? `${previous},${data[0]}`
                    : String(data[0]);
                }
                writeBuffer(buffer, offset, data, dataOffset, size);
              },
            });
            document.documentElement.dataset.testRendererDeviceGate = 'held';
            await deviceReady;
            return device;
          },
        });
        return adapter;
      },
    });
  });
}

test('Halftone forwards relative geometry together with nondefault dot spacing', async ({
  page,
}) => {
  await page.goto('/effects/');
  await page.locator('[data-card][data-id="halftone"]').click();
  const dialog = page.locator('.effect-dialog');
  const stage = dialog.locator('.dialog-stage');
  const controls = dialog.locator('[data-creation-controls]');

  await expect(stage).toHaveAttribute('data-status', 'active');
  await controls.locator('[data-creation-option="dotSpacing"]').fill('12');
  await controls.locator('[data-creation-option="plumeReach"]').fill('0');
  await controls.locator('[data-creation-option="bandDepth"]').fill('0');
  await expect(stage).toHaveAttribute('data-status', 'active');
  expect(await hasVisiblePixels(stage.locator('canvas'))).toBe(false);

  await controls.locator('[data-creation-option="plumeReach"]').fill('17');
  await controls.locator('[data-creation-option="bandDepth"]').fill('17');
  await expect(stage).toHaveAttribute('data-status', 'active');
  expect(await hasVisiblePixels(stage.locator('canvas'))).toBe(true);
});

test('marketing writable controls use the compact fieldset reset', async ({ page }) => {
  await page.goto('/effects/');
  await page.locator('[data-card][data-id="frost"]').click();
  const controls = page.locator('[data-writable-controls]');
  await expect(controls).toBeVisible();
  expect(
    await controls.evaluate((element) => {
      const styles = getComputedStyle(element);
      return {
        borders: [
          styles.borderTopWidth,
          styles.borderRightWidth,
          styles.borderBottomWidth,
          styles.borderLeftWidth,
        ],
        padding: [styles.paddingTop, styles.paddingRight, styles.paddingBottom, styles.paddingLeft],
      };
    }),
  ).toEqual({ borders: ['0px', '0px', '0px', '0px'], padding: ['0px', '0px', '0px', '0px'] });
});

test('marketing preview replays writable controls changed before attachment is ready', async ({
  page,
}) => {
  await gateRendererDevice(page);
  try {
    await page.goto('/effects/', { waitUntil: 'domcontentloaded' });
    await page.locator('[data-card][data-id="frost"]').click();
    const dialog = page.locator('.effect-dialog');
    const stage = dialog.locator('.dialog-stage');
    const opacity = dialog.locator('[data-writable-option="mistOpacity"]');
    await expect(stage).toHaveAttribute('data-status', 'initializing');
    await expect(page.locator('html')).toHaveAttribute('data-test-renderer-device-gate', 'held');
    await opacity.fill('0');
    await expect(dialog.locator('[data-code]')).toContainText('effect.mistOpacity = 0');
    await page.evaluate(() => document.dispatchEvent(new Event('domfx-test-release-device')));
    await expect(stage).toHaveAttribute('data-status', 'active');
    await expect
      .poll(async () => {
        const writes = await page
          .locator('html')
          .getAttribute('data-test-control-mist-opacity-writes');
        return writes?.split(',').map(Number) ?? [];
      })
      .toContain(0);
  } finally {
    await page.evaluate(() => document.dispatchEvent(new Event('domfx-test-release-device')));
  }
});

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
        await expect(controls.locator('input, select')).toHaveCount(fields.length);
        const first = await dialog.locator('canvas').elementHandle();
        if (!first) {
          throw new Error(`Missing output for ${effect.id}`);
        }
        await dialog.locator('#effect-intensity').fill('45');
        expect(await first.evaluate((canvas) => canvas.isConnected)).toBe(true);
        for (const field of fields) {
          const input = controls.locator(`[data-creation-option="${field.name}"]`);
          await expect(input).toHaveAccessibleName(new RegExp(`^${field.name}`));
          await expect(input).toHaveValue(String(field.defaultValue));
          if (field.kind === 'preset') {
            await expect(input.locator('option')).toHaveText(presetLabels(field.name, locale));
          } else {
            await expect(input).toHaveAttribute(
              'aria-valuetext',
              field.unit === 'css-px' ? /px .+/ : /% .+/,
            );
            const aligned = await input.evaluate((element) => {
              const row = element.closest('.effect-setting');
              const label = row?.querySelector('.effect-setting-label')?.getBoundingClientRect();
              const output = row?.querySelector('output')?.getBoundingClientRect();
              const slider = element.getBoundingClientRect();
              return Boolean(
                label && output && label.right <= slider.left && slider.right <= output.left,
              );
            });
            expect(aligned, `${locale} ${effect.id} ${field.name} uses compact aligned rows`).toBe(
              true,
            );
          }
          const previous = await dialog.locator('canvas').elementHandle();
          if (!previous) {
            throw new Error(`Missing output for ${effect.id}`);
          }
          if (field.kind === 'preset') {
            await input.selectOption('100');
          } else {
            await input.fill(changedControlValue(field));
          }
          await expect.poll(() => previous.evaluate((canvas) => canvas.isConnected)).toBe(false);
          await expect(dialog.locator('.dialog-stage'), effect.id).toHaveAttribute(
            'data-status',
            'active',
          );
          await expect(dialog.locator('canvas')).toHaveCount(1);
        }
        for (const field of effectWritableFields(effect)) {
          const previous = await dialog.locator('canvas').elementHandle();
          if (!previous) {
            throw new Error(`Missing writable canvas for ${effect.id}`);
          }
          const input = dialog.locator(`[data-writable-option="${field.name}"]`);
          await input.fill('40');
          expect(await previous.evaluate((canvas) => canvas.isConnected)).toBe(true);
          await expect(dialog.locator('[data-code]')).toContainText(`effect.${field.name} = 0.4`);
        }
        await dialog.locator('[data-copy-code]').click();
        const copied = await page.locator('html').getAttribute('data-copied-settings');
        expect(copied).toContain(effect.exportName);
        expect(copied).toContain('intensity: 0.45');
        for (const field of fields) {
          const value = changedControlValue(field);
          expect(copied).toContain(`${field.name}: ${effectSettingApiValue(field, value)}`);
        }
        for (const field of effectWritableFields(effect)) {
          expect(copied).toContain(`effect.${field.name} = 0.4`);
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
    await dialog.locator('[data-creation-option="dripDensity"]').selectOption('100');
    await expect.poll(() => canvas.evaluate((element) => element.isConnected)).toBe(false);
    await expect(stage).toHaveAttribute('data-status', 'active');
    await expect(stage.locator('canvas')).toHaveCount(1);
    await expect(dialog.locator('[data-code]')).toContainText('dripDensity: 1');
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
    // Native select type-ahead chooses Alta without relying on an OS popup.
    await page.keyboard.press('a');
    await page.keyboard.press('Tab');
    await expect(density).toHaveValue('100');
    await expect(dialog.locator('[data-code]')).toContainText('dripDensity: 1');
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
