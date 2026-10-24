import { expect, test } from '@playwright/test';

import type {} from '../src/manual.js';

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
