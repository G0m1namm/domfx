import { expect, test } from '@playwright/test';

import type {} from '../src/material-extent.js';

for (const relative of [false, true]) {
  test(`Slime drip density controls emitters without changing travel (${relative ? 'relative' : 'legacy'})`, async ({
    page,
  }) => {
    await page.goto('/material-extent.html');
    await page.waitForFunction(() => Boolean(window.materials));
    const result = await page.evaluate(async (relative) => {
      const host = document.querySelector<HTMLElement>('#host')!;
      const target = document.querySelector<HTMLElement>('#target')!;
      target.style.cssText =
        'display:block;width:200px;height:100px;border:0;background:white;margin:100px';
      const sample = async (dripDensity: number | undefined) => {
        const effect = window.materials.slime(target, {
          host,
          seed: 314,
          intensity: 1,
          ...(relative ? { coatingDepth: 0.05, dripReach: 0.6 } : {}),
          ...(dripDensity === undefined ? {} : { dripDensity }),
        });
        await effect.ready;
        if (effect.lifecycle !== 'active') {
          throw new Error(`${effect.lifecycle}: ${effect.reasonDetail}`);
        }
        const canvas = host.querySelector('canvas')!;
        const size = [canvas.width, canvas.height];
        const retained = window.materials.memory(document).bytes;
        const outputs: number[][] = [];
        let exterior = 0;
        let boundary = 0;
        for (const time of [1, 2.7, 4.5]) {
          effect.time = time;
          await new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
          );
          const image = new Image();
          image.src = canvas.toDataURL();
          await image.decode();
          const copy = document.createElement('canvas');
          copy.width = canvas.width;
          copy.height = canvas.height;
          const context = copy.getContext('2d')!;
          context.drawImage(image, 0, 0);
          const rgba = context.getImageData(0, 0, copy.width, copy.height).data;
          outputs.push(Array.from(rgba));
          const box = canvas.getBoundingClientRect();
          const bottom =
            ((target.getBoundingClientRect().bottom + 8 - box.top) * canvas.height) / box.height;
          for (let y = 0; y < canvas.height; y++) {
            for (let x = 0; x < canvas.width; x++) {
              const alpha = rgba[(y * canvas.width + x) * 4 + 3];
              if (y > bottom && alpha > 16) {
                exterior++;
              }
              if (x === 0 || y === 0 || x === canvas.width - 1 || y === canvas.height - 1) {
                boundary += alpha;
              }
            }
          }
        }
        // Seek backwards to the first frame; density uses the existing seed/absolute time.
        effect.time = 1;
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        );
        const repeated = canvas.toDataURL();
        effect.time = 4.5;
        effect.time = 1;
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        );
        const deterministic = repeated === canvas.toDataURL();
        effect.dispose();
        return { outputs, exterior, boundary, size, retained, deterministic };
      };
      const omitted = await sample(undefined);
      const normal = await sample(0.56);
      const none = await sample(0);
      const sparse = await sample(0.2);
      const dense = await sample(1);
      return {
        defaultExact: JSON.stringify(omitted.outputs) === JSON.stringify(normal.outputs),
        none: none.exterior,
        coatingRetained: none.outputs.some((rgba) =>
          rgba.some((value, index) => index % 4 === 3 && value > 0),
        ),
        sparse: sparse.exterior,
        normal: normal.exterior,
        dense: dense.exterior,
        sameAllocation: [normal, none, sparse, dense].every(
          (value) =>
            JSON.stringify(value.size) === JSON.stringify(omitted.size) &&
            value.retained === omitted.retained,
        ),
        boundary: [omitted, normal, none, sparse, dense].reduce(
          (sum, value) => sum + value.boundary,
          0,
        ),
        deterministic: [omitted, normal, none, sparse, dense].every((value) => value.deterministic),
        released: window.materials.memory(document).bytes,
        canvases: host.querySelectorAll('canvas').length,
      };
    }, relative);
    expect(result.defaultExact).toBe(true);
    expect(result.coatingRetained).toBe(true);
    expect(result.none).toBe(0);
    // A low density can select no eligible drip in this finite time sample.
    expect(result.normal).toBeGreaterThan(result.sparse);
    expect(result.dense).toBeGreaterThan(result.normal);
    expect(result).toMatchObject({
      sameAllocation: true,
      boundary: 0,
      deterministic: true,
      released: 0,
      canvases: 0,
    });
  });

  test(`Slime high density adds distinct visible drips on an image (${relative ? 'relative' : 'legacy'})`, async ({
    page,
  }) => {
    await page.goto('/material-extent.html');
    await page.waitForFunction(() => Boolean(window.materials));
    const counts = await page.evaluate(async (relative) => {
      const host = document.querySelector<HTMLElement>('#host')!;
      const target = new Image(200, 150);
      const silhouette = document.createElement('canvas');
      silhouette.width = 200;
      silhouette.height = 150;
      const pen = silhouette.getContext('2d')!;
      pen.strokeStyle = 'white';
      pen.lineWidth = 12;
      pen.beginPath();
      pen.arc(100, 75, 45, 0, Math.PI * 2);
      pen.stroke();
      target.src = silhouette.toDataURL();
      target.style.cssText =
        'display:block;width:200px;height:150px;object-fit:contain;margin:100px';
      host.replaceChildren(target);
      await target.decode();
      const frames: Uint8ClampedArray[][] = [];
      let width = 0;
      let height = 0;
      for (const dripDensity of [0, 0.56, 1]) {
        const effect = window.materials.slime(target, {
          host,
          clock: 'manual',
          seed: 314,
          intensity: 0.8,
          dripDensity,
          ...(relative ? { coatingDepth: 0.05, dripReach: 0.2 } : {}),
        });
        await effect.ready;
        if (effect.lifecycle !== 'active') {
          throw new Error(`${effect.lifecycle}: ${effect.reasonDetail}`);
        }
        const canvas = host.querySelector('canvas')!;
        width = canvas.width;
        height = canvas.height;
        const copy = document.createElement('canvas');
        copy.width = width;
        copy.height = height;
        const context = copy.getContext('2d')!;
        const samples: Uint8ClampedArray[] = [];
        // Sample a full growth/release cycle so a different phase cannot pass.
        for (let frame = 0; frame < 24; frame++) {
          effect.time = frame * 0.5;
          await new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
          );
          const image = new Image();
          image.src = canvas.toDataURL();
          await image.decode();
          context.clearRect(0, 0, width, height);
          context.drawImage(image, 0, 0);
          samples.push(context.getImageData(0, 0, width, height).data);
        }
        frames.push(samples);
        effect.dispose();
      }
      return frames.slice(1).map((samples) => {
        let total = 0;
        for (const [frame, rgba] of samples.entries()) {
          const mask = new Uint8Array(width * height);
          for (let pixel = 0; pixel < mask.length; pixel++) {
            // Subtract the animated coating, leaving exterior drip silhouettes.
            if (rgba[pixel * 4 + 3] > 48 && frames[0][frame][pixel * 4 + 3] < 16) {
              mask[pixel] = 1;
            }
          }
          for (let pixel = 0; pixel < mask.length; pixel++) {
            if (!mask[pixel]) {
              continue;
            }
            const queue = [pixel];
            mask[pixel] = 0;
            let firstRow = height;
            let lastRow = 0;
            for (let index = 0; index < queue.length; index++) {
              const current = queue[index];
              const x = current % width;
              const y = Math.floor(current / width);
              firstRow = Math.min(firstRow, y);
              lastRow = Math.max(lastRow, y);
              for (const [nextX, nextY] of [
                [x - 1, y],
                [x + 1, y],
                [x, y - 1],
                [x, y + 1],
              ]) {
                if (nextX < 0 || nextX >= width || nextY < 0 || nextY >= height) {
                  continue;
                }
                const next = nextY * width + nextX;
                if (mask[next]) {
                  mask[next] = 0;
                  queue.push(next);
                }
              }
            }
            // At DPR 2, reject tiny AA fragments: at least 3 CSS px² and 2px tall.
            if (queue.length >= 12 && lastRow - firstRow >= 4) {
              total++;
            }
          }
        }
        return total / samples.length;
      });
    }, relative);
    // Measure separate visible drips, not increased alpha area on existing drops.
    expect(counts[1]).toBeGreaterThanOrEqual(counts[0] + 1);
  });
}

test('Slime rejects invalid drip density before claiming the target', async ({ page }) => {
  await page.goto('/material-extent.html');
  await page.waitForFunction(() => Boolean(window.materials));
  const result = await page.evaluate(async () => {
    const host = document.querySelector<HTMLElement>('#host')!;
    const target = document.querySelector<HTMLElement>('#target')!;
    target.style.cssText = 'display:block;width:100px;height:100px;border:0;background:white';
    const errors = [];
    for (const dripDensity of [-1, 1.01, NaN, Infinity, null, '0.5']) {
      try {
        // @ts-expect-error Deliberately invalid JavaScript input must fail at the public boundary.
        const effect = window.materials.slime(target, { host, dripDensity });
        effect.dispose();
        errors.push('accepted');
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      }
    }
    const effect = window.materials.slime(target, { host });
    await effect.ready;
    const lifecycle = effect.lifecycle;
    effect.dispose();
    return { errors, lifecycle, canvases: host.querySelectorAll('canvas').length };
  });
  expect(result.errors).toEqual(Array(6).fill('invalid-slime-parameter'));
  expect(result).toMatchObject({ lifecycle: 'active', canvases: 0 });
});
