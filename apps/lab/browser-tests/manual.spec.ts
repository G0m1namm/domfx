import { expect, test } from '@playwright/test';

import type {} from '../src/manual.js';

test('public manual attachment paints deterministically and preserves the target', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('/manual.html');
  await expect(page.locator('#state')).toContainText('"lifecycle":"active"');
  const result = await page.evaluate(async () => {
    const { effect, capture } = window.manual;
    const first = capture(1.5, 0.85);
    const changed = capture(2.5, 0.85);
    const repeated = capture(1.5, 0.85);
    const zero = capture(1.5, -10);
    const low = effect.intensity;
    const image = new Image();
    image.src = zero;
    await image.decode();
    const pixels = document.createElement('canvas');
    pixels.width = image.width;
    pixels.height = image.height;
    const context = pixels.getContext('2d');
    if (!context) throw new Error('missing-readback');
    context.drawImage(image, 0, 0);
    const transparent = context
      .getImageData(0, 0, pixels.width, pixels.height)
      .data.every((value) => value === 0);
    capture(1.5, 10);
    const high = effect.intensity;
    capture(1.5, 0.85);
    return {
      repeat: first === repeated,
      changed: first !== changed,
      nonempty: first.length > zero.length,
      transparent,
      low,
      high,
      seed: effect.seed,
      raster: effect.raster,
      time: effect.time,
    };
  });
  expect(result).toEqual({
    repeat: true,
    changed: true,
    nonempty: true,
    transparent: true,
    low: 0,
    high: 1,
    seed: 314,
    raster: 'fresh',
    time: 1.5,
  });
  const layer = page.locator('#manual-host > canvas');
  await expect(layer).toHaveAttribute('aria-hidden', 'true');
  await expect(layer).toHaveCSS('pointer-events', 'none');
  await expect(page.locator('#manual-target canvas')).toHaveCount(0);
  await page.locator('#manual-target').click();
  await page.locator('#manual-target').press('Enter');
  await expect(page.locator('#clicks')).toHaveText('Target clicks: 2');
  await testInfo.attach('manual-fire.png', {
    body: await page.screenshot(),
    contentType: 'image/png',
  });
  await page.evaluate(() => {
    window.manual.effect.dispose();
    window.manual.effect.dispose();
  });
  await expect(layer).toHaveCount(0);
  expect(
    await page.evaluate(async () => {
      const host = document.querySelector<HTMLElement>('#manual-host');
      const target = document.querySelector('#manual-target');
      if (!host || !target) throw new Error('fixture');
      if (target instanceof HTMLElement) target.blur();
      const next = window.manual.attach(target, { host });
      await next.ready;
      const lifecycle = next.lifecycle;
      next.dispose();
      return lifecycle;
    }),
  ).toBe('active');
  expect(errors).toEqual([]);
});

test('ownership, numeric validation and stale paint are observable', async ({ page }) => {
  await page.goto('/manual.html');
  await expect(page.locator('#state')).toContainText('"lifecycle":"active"');
  const rejected = await page.evaluate(() => {
    const { effect, attach } = window.manual;
    const host = document.querySelector<HTMLElement>('#manual-host');
    const target = document.querySelector('#manual-target');
    const span = target?.querySelector('span');
    if (!host || !target || !span) throw new Error('fixture');
    const reject = (call: () => void) => {
      try {
        call();
        return false;
      } catch {
        return true;
      }
    };
    const checks = [
      reject(() => attach(target, { host })),
      reject(() => attach(span, { host })),
      reject(() => attach(host, { host })),
      reject(() => attach(target, { host: document.body })),
      reject(() => {
        effect.time = NaN;
      }),
      reject(() => {
        effect.intensity = Infinity;
      }),
      !Reflect.set(effect, 'seed', 12),
    ];
    target.setAttribute('style', 'background: red');
    effect.time = 2; // A same-task write must not paint already-known stale pixels.
    return {
      checks,
      lifecycle: effect.lifecycle,
      raster: effect.raster,
      hidden: host.querySelector('canvas')?.style.display === 'none',
    };
  });
  expect(rejected).toEqual({
    checks: Array(7).fill(true),
    lifecycle: 'suspended',
    raster: 'stale',
    hidden: true,
  });
});

test('scaled host placement uses target-local pixels', async ({ page }) => {
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const host = document.querySelector<HTMLElement>('#manual-host');
      if (host) host.style.transform = 'translate(12px, 8px) scale(1.25, 0.8)';
    });
  });
  await page.goto('/manual.html');
  await expect(page.locator('#state')).toContainText('"lifecycle":"active"');
  const placement = await page.evaluate(() => {
    const target = document.querySelector('#manual-target')?.getBoundingClientRect();
    const layer = document.querySelector('#manual-host canvas')?.getBoundingClientRect();
    if (!target || !layer) throw new Error('fixture');
    return {
      left: target.left - layer.left,
      top: target.top - layer.top,
      width: layer.width - target.width,
      height: layer.height - target.height,
    };
  });
  expect(placement.left).toBeCloseTo(40, 1);
  expect(placement.top).toBeCloseTo(25.6, 1);
  expect(placement.width).toBeCloseTo(80, 1);
  expect(placement.height).toBeCloseTo(51.2, 1);
});

