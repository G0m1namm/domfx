import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { expect, test } from '@playwright/test';

type Message = () => unknown;

test.beforeEach(async ({ page }) => {
  // Count real snapshot readbacks; probes in these tests mark their own canvases.
  await page.addInitScript(() => {
    const read = CanvasRenderingContext2D.prototype.getImageData;
    CanvasRenderingContext2D.prototype.getImageData = function (...args) {
      if (!this.canvas.dataset.probe) {
        const state = document.documentElement.dataset;
        state.captures = String(Number(state.captures ?? 0) + 1);
      }
      return read.apply(this, args);
    };
  });
  await page.goto('/controls.html');
  await page.waitForFunction(() => Boolean(window.controlEffects));
});

test('Fire pair enforces its exclusion, format and unset contract', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const host = document.querySelector<HTMLElement>('#host')!;
    const target = document.querySelector<HTMLElement>('#target')!;
    const attach = window.controlEffects.fire;
    const failure = (action: Message) => {
      try {
        action();
        return 'accepted';
      } catch (error) {
        return error instanceof Error ? error.message : String(error);
      }
    };
    const creation = [
      // @ts-expect-error The pair is exclusive with color in the public type.
      () => attach(target, { host, color: '#f00', rootColor: '#00f' }),
      // @ts-expect-error The pair is exclusive with color in the public type.
      () => attach(target, { host, color: '#f00', tipColor: '#00f' }),
      () => attach(target, { host, rootColor: 'red' }),
      () => attach(target, { host, tipColor: 'rgba(0, 0, 0, 0.5)' }),
      // @ts-expect-error Deliberately invalid JavaScript input must fail at the public boundary.
      () => attach(target, { host, rootColor: null }),
      // @ts-expect-error Deliberately invalid JavaScript input must fail at the public boundary.
      () => attach(target, { host, tipColor: 1 }),
    ].map((action) =>
      failure(() => {
        action().dispose();
      }),
    );

    const fire = attach(target, { host, time: 2 });
    await fire.ready;
    const defaults = [fire.color, fire.rootColor, fire.tipColor];
    const writes: unknown[] = [];
    fire.rootColor = '#0af';
    fire.tipColor = 'rgba(10, 20, 30, 1)';
    writes.push([fire.rootColor, fire.tipColor]);
    for (const invalid of ['red', 'rgba(0, 0, 0, 0)', 'rgb(300, 0, 0)', null, 1]) {
      writes.push(
        failure(() => {
          (fire as { rootColor: unknown }).rootColor = invalid;
        }),
        failure(() => {
          (fire as { tipColor: unknown }).tipColor = invalid;
        }),
      );
    }
    writes.push([fire.rootColor, fire.tipColor]);
    writes.push(
      failure(() => {
        fire.color = '#f00';
      }),
      fire.color,
    );
    fire.color = undefined;
    fire.rootColor = undefined;
    writes.push([fire.rootColor, fire.tipColor]);
    writes.push(
      failure(() => {
        fire.color = '#f00';
      }),
      fire.color,
    );
    fire.tipColor = undefined;
    fire.color = '#f00';
    writes.push(
      fire.color,
      failure(() => {
        fire.rootColor = '#00f';
      }),
      failure(() => {
        fire.tipColor = '#00f';
      }),
      [fire.rootColor, fire.tipColor],
      fire.color,
    );
    fire.rootColor = undefined;
    fire.tipColor = undefined;
    writes.push(fire.color);
    fire.color = undefined;
    fire.tipColor = '#00f';
    writes.push([fire.color, fire.rootColor, fire.tipColor]);
    fire.dispose();

    const created = attach(target, { host, time: 2, rootColor: '#123', tipColor: '#456' });
    await created.ready;
    const pair = [created.rootColor, created.tipColor];
    created.dispose();
    const oneSided = attach(target, { host, time: 2, tipColor: '#456', rootColor: undefined });
    await oneSided.ready;
    const single = [oneSided.rootColor, oneSided.tipColor];
    oneSided.dispose();
    const explicitUndefined = attach(target, {
      host,
      time: 2,
      color: '#123',
      rootColor: undefined,
    });
    await explicitUndefined.ready;
    const colorOnly = [explicitUndefined.color, explicitUndefined.rootColor];
    explicitUndefined.dispose();
    return { creation, defaults, writes, pair, single, colorOnly };
  });

  expect(result.creation).toEqual(Array(6).fill('invalid-fire-parameter'));
  expect(result.defaults).toEqual([undefined, undefined, undefined]);
  expect(result.writes).toEqual([
    ['rgb(0, 170, 255)', 'rgb(10, 20, 30)'],
    ...Array(10).fill('invalid-fire-parameter'),
    ['rgb(0, 170, 255)', 'rgb(10, 20, 30)'],
    'invalid-fire-parameter',
    undefined,
    [undefined, 'rgb(10, 20, 30)'],
    'invalid-fire-parameter',
    undefined,
    'rgb(255, 0, 0)',
    'invalid-fire-parameter',
    'invalid-fire-parameter',
    [undefined, undefined],
    'rgb(255, 0, 0)',
    'rgb(255, 0, 0)',
    [undefined, undefined, 'rgb(0, 0, 255)'],
  ]);
  expect(result.pair).toEqual(['rgb(17, 34, 51)', 'rgb(68, 85, 102)']);
  expect(result.single).toEqual([undefined, 'rgb(68, 85, 102)']);
  expect(result.colorOnly).toEqual(['rgb(17, 34, 51)', undefined]);
});

