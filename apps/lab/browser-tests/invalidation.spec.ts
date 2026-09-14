import { expect, test } from '@playwright/test';

import type {} from '../src/manual.js';

// Observe real snapshot readbacks without replacing capture or GPU rendering.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const read = CanvasRenderingContext2D.prototype.getImageData;
    CanvasRenderingContext2D.prototype.getImageData = function (...args) {
      const result = read.apply(this, args);
      let hash = 2166136261;
      for (const value of result.data) {
        hash = Math.imul(hash ^ value, 16777619);
      }
      const state = document.documentElement.dataset;
      state.captures = String(Number(state.captures ?? 0) + 1);
      state.captureHash = String(hash >>> 0);
      return result;
    };
  });
  await page.goto('/manual.html');
  await expect(page.locator('#state')).toContainText('"lifecycle":"active"');
});

test('paint bursts refresh once, preserve controls and ignore decorative output', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const before = await page.locator('html').getAttribute('data-capture-hash');
  const hidden = await page.evaluate(async () => {
    const target = document.querySelector<HTMLElement>('#manual-target')!;
    target.style.borderRadius = '50%';
    await Promise.resolve();
    target.style.width = '100px';
    target.querySelector('span')!.textContent = 'Updated';
    await Promise.resolve();
    return (
      window.manual.effect.raster === 'stale' &&
      document.querySelector<HTMLCanvasElement>('#manual-host canvas')!.style.display === 'none'
    );
  });
  expect(hidden).toBe(true);
  await expect.poll(() => page.evaluate(() => window.manual.effect.raster)).toBe('fresh');
  await expect(page.locator('html')).toHaveAttribute('data-captures', '2');
  const changed = await page.locator('html').getAttribute('data-capture-hash');
  expect(changed).not.toBe(before);
  const result = await page.evaluate(async () => {
    const { effect, capture } = window.manual;
    const canvas = document.querySelector<HTMLCanvasElement>('#manual-host canvas')!;
    const replacement = await capture(1.5, 0.85);
    canvas.style.opacity = '.9';
    canvas.setAttribute('data-decoration', 'changed');
    // Give both the insertion and style changes several opportunities to feed back.
    for (let i = 0; i < 5; i += 1) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }
    const captures = document.documentElement.dataset.captures;
    const preserved = effect.time === 1.5 && effect.intensity === 0.85 && effect.seed === 314;
    effect.dispose();
    const host = document.querySelector<HTMLElement>('#manual-host')!;
    const target = document.querySelector('#manual-target')!;
    const reference = window.manual.attach(target, { host, seed: 314, time: 1.5, intensity: 0.85 });
    await reference.ready;
    const matches = replacement === host.querySelector('canvas')!.toDataURL();
    reference.dispose();
    return { captures, preserved, matches };
  });
  expect(result).toEqual({ captures: '2', preserved: true, matches: true });
  expect(await page.locator('html').getAttribute('data-capture-hash')).toBe(changed);
  expect(errors).toEqual([]);
  await testInfo.attach('automatic-freshness.json', {
    body: JSON.stringify({ before, changed, ...result }),
    contentType: 'application/json',
  });
});

test('unobserved stylesheet size changes refresh; placement transforms do not', async ({
  page,
}) => {
  await page.evaluate(() => {
    const style = document.createElement('style');
    style.textContent = '#manual-target { width: 111px !important; }';
    document.head.append(style);
  });
  await expect(page.locator('#manual-host canvas')).toHaveAttribute('width', '350');
  await expect.poll(() => page.evaluate(() => window.manual.effect.raster)).toBe('fresh');
  await expect(page.locator('html')).toHaveAttribute('data-captures', '2');
  await page.evaluate(async () => {
    document.querySelector<HTMLElement>('#manual-target')!.style.transform =
      'translate(5px, 8px) scale(1.2)';
    document.querySelector<HTMLElement>('#manual-host')!.style.transform =
      'translate(7px, 2px) scale(.9)';
    for (let i = 0; i < 5; i += 1) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }
  });
  await expect(page.locator('html')).toHaveAttribute('data-captures', '2');
  await page.evaluate(() => {
    document.querySelector<HTMLElement>('#manual-target span')!.style.transform = 'translateX(9px)';
  });
  await expect(page.locator('html')).toHaveAttribute('data-captures', '3');
  await expect.poll(() => page.evaluate(() => window.manual.effect.raster)).toBe('fresh');
});

test('explicit refresh absorbs queued observation and disposal cancels it', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const target = document.querySelector<HTMLElement>('#manual-target')!;
    target.style.background = 'red';
    await Promise.resolve();
    await window.manual.effect.refresh();
    for (let i = 0; i < 3; i += 1) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }
    const captures = document.documentElement.dataset.captures;
    target.textContent = 'dispose queued work';
    await Promise.resolve();
    window.manual.effect.dispose();
    target.style.width = '80px';
    target.dispatchEvent(new Event('load'));
    document.fonts.dispatchEvent(new Event('loadingdone'));
    window.dispatchEvent(new Event('resize'));
    for (let i = 0; i < 3; i += 1) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }
    return {
      captures,
      after: document.documentElement.dataset.captures,
      lifecycle: window.manual.effect.lifecycle,
      canvases: document.querySelectorAll('#manual-host canvas').length,
    };
  });
  expect(result).toEqual({ captures: '2', after: '2', lifecycle: 'disposed', canvases: 0 });
});