test('disposal before a late adapter result releases its device and leaves no canvas', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = navigator.gpu.requestAdapter.bind(navigator.gpu);
    navigator.gpu.requestAdapter = async (options) => {
      const adapter = await original(options);
      await new Promise<void>((resolve) => {
        document.addEventListener('release-adapter', () => resolve(), { once: true });
        document.documentElement.dataset.adapterWaiting = 'true';
      });
      if (adapter) {
        const request = adapter.requestDevice.bind(adapter);
        adapter.requestDevice = async (descriptor) => {
          const device = await request(descriptor),
            destroy = device.destroy.bind(device);
          device.destroy = () => {
            document.documentElement.dataset.deviceDestroyed = 'true';
            destroy();
          };
          return device;
        };
      }
      return adapter;
    };
  });
  await page.goto('/manual.html');
  await expect(page.locator('html')).toHaveAttribute('data-adapter-waiting', 'true');
  await page.evaluate(async () => {
    window.manual.effect.dispose();
    window.manual.effect.dispose();
    document.dispatchEvent(new Event('release-adapter'));
    await window.manual.effect.ready;
  });
  await expect(page.locator('html')).toHaveAttribute('data-device-destroyed', 'true');
  await expect(page.locator('#manual-host canvas')).toHaveCount(0);
  expect(await page.evaluate(() => window.manual.effect.lifecycle)).toBe('disposed');
});

for (const mode of ['missing-gpu', 'reduced-motion'] as const) {
  test(`${mode} leaves original content usable`, async ({ page }) => {
    if (mode === 'missing-gpu')
      await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
    else {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.addInitScript(() =>
        Object.defineProperty(navigator, 'gpu', {
          get() {
            throw new Error('unexpected-gpu-access');
          },
        }),
      );
    }
    await page.goto('/manual.html');
    await expect(page.locator('#state')).toContainText('"lifecycle":"unavailable"');
    await expect(page.locator('#state')).toContainText(
      mode === 'missing-gpu' ? 'no-webgpu' : 'reduced-motion',
    );
    await expect(page.locator('#manual-host canvas')).toHaveCount(0);
    await page.locator('#manual-target').click();
    await expect(page.locator('#clicks')).toHaveText('Target clicks: 1');
  });
}

test('disposal during GPU preparation releases late resources', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    const requestAdapter = navigator.gpu.requestAdapter.bind(navigator.gpu);
    navigator.gpu.requestAdapter = async (options) => {
      const adapter = await requestAdapter(options);
      if (!adapter) return adapter;
      const requestDevice = adapter.requestDevice.bind(adapter);
      adapter.requestDevice = async (descriptor) => {
        const device = await requestDevice(descriptor);
        const submitted = device.queue.onSubmittedWorkDone.bind(device.queue);
        device.queue.onSubmittedWorkDone = async () => {
          await submitted();
          document.documentElement.dataset.prepareWaiting = 'true';
          await new Promise<void>((resolve) =>
            document.addEventListener('release-prepare', () => resolve(), { once: true }),
          );
        };
        const destroy = device.destroy.bind(device);
        device.destroy = () => {
          document.documentElement.dataset.deviceDestroyed = 'true';
          destroy();
        };
        return device;
      };
      return adapter;
    };
  });
  await page.goto('/manual.html');
  await expect(page.locator('html')).toHaveAttribute('data-prepare-waiting', 'true');
  await page.evaluate(async () => {
    window.manual.effect.dispose();
    document.dispatchEvent(new Event('release-prepare'));
    await window.manual.effect.ready;
    window.manual.effect.time = 9;
  });
  await expect(page.locator('html')).toHaveAttribute('data-device-destroyed', 'true');
  await expect(page.locator('#manual-host canvas')).toHaveCount(0);
  expect(await page.evaluate(() => window.manual.effect.lifecycle)).toBe('disposed');
  expect(errors).toEqual([]);
});

test('runtime reduced motion suspends and resumes the same manual raster', async ({ page }) => {
  await page.goto('/manual.html');
  await expect(page.locator('#state')).toContainText('"lifecycle":"active"');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(() => page.evaluate(() => window.manual.effect.lifecycle)).toBe('suspended');
  await expect(page.locator('#manual-host canvas')).toBeHidden();
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect.poll(() => page.evaluate(() => window.manual.effect.lifecycle)).toBe('active');
  await expect(page.locator('#manual-host canvas')).toBeVisible();
  expect(await page.evaluate(() => window.manual.effect.raster)).toBe('fresh');
});
