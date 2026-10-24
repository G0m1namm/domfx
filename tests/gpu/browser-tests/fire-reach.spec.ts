import { expect, test } from '@playwright/test';

import type {} from '../src/manual.js';

test('DPR-only changes recapture relative geometry without changing the local box', async ({
  page,
}) => {
  await page.goto('/manual.html');
  await page.evaluate(async () => {
    await window.manual.effect.ready;
    window.manual.effect.dispose();
    const host = document.querySelector<HTMLElement>('#manual-host');
    const target = document.querySelector('#manual-target');
    if (!host || !target) {
      throw new Error('fixture');
    }
    window.manual.effect = window.manual.attach(target, {
      host,
      flameReach: 0.5,
      time: 1.5,
      seed: 314,
    });
    await window.manual.effect.ready;
  });
  const session = await page.context().newCDPSession(page);
  await session.send('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 900,
    deviceScaleFactor: 1.25,
    mobile: false,
  });
  await expect.poll(() => page.locator('#manual-host canvas').getAttribute('width')).toBe('295');
  expect(
    await page
      .locator('#manual-target')
      .evaluate((target) => target.getBoundingClientRect().height),
  ).toBe(64);
  expect(await page.evaluate(() => window.manual.effect.lifecycle)).toBe('active');
  await page.evaluate(() => window.manual.effect.dispose());
});

test('tiny reach, allocation rejection and distant overflow preserve cleanup', async ({ page }) => {
  await page.goto('/manual.html');
  await page.evaluate(() => window.manual.effect.ready);
  const result = await page.evaluate(async () => {
    window.manual.effect.dispose();
    const host = document.querySelector<HTMLElement>('#manual-host');
    const target = document.querySelector<HTMLElement>('#manual-target');
    if (!host || !target) {
      throw new Error('fixture');
    }
    target.style.width = '100px';
    target.style.height = '100px';
    const tiny = [];
    for (const flameReach of [0, 0.001, 0.005, 0.01]) {
      const effect = window.manual.attach(target, { host, flameReach, time: 1.5, seed: 314 });
      await effect.ready;
      tiny.push(effect.lifecycle);
      effect.dispose();
    }
    const escaped = document.createElement('span');
    escaped.style.cssText = 'position:absolute;left:2000px;width:10px;height:10px;background:white';
    target.append(escaped);
    const overflow = window.manual.attach(target, { host, flameReach: 0.1 });
    await overflow.ready;
    const overflowReason = overflow.reason;
    overflow.dispose();
    escaped.remove();
    target.style.width = '400px';
    target.style.height = '400px';
    const rejected = [];
    for (const flameReach of [0.2, Number.MAX_VALUE]) {
      const effect = window.manual.attach(target, { host, flameReach });
      await effect.ready;
      rejected.push(effect.reason);
      effect.dispose();
    }
    target.style.width = '100px';
    target.style.height = '100px';
    const recovered = window.manual.attach(target, { host, flameReach: 0.1 });
    await recovered.ready;
    const active = recovered.lifecycle === 'active';
    recovered.dispose();
    return {
      tiny,
      overflowReason,
      rejected,
      active,
      canvases: host.querySelectorAll('canvas').length,
      visible: getComputedStyle(target).visibility,
    };
  });
  expect(result).toEqual({
    tiny: Array(4).fill('active'),
    overflowReason: 'missing-exterior',
    rejected: ['capture-budget', 'capture-budget'],
    active: true,
    canvases: 0,
    visible: 'visible',
  });
});

for (const dpr of [1, 1.25, 2]) {
  test.describe(`relative Fire lifecycle DPR ${dpr}`, () => {
    test.use({ deviceScaleFactor: dpr });
    test('resize resolves reach and placement/strength retain allocations', async ({
      page,
    }, info) => {
      await page.goto('/manual.html');
      await page.evaluate(() => window.manual.effect.ready);
      const result = await page.evaluate(() => window.manual.verifyFireReachLifecycle());
      await info.attach('relative-fire-lifecycle.json', {
        body: JSON.stringify(result),
        contentType: 'application/json',
      });
      expect(result.errors).toEqual([]);
      expect(result.placementOnly).toBe(true);
      expect(result.first.box.height).toBe(100.25);
      expect(result.resized.box.height).toBe(400);
      expect(result.first.reach).toBeGreaterThan(4);
      expect(result.resized.reach).toBeGreaterThan(result.first.reach * 2);
      expect(result.scaleSample).toEqual(result.first);
      expect(result.refreshed).toEqual(result.resized);
      expect(result.first.boundary).toBe(0);
      expect(result.resized.boundary).toBe(0);
      expect(result).toMatchObject({
        rejected: { reason: 'missing-exterior', bytes: 0, canvases: 0 },
        recovered: true,
        releasedBytes: 0,
        managedBytes: 0,
      });
    });
  });
}