test('observer capture failure reports health, cleans up and never retries', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.evaluate(() => {
    HTMLImageElement.prototype.decode = async () => {
      throw new Error('observer decode failure');
    };
    document.querySelector<HTMLElement>('#manual-target')!.style.background = 'red';
  });
  await expect.poll(() => page.evaluate(() => window.manual.effect.lifecycle)).toBe('unavailable');
  expect(
    await page.evaluate(() => ({
      raster: window.manual.effect.raster,
      reason: window.manual.effect.reason,
      detail: window.manual.effect.reasonDetail,
    })),
  ).toMatchObject({
    raster: 'stale',
    reason: 'capture-failed',
    detail: expect.stringContaining('capture-decode-failed'),
  });
  await expect(page.locator('#manual-host canvas')).toHaveCount(0);
  await page.evaluate(async () => {
    document.querySelector('#manual-target')!.textContent = 'still usable';
    document.fonts.dispatchEvent(new Event('loadingdone'));
    for (let i = 0; i < 3; i += 1) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }
  });
  await expect(page.locator('html')).toHaveAttribute('data-captures', '1');
  expect(errors).toEqual([]);
});

for (const style of ['outline:2px solid red;border:none', 'content-visibility:auto']) {
  test('source-mutating capture style fails once: ' + style, async ({ page }) => {
    const original = await page.evaluate((style) => {
      const target = document.querySelector<HTMLElement>('#manual-target')!;
      target.style.cssText += ';' + style;
      return target.getAttribute('style');
    }, style);
    await expect
      .poll(() => page.evaluate(() => window.manual.effect.lifecycle))
      .toBe('unavailable');
    expect(await page.evaluate(() => window.manual.effect.reasonDetail)).toContain(
      'capture source style mutation',
    );
    await expect(page.locator('#manual-target')).toHaveAttribute('style', original!);
    await expect(page.locator('#manual-host canvas')).toHaveCount(0);
    await expect(page.locator('html')).toHaveAttribute('data-captures', '1');
  });
}

for (const kind of ['image', 'background'] as const) {
  test(kind + ' source changes replace cached pixels automatically', async ({ page }) => {
    await page.evaluate((kind) => {
      const target = document.querySelector<HTMLElement>('#manual-target')!;
      if (kind === 'image') {
        const image = document.createElement('img');
        image.src = '/asset-fixtures/split.png';
        target.append(image);
      } else {
        target.style.backgroundImage = 'url("/asset-fixtures/split.png")';
      }
    }, kind);
    await expect(page.locator('html')).toHaveAttribute('data-captures', '2');
    await expect.poll(() => page.evaluate(() => window.manual.effect.raster)).toBe('fresh');
    const before = await page.locator('html').getAttribute('data-capture-hash');
    await page.evaluate((kind) => {
      const image = document.createElement('canvas');
      image.width = image.height = 40;
      const context = image.getContext('2d')!;
      context.fillStyle = 'lime';
      context.fillRect(0, 0, 40, 40);
      const url = image.toDataURL();
      const target = document.querySelector<HTMLElement>('#manual-target')!;
      if (kind === 'image') {
        target.querySelector('img')!.src = url;
      } else {
        target.style.backgroundImage = 'url("' + url + '")';
      }
      image.width = image.height = 0;
    }, kind);
    await expect(page.locator('html')).toHaveAttribute('data-captures', '3');
    await expect.poll(() => page.evaluate(() => window.manual.effect.raster)).toBe('fresh');
    const changed = await page.locator('html').getAttribute('data-capture-hash');
    expect(changed).not.toBe(before);
    await page.evaluate(() => window.manual.effect.refresh());
    expect(await page.locator('html').getAttribute('data-capture-hash')).toBe(changed);
  });
}

test('a target shown after stylesheet hiding captures again without a retry loop', async ({
  page,
}) => {
  await page.evaluate(() => {
    const style = document.createElement('style');
    style.id = 'hide-target';
    style.textContent = '#manual-target { display:none !important; }';
    document.head.append(style);
  });
  await expect.poll(() => page.evaluate(() => window.manual.effect.raster)).toBe('stale');
  await page.evaluate(async () => {
    for (let i = 0; i < 5; i += 1) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }
  });
  await expect(page.locator('html')).toHaveAttribute('data-captures', '1');
  await page.evaluate(() => document.querySelector('#hide-target')!.remove());
  await expect.poll(() => page.evaluate(() => window.manual.effect.raster)).toBe('fresh');
  await expect(page.locator('html')).toHaveAttribute('data-captures', '2');
  await expect(page.locator('#manual-host canvas')).toBeVisible();
});

test('font completion refreshes changed text pixels after readiness', async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/late-font.ttf', async (route) => {
    await gate;
    const response = await route.fetch({
      url: new URL('/asset-fixtures/block.ttf', page.url()).href,
    });
    await route.fulfill({ response });
  });
  const before = await page.locator('html').getAttribute('data-capture-hash');
  await page.evaluate(() => {
    const style = document.createElement('style');
    style.textContent =
      '@font-face { font-family: "Late Font"; src: url("/late-font.ttf"); } #manual-target { font-family: "Late Font"; }';
    document.head.append(style);
  });
  await expect.poll(() => page.evaluate(() => document.fonts.status)).toBe('loading');
  await expect(page.locator('#manual-host canvas')).toBeHidden();
  await expect(page.locator('html')).toHaveAttribute('data-captures', '1');
  release();
  await expect(page.locator('html')).toHaveAttribute('data-captures', '2');
  await expect.poll(() => page.evaluate(() => window.manual.effect.raster)).toBe('fresh');
  const changed = await page.locator('html').getAttribute('data-capture-hash');
  expect(changed).not.toBe(before);
  await page.evaluate(() => window.manual.effect.refresh());
  expect(await page.locator('html').getAttribute('data-capture-hash')).toBe(changed);
});