for (const mode of ['default appearance', 'relative'] as const) {
  test(`Fire ${mode} writes keep capture, geometry and resources and restore authored output`, async ({
    page,
  }) => {
    const result = await page.evaluate(
      async (flameReach) => {
        const host = document.querySelector<HTMLElement>('#host')!;
        const target = document.querySelector<HTMLElement>('#target')!;
        const settle = () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
          );
        const rgba = async () => {
          const image = new Image();
          image.src = host.querySelector('canvas')!.toDataURL();
          await image.decode();
          const copy = document.createElement('canvas');
          copy.dataset.probe = 'true';
          copy.width = image.width;
          copy.height = image.height;
          const context = copy.getContext('2d')!;
          context.drawImage(image, 0, 0);
          return [...context.getImageData(0, 0, copy.width, copy.height).data];
        };
        const equal = (left: readonly number[], right: readonly number[]) =>
          left.length === right.length && left.every((value, index) => value === right[index]);
        const alphaEqual = (left: readonly number[], right: readonly number[]) =>
          left.every((value, index) => index % 4 !== 3 || value === right[index]);
        const base = {
          host,
          clock: 'manual',
          motion: 'static',
          time: 1.5,
          seed: 314,
          intensity: 0.8,
          ...(flameReach === undefined ? {} : { flameReach }),
        } as const;
        const render = async (colors: { rootColor?: string; tipColor?: string }) => {
          const effect = window.controlEffects.fire(target, { ...base, ...colors });
          await effect.ready;
          const bytes = await rgba();
          effect.dispose();
          return bytes;
        };
        const explicitTip = await render({ tipColor: '#ff1701', rootColor: '#0066ff' });
        const rootOnly = await render({ rootColor: '#0066ff' });
        const explicitRoot = await render({ tipColor: '#0066ff', rootColor: '#fff5a3' });
        const tipOnly = await render({ tipColor: '#0066ff' });
        const authoredEndpoints = await render({ tipColor: '#ff1701', rootColor: '#fff5a3' });
        const green = await render({ tipColor: '#00ff00', rootColor: '#00ff00' });

        const effect = window.controlEffects.fire(target, base);
        await effect.ready;
        const canvas = host.querySelector('canvas')!;
        const box = JSON.stringify(canvas.getBoundingClientRect());
        const size = [canvas.width, canvas.height];
        const authored = await rgba();
        const counts = { textures: 0, pipelines: 0, buffers: 0, bindGroups: 0 };
        const prototype = GPUDevice.prototype;
        const originals = {
          createTexture: prototype.createTexture,
          createRenderPipeline: prototype.createRenderPipeline,
          createBuffer: prototype.createBuffer,
          createBindGroup: prototype.createBindGroup,
        };
        prototype.createTexture = function (...args) {
          counts.textures += 1;
          return originals.createTexture.apply(this, args);
        };
        prototype.createRenderPipeline = function (...args) {
          counts.pipelines += 1;
          return originals.createRenderPipeline.apply(this, args);
        };
        prototype.createBuffer = function (...args) {
          counts.buffers += 1;
          return originals.createBuffer.apply(this, args);
        };
        prototype.createBindGroup = function (...args) {
          counts.bindGroups += 1;
          return originals.createBindGroup.apply(this, args);
        };
        const captures = document.documentElement.dataset.captures;
        const source = target.outerHTML;
        effect.tipColor = '#0066ff';
        await settle();
        const written = await rgba();
        effect.tipColor = undefined;
        await settle();
        const reset = await rgba();
        effect.rootColor = '#0066ff';
        await settle();
        const rootWritten = await rgba();
        effect.rootColor = undefined;
        await settle();
        const resetAgain = await rgba();
        Object.assign(prototype, originals);
        const unchanged = {
          captures: document.documentElement.dataset.captures === captures,
          capturedAtLeastOnce: Number(captures) > 0,
          source: target.outerHTML === source,
          canvas: host.querySelector('canvas') === canvas,
          box: JSON.stringify(canvas.getBoundingClientRect()) === box,
          size: canvas.width === size[0] && canvas.height === size[1],
          alpha: alphaEqual(authored, written) && alphaEqual(authored, rootWritten),
        };
        effect.dispose();
        let visible = 0;
        let greenOnly = true;
        for (let offset = 0; offset < green.length; offset += 4) {
          visible += Number(green[offset + 3]! > 0);
          greenOnly &&= green[offset] === 0 && green[offset + 2] === 0;
        }
        return {
          unchanged,
          counts,
          visible,
          greenOnly,
          tipOnlyMatchesAuthoredRoot: equal(tipOnly, explicitRoot),
          rootOnlyMatchesAuthoredTip: equal(rootOnly, explicitTip),
          writeMatchesCreation: equal(written, explicitRoot) && equal(rootWritten, explicitTip),
          resetExact: equal(authored, reset) && equal(authored, resetAgain),
          twoStopDiffersFromAuthored: !equal(authored, authoredEndpoints),
        };
      },
      mode === 'relative' ? 0.2 : undefined,
    );

    expect(result.unchanged).toEqual({
      captures: true,
      capturedAtLeastOnce: true,
      source: true,
      canvas: true,
      box: true,
      size: true,
      alpha: true,
    });
    expect(result.counts).toEqual({ textures: 0, pipelines: 0, buffers: 0, bindGroups: 0 });
    expect(result.visible).toBeGreaterThan(0);
    expect(result).toMatchObject({
      greenOnly: true,
      tipOnlyMatchesAuthoredRoot: true,
      rootOnlyMatchesAuthoredTip: true,
      writeMatchesCreation: true,
      resetExact: true,
      twoStopDiffersFromAuthored: true,
    });
  });
}

