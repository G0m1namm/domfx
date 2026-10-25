import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { expect, test } from '@playwright/test';

test('Fire half density adds a visible ember lane on tight artwork', async ({ page }) => {
  await page.goto('/controls.html');
  await page.waitForFunction(() => Boolean(window.controlEffects));
  const result = await page.evaluate(async () => {
    const host = document.querySelector<HTMLElement>('#host')!;
    const settle = () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
    const output = async () => {
      const canvas = host.querySelector('canvas')!;
      const image = new Image();
      image.src = canvas.toDataURL();
      await image.decode();
      const copy = document.createElement('canvas');
      copy.width = image.width;
      copy.height = image.height;
      const context = copy.getContext('2d')!;
      context.drawImage(image, 0, 0);
      return {
        pixels: [...context.getImageData(0, 0, copy.width, copy.height).data],
        png: canvas.toDataURL('image/png'),
        width: copy.width,
        height: copy.height,
      };
    };
    const equal = (left: readonly number[], right: readonly number[]) =>
      left.length === right.length && left.every((value, index) => value === right[index]);
    const components = (
      none: { pixels: readonly number[]; width: number; height: number },
      density: { pixels: readonly number[]; width: number; height: number },
      sourceTop: number,
    ) => {
      const mask = new Uint8Array(none.width * none.height);
      for (let index = 0; index < mask.length; index++) {
        const offset = index * 4;
        const mass =
          Math.abs(none.pixels[offset]! - density.pixels[offset]!) +
          Math.abs(none.pixels[offset + 1]! - density.pixels[offset + 1]!) +
          Math.abs(none.pixels[offset + 2]! - density.pixels[offset + 2]!);
        mask[index] = Number(mass > 32);
      }
      const parts: Array<{
        area: number;
        left: number;
        top: number;
        right: number;
        bottom: number;
      }> = [];
      for (let start = 0; start < mask.length; start++) {
        if (!mask[start]) {
          continue;
        }
        const queue = [start];
        mask[start] = 0;
        let left = none.width;
        let top = none.height;
        let right = 0;
        let bottom = 0;
        for (let cursor = 0; cursor < queue.length; cursor++) {
          const current = queue[cursor]!;
          const x = current % none.width;
          const y = Math.floor(current / none.width);
          left = Math.min(left, x);
          top = Math.min(top, y);
          right = Math.max(right, x);
          bottom = Math.max(bottom, y);
          for (const [nextX, nextY] of [
            [x - 1, y],
            [x + 1, y],
            [x, y - 1],
            [x, y + 1],
          ]) {
            if (nextX < 0 || nextX >= none.width || nextY < 0 || nextY >= none.height) {
              continue;
            }
            const next = nextY * none.width + nextX;
            if (mask[next]) {
              mask[next] = 0;
              queue.push(next);
            }
          }
        }
        if (queue.length >= 2 && bottom < sourceTop) {
          parts.push({ area: queue.length, left, top, right, bottom });
        }
      }
      return parts;
    };
    const make = (
      kind: 'text' | 'rect-hole-svg' | 'transparent-png' | 'marketing-asterisk',
      size: number,
    ) => {
      const height = kind === 'marketing-asterisk' ? size : Math.round((size * 2) / 3);
      const target = document.createElement(kind === 'transparent-png' ? 'img' : 'div');
      target.style.cssText = `display:block;width:${size}px;height:${height}px;background:transparent`;
      let sourceTop = 0;
      if (kind === 'text') {
        target.textContent = 'Fi';
        target.setAttribute(
          'style',
          `${target.style.cssText};color:white;font:${Math.round(size * 0.32)}px/1 sans-serif`,
        );
      } else if (kind === 'rect-hole-svg') {
        sourceTop = 8;
        target.innerHTML = `<svg viewBox="0 0 ${size} ${height}" width="${size}" height="${height}"><path fill="white" fill-rule="evenodd" d="M8 8h${size - 16}v${height - 16}H8zM${Math.floor(size / 3)} ${Math.floor(height / 3)}h${Math.floor(size / 3)}v${Math.floor(height / 3)}H${Math.floor(size / 3)}z"/></svg>`;
      } else if (kind === 'transparent-png') {
        sourceTop = 8;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = height;
        const pen = canvas.getContext('2d')!;
        pen.fillStyle = 'white';
        pen.fillRect(8, 8, size - 16, height - 16);
        pen.clearRect(
          Math.floor(size / 3),
          Math.floor(height / 3),
          Math.floor(size / 3),
          Math.floor(height / 3),
        );
        (target as HTMLImageElement).src = canvas.toDataURL();
      } else {
        target.innerHTML = `<svg viewBox="0 0 160 160" width="${size}" height="${size}"><path fill="#C2C5DB" d="M64 8H96V45L122 19L145 42L119 68H156V100H119L145 126L122 149L96 123V160H64V123L38 149L15 126L41 100H4V68H41L15 42L38 19L64 45Z"/></svg>`;
      }
      host.replaceChildren(target);
      return { target, sourceTop };
    };
    const samples: Array<{
      kind: string;
      size: number;
      time: number;
      seed: number;
      repeat: boolean;
      halfExteriorComponents: number;
      fullExteriorComponents: number;
      halfExteriorArea: number;
      fullExteriorArea: number;
      halfMatchesFull: boolean;
      half: string;
      full: string;
      none: string;
    }> = [];
    for (const kind of [
      'text',
      'rect-hole-svg',
      'transparent-png',
      'marketing-asterisk',
    ] as const) {
      for (const size of kind === 'marketing-asterisk' ? [260] : [96, 240]) {
        for (const [time, seed] of [
          [0.7, 314],
          [1.4, 271],
        ] as const) {
          const { target, sourceTop } = make(kind, size);
          const render = async (emberDensity: number) => {
            const effect = window.controlEffects.fire(target, {
              host,
              clock: 'manual',
              motion: 'static',
              time,
              seed,
              intensity: 1,
              emberDensity,
            });
            await effect.ready;
            await settle();
            const pixels = await output();
            effect.dispose();
            return pixels;
          };
          const none = await render(0);
          const half = await render(0.5);
          const full = await render(1);
          const halfRepeat = await render(0.5);
          const sourceTopPixels = (32 + sourceTop) * (full.height / (target.clientHeight + 64));
          const halfExterior = components(none, half, sourceTopPixels);
          const fullExterior = components(none, full, sourceTopPixels);
          samples.push({
            kind,
            size,
            time,
            seed,
            repeat: equal(half.pixels, halfRepeat.pixels),
            halfExteriorComponents: halfExterior.length,
            fullExteriorComponents: fullExterior.length,
            halfExteriorArea: halfExterior.reduce((area, part) => area + part.area, 0),
            fullExteriorArea: fullExterior.reduce((area, part) => area + part.area, 0),
            halfMatchesFull: halfExterior.every((halfPart) =>
              fullExterior.some(
                (fullPart) =>
                  halfPart.left >= fullPart.left - 1 &&
                  halfPart.right <= fullPart.right + 1 &&
                  halfPart.top >= fullPart.top - 1 &&
                  halfPart.bottom <= fullPart.bottom + 1,
              ),
            ),
            none: none.png,
            half: half.png,
            full: full.png,
          });
        }
      }
    }
    return { samples, canvases: host.querySelectorAll('canvas').length };
  });
  const outputDirectory = resolve(
    import.meta.dirname,
    '../../../.scratch/194-revision/fire-density-tight-native',
  );
  await mkdir(outputDirectory, { recursive: true });
  for (const sample of result.samples) {
    const stem = `${sample.kind}-${sample.size}-t${sample.time}-s${sample.seed}`;
    for (const density of ['none', 'half', 'full'] as const) {
      await writeFile(
        resolve(outputDirectory, `${stem}-${density}.png`),
        Buffer.from(sample[density].split(',', 2)[1]!, 'base64'),
      );
    }
  }
  await writeFile(
    resolve(outputDirectory, 'summary.json'),
    JSON.stringify(
      {
        ...result,
        samples: result.samples.map(
          ({ none: _none, half: _half, full: _full, ...sample }) => sample,
        ),
      },
      null,
      2,
    ),
  );
  expect(result.samples).toHaveLength(14);
  expect(result.samples.every((sample) => sample.repeat)).toBe(true);
  expect(result.samples.every((sample) => sample.halfMatchesFull)).toBe(true);
  for (const kind of ['text', 'rect-hole-svg', 'transparent-png', 'marketing-asterisk']) {
    for (const size of kind === 'marketing-asterisk' ? [260] : [96, 240]) {
      const pair = result.samples.filter((sample) => sample.kind === kind && sample.size === size);
      expect(pair).toHaveLength(2);
      expect(
        pair.every((sample) => sample.fullExteriorComponents > sample.halfExteriorComponents),
      ).toBe(true);
      expect(
        pair.reduce(
          (difference, sample) => difference + sample.fullExteriorArea - sample.halfExteriorArea,
          0,
        ),
      ).toBeGreaterThanOrEqual(75);
    }
  }
  expect(result.canvases).toBe(0);
});
