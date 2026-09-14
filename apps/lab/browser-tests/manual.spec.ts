import { expect, test } from '@playwright/test';

import type {} from '../src/manual.js';

test('public manual attachment paints deterministically and preserves the target', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') {
      errors.push(message.text());
    }
  });
  await page.goto('/manual.html');
  await expect(page.locator('#state')).toContainText('"lifecycle":"active"');
  const result = await page.evaluate(async () => {
    const { effect, capture } = window.manual;
    const first = await capture(1.5, 0.85);
    const changed = await capture(2.5, 0.85);
    const repeated = await capture(1.5, 0.85);
    const zero = await capture(1.5, -10);
    const low = effect.intensity;
    const image = new Image();
    image.src = zero;
    await image.decode();
    const pixels = document.createElement('canvas');
    pixels.width = image.width;
    pixels.height = image.height;
    const context = pixels.getContext('2d');
    if (!context) {
      throw new Error('missing-readback');
    }
    context.drawImage(image, 0, 0);
    const transparent = context
      .getImageData(0, 0, pixels.width, pixels.height)
      .data.every((value) => value === 0);
    await capture(1.5, 10);
    const high = effect.intensity;
    await capture(1.5, 0.85);
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
      if (!host || !target) {
        throw new Error('fixture');
      }
      if (target instanceof HTMLElement) {
        target.blur();
      }
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
    if (!host || !target || !span) {
      throw new Error('fixture');
    }
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
      if (host) {
        host.style.transform = 'translate(12px, 8px) scale(1.25, 0.8)';
      }
    });
  });
  await page.goto('/manual.html');
  await expect(page.locator('#state')).toContainText('"lifecycle":"active"');
  const placement = await page.evaluate(() => {
    const target = document.querySelector('#manual-target')?.getBoundingClientRect();
    const layer = document.querySelector('#manual-host canvas')?.getBoundingClientRect();
    if (!target || !layer) {
      throw new Error('fixture');
    }
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
          const device = await request(descriptor);
          const destroy = device.destroy.bind(device);
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
    if (mode === 'missing-gpu') {
      await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
    } else {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.addInitScript(() => {
        Object.defineProperty(navigator, 'gpu', {
          get() {
            throw new Error('unexpected-gpu-access');
          },
        });
        const createElement = Document.prototype.createElement;
        Document.prototype.createElement = function (
          ...args: Parameters<Document['createElement']>
        ) {
          if (args[0].toLowerCase() === 'canvas') {
            throw new Error('unexpected-canvas-allocation');
          }
          return Reflect.apply(createElement, this, args);
        };
      });
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
      if (!adapter) {
        return adapter;
      }
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

test('runtime reduced motion releases output without automatic recovery', async ({ page }) => {
  await page.goto('/manual.html');
  await expect(page.locator('#state')).toContainText('"lifecycle":"active"');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(() => page.evaluate(() => window.manual.effect.lifecycle)).toBe('suspended');
  await expect(page.locator('#manual-host canvas')).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const state = await page.evaluate(async () => {
    const effect = window.manual.effect;
    effect.time = 9;
    effect.resume();
    window.dispatchEvent(new Event('resize'));
    const error = await effect.refresh().catch((error: Error) => error.message);
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    return { lifecycle: effect.lifecycle, raster: effect.raster, reason: effect.reason, error };
  });
  expect(state).toEqual({
    lifecycle: 'suspended',
    raster: 'stale',
    reason: 'reduced-motion',
    error: 'reduced-motion',
  });
  await expect(page.locator('#manual-host canvas')).toHaveCount(0);
});

for (const mode of [
  'no-webgpu',
  'no-adapter',
  'capture-failed',
  'empty-mask',
  'capture-budget',
  'renderer-failed',
  'canvas-webgpu-unavailable',
] as const) {
  test(`initial ${mode} releases ownership and resources`, async ({ page }) => {
    await page.addInitScript((failure) => {
      const gpu = navigator.gpu;
      const requestAdapter = gpu.requestAdapter.bind(gpu);
      const decode = HTMLImageElement.prototype.decode;
      const getImageData = CanvasRenderingContext2D.prototype.getImageData;
      const getContext = HTMLCanvasElement.prototype.getContext;
      const canvases = new Set<HTMLCanvasElement>();
      let devices = 0;
      let destroyed = 0;
      HTMLCanvasElement.prototype.getContext = function (...args) {
        canvases.add(this);
        if (failure === 'canvas-webgpu-unavailable' && args[0] === 'webgpu') {
          return null;
        }
        return Reflect.apply(getContext, this, args);
      };
      gpu.requestAdapter = async (options) => {
        if (failure === 'no-adapter') {
          return null;
        }
        const adapter = await requestAdapter(options);
        if (!adapter) {
          throw new Error('test requires a real GPU adapter');
        }
        const requestDevice = adapter.requestDevice.bind(adapter);
        adapter.requestDevice = async (descriptor) => {
          const device = await requestDevice(descriptor);
          devices += 1;
          const destroy = device.destroy.bind(device);
          device.destroy = () => {
            destroyed += 1;
            destroy();
          };
          if (failure === 'renderer-failed') {
            device.createRenderPipeline = () => {
              throw new Error('injected renderer construction failure');
            };
          }
          return device;
        };
        return adapter;
      };
      if (failure === 'no-webgpu') {
        Object.defineProperty(navigator, 'gpu', { value: undefined, configurable: true });
      }
      if (failure === 'capture-failed') {
        HTMLImageElement.prototype.decode = async () => {
          throw new Error('injected capture decode failure');
        };
      }
      if (failure === 'empty-mask') {
        CanvasRenderingContext2D.prototype.getImageData = function (...args) {
          const data = Reflect.apply(getImageData, this, args);
          // Alpha below the agreed 128 threshold is an empty silhouette.
          for (let i = 3; i < data.data.length; i += 4) {
            data.data[i] = 127;
          }
          return data;
        };
      }
      document.addEventListener(
        'inspect-failure',
        () => {
          document.documentElement.dataset.resources = JSON.stringify({
            devices,
            destroyed,
            canvasesReleased: [...canvases].every(
              (canvas) => canvas.width === 0 && canvas.height === 0 && !canvas.isConnected,
            ),
          });
          Object.defineProperty(navigator, 'gpu', { value: gpu, configurable: true });
          gpu.requestAdapter = requestAdapter;
          HTMLImageElement.prototype.decode = decode;
          CanvasRenderingContext2D.prototype.getImageData = getImageData;
          HTMLCanvasElement.prototype.getContext = getContext;
        },
        { once: true },
      );
    }, mode);
    if (mode === 'capture-budget') {
      await page.route('**/manual.html', async (route) => {
        const response = await route.fetch();
        const body = (await response.text())
          .replace(/width:\s*160px/g, 'width:600px')
          .replace(/height:\s*64px/g, 'height:600px');
        await route.fulfill({ response, body });
      });
    }
    await page.goto('/manual.html');
    await expect(page.locator('#state')).toContainText('"lifecycle":"unavailable"');
    expect(await page.evaluate(() => window.manual.effect.reason)).toBe(mode);
    if (mode === 'capture-failed' || mode === 'renderer-failed') {
      expect(await page.evaluate(() => window.manual.effect.reasonDetail)).toBe(
        mode === 'capture-failed'
          ? 'capture-decode-failed: snapshot: injected capture decode failure'
          : 'injected renderer construction failure',
      );
    }
    await page.evaluate(() => document.dispatchEvent(new Event('inspect-failure')));
    expect(await page.locator('html').getAttribute('data-resources')).toBe(
      JSON.stringify({
        devices: mode === 'no-webgpu' || mode === 'no-adapter' ? 0 : 1,
        destroyed: mode === 'no-webgpu' || mode === 'no-adapter' ? 0 : 1,
        canvasesReleased: true,
      }),
    );
    await expect(page.locator('#manual-host canvas')).toHaveCount(0);
    await expect(page.locator('#manual-target')).toHaveText('Original target');
    if (mode === 'capture-budget') {
      await page.addStyleTag({ content: '#manual-target { width:160px; height:64px; }' });
    }
    expect(await page.locator('#manual-target').getAttribute('style')).toBeNull();
    await page.locator('#manual-target').click();
    await page.locator('#manual-target').press('Enter');
    await expect(page.locator('#clicks')).toHaveText('Target clicks: 2');
    const result = await page.evaluate(async () => {
      const { effect, attach } = window.manual;
      const host = document.querySelector<HTMLElement>('#manual-host');
      const target = document.querySelector<HTMLElement>('#manual-target');
      if (!host || !target) {
        throw new Error('fixture');
      }
      target.blur();
      const next = attach(target, { host });
      await next.ready;
      // Disposing the failed handle must not release the new owner's claim.
      effect.dispose();
      let duplicateRejected = false;
      try {
        attach(target, { host });
      } catch {
        duplicateRejected = true;
      }
      const lifecycle = next.lifecycle;
      next.dispose();
      return { lifecycle, duplicateRejected };
    });
    expect(result).toEqual({ lifecycle: 'active', duplicateRejected: true });
  });
}

test('programmer errors never register a target', async ({ page }) => {
  await page.goto('/manual.html');
  await expect(page.locator('#state')).toContainText('"lifecycle":"active"');
  const results = await page.evaluate(async () => {
    const { effect, attach } = window.manual;
    effect.dispose();
    const host = document.querySelector<HTMLElement>('#manual-host');
    const target = document.querySelector<HTMLElement>('#manual-target');
    if (!host || !target) {
      throw new Error('fixture');
    }
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.style.position = 'relative';
    const svgTarget = document.createElementNS(svg.namespaceURI, 'rect');
    svg.append(svgTarget);
    host.append(svg);
    const foreignHost = document.implementation.createHTMLDocument().body;
    const cases: [unknown, unknown, string][] = [
      [null, { host }, 'invalid-effect-target'],
      [{}, { host }, 'invalid-effect-target'],
      [target, undefined, 'invalid-fire-options'],
      [target, null, 'invalid-fire-options'],
      [target, 1, 'invalid-fire-options'],
      [target, {}, 'invalid-effect-host'],
      [target, { host: null }, 'invalid-effect-host'],
      [target, { host: {} }, 'invalid-effect-host'],
      [target, { host: foreignHost }, 'invalid-effect-host'],
      [target, { host: document.body }, 'invalid-effect-host'],
      [host, { host }, 'invalid-effect-host'],
      [document.body, { host }, 'invalid-effect-host'],
      [svgTarget, { host: svg }, 'invalid-effect-host'],
      [target, { host, clock: 'invalid' }, 'invalid-clock-mode'],
      [target, { host, clock: null }, 'invalid-clock-mode'],
      [target, { host, motion: 'animate' }, 'invalid-motion-policy'],
      [target, { host, motion: null }, 'invalid-motion-policy'],
    ];
    for (const parameter of ['seed', 'time', 'intensity']) {
      for (const value of [NaN, Infinity, -Infinity, Number.MAX_VALUE, null, '1']) {
        cases.push([target, { host, [parameter]: value }, 'invalid-fire-parameter']);
      }
    }
    const results: boolean[] = [];
    for (const [candidate, options, expected] of cases) {
      try {
        const unexpected = Reflect.apply(attach, undefined, [candidate, options]);
        unexpected.dispose();
        results.push(false);
      } catch (error) {
        results.push(error instanceof Error && error.message === expected);
      }
      const valid = attach(target, { host });
      valid.dispose();
      await valid.ready;
    }
    // A disconnected host and its descendant also reject before registration.
    host.remove();
    try {
      attach(target, { host });
      results.push(false);
    } catch (error) {
      results.push(error instanceof Error && error.message === 'invalid-effect-host');
    }
    document.body.append(host);
    const wrapper = document.createElement('div');
    target.before(wrapper);
    wrapper.append(target);
    const valid = attach(target, { host });
    await valid.ready;
    for (const candidate of [target, target.querySelector('span'), wrapper]) {
      try {
        Reflect.apply(attach, undefined, [candidate, { host }]);
        results.push(false);
      } catch (error) {
        results.push(error instanceof Error && error.message === 'effect-target-owned');
      }
    }
    results.push(valid.lifecycle === 'active');
    valid.dispose();
    // The rejected ancestor/descendant claims must not survive the actual owner.
    for (const candidate of [wrapper, target.querySelector('span')]) {
      if (!candidate) {
        throw new Error('fixture');
      }
      const next = attach(candidate, { host });
      next.dispose();
      await next.ready;
    }
    return results;
  });
  expect(results.length).toBe(40);
  expect(results.every(Boolean)).toBe(true);
});