test('native GSAP fromTo tweens a real Fire handle after an explicit assignment', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const result = await page.evaluate(async () => {
    const host = document.querySelector<HTMLElement>('#host')!;
    const target = document.querySelector<HTMLElement>('#target')!;
    const { fire: attach, gsap } = window.controlEffects;
    const effect = attach(target, {
      host,
      clock: 'manual',
      motion: 'static',
      time: 1.5,
      seed: 314,
    });
    await effect.ready;
    const image = () => host.querySelector('canvas')!.toDataURL();
    const settle = () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
    // Without the explicit assignment GSAP has no color to read and writes transparent black.
    let unsetTween = 'accepted';
    const fromUnset = gsap.to(effect, { tipColor: '#ff9900', duration: 1, paused: true });
    try {
      fromUnset.progress(0.5);
    } catch (error) {
      unsetTween = error instanceof Error ? error.message : String(error);
    }
    fromUnset.kill();
    const unsetAfterTween = effect.tipColor;
    effect.rootColor = '#0066ff';
    effect.tipColor = '#ff9900';
    await settle();
    const start = image();
    const textures = GPUDevice.prototype.createTexture;
    let created = 0;
    GPUDevice.prototype.createTexture = function (...args) {
      created += 1;
      return textures.apply(this, args);
    };
    const paused = gsap.fromTo(
      effect,
      { rootColor: '#0066ff', tipColor: '#ff9900' },
      { rootColor: '#ff9900', tipColor: '#0066ff', duration: 1, ease: 'none', paused: true },
    );
    paused.progress(0.5);
    const midpoint = [effect.rootColor, effect.tipColor];
    paused.progress(1);
    const end = [effect.rootColor, effect.tipColor];
    await settle();
    const endImage = image();
    paused.progress(0);
    const rewound = [effect.rootColor, effect.tipColor];
    paused.kill();

    const seen = new Set<string>();
    await new Promise<void>((resolve) => {
      gsap.fromTo(
        effect,
        { rootColor: '#0066ff' },
        {
          rootColor: '#ff9900',
          duration: 0.4,
          ease: 'none',
          onUpdate: () => seen.add(String(effect.rootColor)),
          onComplete: resolve,
        },
      );
    });
    GPUDevice.prototype.createTexture = textures;
    const final = effect.rootColor;
    gsap.killTweensOf(effect);
    effect.rootColor = undefined;
    effect.tipColor = undefined;
    const unset = [effect.rootColor, effect.tipColor];
    effect.dispose();
    return {
      midpoint,
      end,
      rewound,
      changed: start !== endImage,
      seen: [...seen],
      final,
      created,
      unset,
      unsetTween,
      unsetAfterTween,
    };
  });

  expect(errors).toEqual([]);
  const channels = (value: string | undefined) =>
    (/^rgb\((\d+(?:\.\d+)?), (\d+(?:\.\d+)?), (\d+(?:\.\d+)?)\)$/.exec(value ?? '') ?? [])
      .slice(1)
      .map(Number);
  for (const value of result.midpoint) {
    const [red, green, blue] = channels(value);
    for (const channel of [red, green, blue]) {
      expect(Math.abs(channel! - 127.5)).toBeLessThanOrEqual(1);
    }
  }
  expect(result.end).toEqual(['rgb(255, 153, 0)', 'rgb(0, 102, 255)']);
  expect(result.rewound).toEqual(['rgb(0, 102, 255)', 'rgb(255, 153, 0)']);
  expect(result.changed).toBe(true);
  expect(result.seen.length).toBeGreaterThan(2);
  expect(result.seen.every((value) => channels(value).length === 3)).toBe(true);
  expect(result.final).toBe('rgb(255, 153, 0)');
  expect(result.created).toBe(0);
  expect(result.unsetTween).toBe('invalid-fire-parameter');
  expect(result.unsetAfterTween).toBeUndefined();
  expect(result.unset).toEqual([undefined, undefined]);
});