for (const dpr of [1, 2]) {
  test(`relative Fire has finite target-anchored support at DPR ${dpr}`, async ({ page }, info) => {
    await page.goto('/manual.html');
    await page.evaluate(() => window.manual.effect.ready);
    const result = await page.evaluate((dpr) => window.manual.verifyFireReachGeometry(dpr), dpr);
    await info.attach('relative-fire-geometry.json', {
      body: JSON.stringify(result),
      contentType: 'application/json',
    });
    expect(result.errors).toEqual([]);
    expect(result.managedBytes).toBe(0);
    for (const sample of result.samples) {
      expect(sample.boundaryAlpha).toBe(0);
      expect(sample.supportAlpha).toBe(0);
      expect(sample.maxDifference).toBeLessThanOrEqual(2);
    }
    const flat = result.samples.filter((sample) => sample.kind === 'flat');
    expect(flat[0].maxReach).toBeGreaterThan(4);
    expect(flat[1].maxReach).toBeGreaterThan(flat[0].maxReach * 2);
  });
}

test('relative Fire validates options before claiming ownership', async ({ page }) => {
  await page.goto('/manual.html');
  await page.evaluate(() => window.manual.effect.ready);
  const result = await page.evaluate(async () => {
    window.manual.effect.dispose();
    const host = document.querySelector<HTMLElement>('#manual-host')!;
    const target = document.querySelector('#manual-target')!;
    const rejected = [];
    for (const options of [
      { flameReach: -1 },
      { flameReach: NaN },
      { flameReach: Infinity },
      { flameReach: null },
      { flameReach: '0.1' },
      { flameReach: 0.1, flameHeight: 24 },
    ]) {
      try {
        const effect = Reflect.apply(window.manual.attach, undefined, [
          target,
          { host, ...options },
        ]);
        effect.dispose();
        rejected.push(false);
      } catch (error) {
        rejected.push(error instanceof Error && error.message === 'invalid-fire-parameter');
      }
    }
    const next = window.manual.attach(target, { host, flameReach: 0 });
    await next.ready;
    const active = next.lifecycle === 'active';
    next.dispose();
    return { rejected, active, canvases: host.querySelectorAll('canvas').length };
  });
  expect(result).toEqual({ rejected: Array(6).fill(true), active: true, canvases: 0 });
});

test('relative Fire strength scales premultiplied output without changing geometry', async ({
  page,
}) => {
  await page.goto('/manual.html');
  await page.evaluate(() => window.manual.effect.ready);
  const result = await page.evaluate(async () => {
    window.manual.effect.dispose();
    const host = document.querySelector<HTMLElement>('#manual-host')!;
    const target = document.querySelector('#manual-target')!;
    const effect = window.manual.attach(target, { host, flameReach: 0.6, time: 1.5, seed: 314 });
    await effect.ready;
    const sample = async (intensity: number) => {
      effect.intensity = intensity;
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
      const canvas = host.querySelector('canvas')!;
      const image = new Image();
      image.src = canvas.toDataURL();
      await image.decode();
      const copy = document.createElement('canvas');
      copy.width = canvas.width;
      copy.height = canvas.height;
      const context = copy.getContext('2d')!;
      context.drawImage(image, 0, 0);
      const rgba = context.getImageData(0, 0, copy.width, copy.height).data;
      return Float32Array.from(rgba, (value, index) =>
        index % 4 === 3 ? value : (value * rgba[index - (index % 4) + 3]) / 255,
      );
    };
    const full = await sample(1);
    const errors = [];
    for (const strength of [0.25, 0.6]) {
      const pixels = await sample(strength);
      errors.push(
        pixels.reduce(
          (error, value, index) => Math.max(error, Math.abs(value - full[index] * strength)),
          0,
        ),
      );
    }
    const repeated = await sample(1);
    const zero = await sample(0);
    effect.dispose();
    const empty = window.manual.attach(target, { host, flameReach: 0 });
    await empty.ready;
    const image = new Image();
    image.src = host.querySelector('canvas')!.toDataURL();
    await image.decode();
    const copy = document.createElement('canvas');
    copy.width = image.width;
    copy.height = image.height;
    const context = copy.getContext('2d')!;
    context.drawImage(image, 0, 0);
    const emptyReach = context
      .getImageData(0, 0, copy.width, copy.height)
      .data.every((value) => value === 0);
    empty.dispose();
    return {
      errors,
      nonempty: full.some((value) => value > 0),
      repeat: full.every((value, index) => value === repeated[index]),
      zero: zero.every((value) => value === 0),
      emptyReach,
    };
  });
  expect(result.errors.every((error) => error <= 2)).toBe(true);
  expect(result).toMatchObject({ nonempty: true, repeat: true, zero: true, emptyReach: true });
});
