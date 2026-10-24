import { expect, test } from '@playwright/test';

import type {} from '../src/material-extent.js';

for (const dpr of [1, 1.25, 2]) {
  test.describe(`fractional material box at DPR ${dpr}`, () => {
    test.use({ deviceScaleFactor: dpr });
    for (const family of ['frost', 'slime', 'burned-paper'] as const) {
      test(`${family} relative strength, zero components and deterministic seek`, async ({
        page,
      }) => {
        await page.goto('/material-extent.html');
        await page.waitForFunction(() => Boolean(window.materials));
        const result = await page.evaluate(async (family) => {
          const host = document.querySelector<HTMLElement>('#host')!;
          const target = document.querySelector<HTMLElement>('#target')!;
          target.style.cssText =
            'display:block;width:100.5px;height:100.25px;border:0;background:white';
          const options = {
            frost: { coatingDepth: 0.1, mistReach: 0.6 },
            slime: { coatingDepth: 0.05, dripReach: 0.6 },
            'burned-paper': { scorchDepth: 0.15, ashReach: 0.6 },
          };
          const attach = window.materials[family];
          const diagnostics = window.materials.diagnostics();
          const effect = attach(target, { host, ...options[family], seed: 314, time: 2.7 });
          await effect.ready;
          const state = {
            lifecycle: effect.lifecycle,
            reason: effect.reason,
            detail: effect.reasonDetail,
          };
          const sample = async (strength: number, time = 2.7) => {
            effect.time = time;
            effect.intensity = strength;
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
            const pixels = context.getImageData(0, 0, copy.width, copy.height).data;
            return Float32Array.from(pixels, (value, index) =>
              index % 4 === 3 ? value : (value * pixels[index - (index % 4) + 3]) / 255,
            );
          };
          if (effect.lifecycle !== 'active') {
            effect.dispose();
            return { state };
          }
          const captured = diagnostics.records.filter(
            (record) => record.stage === 'capture',
          ).length;
          const memory = window.materials.memory(document).bytes;
          const full = await sample(1);
          const errors = [];
          for (const strength of [0.2, 0.5]) {
            const pixels = await sample(strength);
            errors.push(
              pixels.reduce(
                (error, value, index) => Math.max(error, Math.abs(value - full[index] * strength)),
                0,
              ),
            );
          }
          await sample(1, 5);
          const repeated = await sample(1);
          const zero = await sample(0);
          const stableResources =
            memory === window.materials.memory(document).bytes &&
            captured === diagnostics.records.filter((record) => record.stage === 'capture').length;
          diagnostics.dispose();
          effect.dispose();
          const zeroOptions = {
            frost: { coatingDepth: 0, mistReach: 0 },
            slime: { coatingDepth: 0, dripReach: 0 },
            'burned-paper': { scorchDepth: 0, ashReach: 0 },
          };
          const empty = attach(target, { host, ...zeroOptions[family] });
          await empty.ready;
          const canvas = host.querySelector('canvas')!;
          const image = new Image();
          image.src = canvas.toDataURL();
          await image.decode();
          const copy = document.createElement('canvas');
          copy.width = canvas.width;
          copy.height = canvas.height;
          const context = copy.getContext('2d')!;
          context.drawImage(image, 0, 0);
          const emptyOutput = context
            .getImageData(0, 0, copy.width, copy.height)
            .data.every((value) => value === 0);
          empty.dispose();
          return {
            state,
            errors,
            nonempty: full.some((value) => value > 0),
            repeat: full.every((value, index) => value === repeated[index]),
            zero: zero.every((value) => value === 0),
            emptyOutput,
            stableResources,
            canvases: host.querySelectorAll('canvas').length,
          };
        }, family);
        expect(result.state).toMatchObject({ lifecycle: 'active' });
        // Canvas PNG decoding and premultiplication each round 8-bit channels.
        expect(result.errors?.every((error) => error <= 2)).toBe(true);
        expect(result).toMatchObject({
          nonempty: true,
          repeat: true,
          zero: true,
          emptyOutput: true,
          stableResources: true,
          canvases: 0,
        });
      });
    }
  });
}

for (const family of ['frost', 'slime', 'burned-paper'] as const) {
  test(`${family} validates, defaults omitted partner to zero, resizes and releases`, async ({
    page,
  }) => {
    await page.goto('/material-extent.html');
    await page.waitForFunction(() => Boolean(window.materials));
    const result = await page.evaluate(async (family) => {
      const host = document.querySelector<HTMLElement>('#host')!;
      const target = document.querySelector<HTMLElement>('#target')!;
      target.style.cssText = 'display:block;width:100px;height:100px;border:0;background:white';
      const attach = window.materials[family];
      const travel = { frost: 'mistReach', slime: 'dripReach', 'burned-paper': 'ashReach' }[family];
      const depth = family === 'burned-paper' ? 'scorchDepth' : 'coatingDepth';
      const rejected = [];
      for (const value of [-1, NaN, Infinity, null, '20%']) {
        try {
          const effect = Reflect.apply(attach, undefined, [target, { host, [travel]: value }]);
          effect.dispose();
          rejected.push(false);
        } catch (error) {
          rejected.push(error instanceof Error && error.message === `invalid-${family}-parameter`);
        }
      }
      const imageOf = () => host.querySelector('canvas')!.toDataURL();
      const first = attach(target, { host, [travel]: 0.2, time: 1.5, seed: 314 });
      await first.ready;
      const implicit = imageOf();
      first.dispose();
      const explicit = attach(target, { host, [travel]: 0.2, [depth]: 0, time: 1.5, seed: 314 });
      await explicit.ready;
      const equal = imageOf() === implicit;
      const width = host.querySelector('canvas')!.width;
      target.style.height = '200px';
      await explicit.refresh();
      const resized = host.querySelector('canvas')!.width > width;
      explicit.dispose();
      const empty = attach(target, { host, [travel]: 0 });
      await empty.ready;
      const zeroState = empty.lifecycle;
      empty.dispose();
      const huge = attach(target, { host, [travel]: 100 });
      await huge.ready;
      const budget = huge.reason;
      huge.dispose();
      const next = attach(target, { host, [depth]: 0.1 });
      await next.ready;
      const retryActive = next.lifecycle === 'active';
      next.dispose();
      return {
        rejected,
        equal,
        resized,
        zeroState,
        budget,
        retryActive,
        canvases: host.querySelectorAll('canvas').length,
      };
    }, family);
    expect(result).toEqual({
      rejected: Array(5).fill(true),
      equal: true,
      resized: true,
      zeroState: 'active',
      budget: 'capture-budget',
      retryActive: true,
      canvases: 0,
    });
  });
}