for (const mode of ['legacy', 'relative'] as const) {
  test(`complementary pair matches the real ${mode} Fire shader in sRGB`, async ({
    page,
  }, testInfo) => {
    const results = await page.evaluate(async (selected) => {
      const adapter = await navigator.gpu.requestAdapter();
      return {
        adapter: {
          vendor: adapter?.info.vendor,
          architecture: adapter?.info.architecture,
          fallback: adapter?.info.isFallbackAdapter,
        },
        ...(await window.controlEffects.qualifyRawFireRamp(selected, 2)),
      };
    }, mode);

    const evidence = resolve(testInfo.outputDir, `fire-ramp-${mode}.json`);
    await mkdir(testInfo.outputDir, { recursive: true });
    await writeFile(evidence, JSON.stringify(results, null, 1));
    await testInfo.attach(`fire-ramp-${mode}`, { path: evidence });

    const { report } = results;
    expect(results.errors).toEqual([]);
    expect(results.releasedBytes).toBe(0);
    expect(report.alphaExact).toBe(true);
    expect(report.pixels).toBeGreaterThan(1000);
    expect(report.pairMismatches).toBe(0);
    expect(report.opaquePixels).toBeGreaterThan(1000);
    expect(report.formulaMismatches).toBe(0);
    // The ramp must be observed from its tip side through its root side, not just one end.
    expect(report.positionRange[0]).toBeLessThan(0.1);
    expect(report.positionRange[1]).toBeGreaterThan(0.75);
    // The documented limit: #0066ff to #ff9900 passes through gray at its midpoint.
    expect(report.midpointPixels).toBeGreaterThan(20);
    for (const channel of report.midpointAverage) {
      expect(Math.abs(channel - 127.5)).toBeLessThanOrEqual(3);
    }
    expect(report.midpointMaxChroma).toBeLessThanOrEqual(24);
    // Embers exist, and take the effective Tip color with no trace of the authored #ffc747.
    expect(report.emberPixels).toBeGreaterThan(0);
    expect(report.emberNonGreenPixels).toBe(0);
    expect(report.effectiveTipEmberPixels).toBeGreaterThan(0);
    expect(report.effectiveTipOffSegment).toBe(0);
  });
}