for (const shape of ['rectangle', 'ring', 'islands', 'thin'] as const) {
  test(`material support stays target anchored on ${shape}`, async ({ page }, info) => {
    await page.goto('/material-extent.html');
    await page.waitForFunction(() => Boolean(window.materials));
    const result = await page.evaluate(async (shape) => {
      const renderer = await window.materials.renderer.create();
      const results = [];
      try {
        // Independent opaque rectangular oracle, in CSS pixels at one raster px/CSS px.
        // The ordinary envelope is travel80 + fixed marks8 + paint/sampling guard6.
        const prepare = async (padding: number) => {
          const width = 80 + padding * 2;
          const height = 100 + padding * 2;
          const pixels = new Uint8Array(width * height * 4);
          for (let y = padding; y < padding + 100; y++) {
            for (let x = padding; x < padding + 80; x++) {
              const localX = x - padding;
              const localY = y - padding;
              const hole = localX >= 16 && localX < 64 && localY >= 16 && localY < 84;
              const gap = localX >= 20 && localX < 60;
              if (
                (shape === 'ring' && hole) ||
                (shape === 'islands' && gap) ||
                (shape === 'thin' && localX >= 3)
              ) {
                continue;
              }
              pixels[(y * width + x) * 4 + 3] = 255;
            }
          }
          const frame = await renderer.prepare({ width, height, pixels });
          return {
            frame,
            geometry: {
              pixelToLocal: { a: 1, b: 0, c: 0, d: 1, e: -padding, f: -padding },
              directionalReach: 80,
              inwardDepth: 8,
            },
          };
        };
        const normal = await prepare(94);
        const larger = await prepare(114);
        try {
          for (const family of ['frost', 'slime', 'burned-paper'] as const) {
            let maximumDifference = 0;
            let boundaryAlpha = 0;
            let longDripAlpha = 0;
            for (const time of [0.7, 1.5, 2.7, 3.9, 4.5]) {
              normal.frame.render(time, 314, 1, 1, undefined, 24, family, normal.geometry);
              larger.frame.render(time, 314, 1, 1, undefined, 24, family, larger.geometry);
              const a = await normal.frame.readFire();
              const b = await larger.frame.readFire();
              for (let y = 0; y < normal.frame.height; y++) {
                for (let x = 0; x < normal.frame.width; x++) {
                  const i = (y * normal.frame.width + x) * 4;
                  const j = ((y + 20) * larger.frame.width + x + 20) * 4;
                  for (let channel = 0; channel < 4; channel++) {
                    maximumDifference = Math.max(
                      maximumDifference,
                      Math.abs(a[i + channel] - b[j + channel]),
                    );
                  }
                  if (
                    x === 0 ||
                    y === 0 ||
                    x === normal.frame.width - 1 ||
                    y === normal.frame.height - 1
                  ) {
                    boundaryAlpha = Math.max(boundaryAlpha, a[i + 3]);
                  }
                  if (family === 'slime' && y - 94 > 135) {
                    longDripAlpha = Math.max(longDripAlpha, a[i + 3]);
                  }
                }
              }
            }
            results.push({ family, maximumDifference, boundaryAlpha, longDripAlpha });
          }
        } finally {
          normal.frame.destroy();
          larger.frame.destroy();
        }
        return {
          results,
          errors: renderer.errors,
          managedBytes: renderer.managedBytes,
          gpu: {
            vendor: renderer.adapterInfo.vendor,
            architecture: renderer.adapterInfo.architecture,
            device: renderer.adapterInfo.device,
            description: renderer.adapterInfo.description,
          },
          userAgent: navigator.userAgent,
        };
      } finally {
        renderer.destroy();
      }
    }, shape);
    await info.attach('material-support.json', {
      body: JSON.stringify(result),
      contentType: 'application/json',
    });
    for (const record of result.results) {
      // JFA half-float storage can round differently after texture-size changes.
      expect(record.maximumDifference).toBeLessThanOrEqual(2);
      expect(record.boundaryAlpha).toBe(0);
      if (record.family === 'slime' && shape === 'rectangle') {
        expect(record.longDripAlpha).toBeGreaterThan(0);
      }
    }
    expect(result.errors).toEqual([]);
    expect(result.managedBytes).toBe(0);
  });
}
