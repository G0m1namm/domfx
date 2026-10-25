import { expect, test, type Page } from '@playwright/test';

import type {} from '../src/controls.js';

type Source = 'text' | 'svg' | 'image';

const relativeOptions = {
  frost: { coatingDepth: 0.08, mistReach: 0.25 },
  fire: { flameReach: 0.3 },
  halftone: { plumeReach: 0.3, bandDepth: 0.08 },
  slime: { coatingDepth: 0.08, dripReach: 0.3 },
  'burned-paper': { scorchDepth: 0.12, ashReach: 0.3 },
} as const;

async function openFixture(page: Page) {
  await page.goto('/controls.html');
  await page.waitForFunction(() => Boolean(window.controlEffects));
}

for (const dpr of [1, 2]) {
  test.describe(`independent effect controls at DPR ${dpr}`, () => {
    test.use({ deviceScaleFactor: dpr });

    for (const mode of ['legacy', 'relative'] as const) {
      test(`${mode} controls retain independent rendered components`, async ({ page }, info) => {
        await openFixture(page);
        const result = await page.evaluate(
          async ({ mode, relativeOptions }) => {
            type Rgba = Uint8ClampedArray;
            type Pixels = { rgba: Rgba; width: number; height: number };
            const host = document.querySelector<HTMLElement>('#host')!;
            const original = document.querySelector<HTMLElement>('#target')!;
            host.replaceChildren();
            const settle = () =>
              new Promise<void>((resolve) =>
                requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
              );
            const equal = (first: ArrayLike<number>, second: ArrayLike<number>) => {
              if (first.length !== second.length) {
                return false;
              }
              for (let index = 0; index < first.length; index++) {
                if (first[index] !== second[index]) {
                  return false;
                }
              }
              return true;
            };
            const pixels = async (canvas: HTMLCanvasElement): Promise<Pixels> => {
              const image = new Image();
              image.src = canvas.toDataURL();
              await image.decode();
              const copy = document.createElement('canvas');
              copy.width = image.width;
              copy.height = image.height;
              const context = copy.getContext('2d')!;
              context.drawImage(image, 0, 0);
              return {
                rgba: context.getImageData(0, 0, copy.width, copy.height).data,
                width: copy.width,
                height: copy.height,
              };
            };
            const canvasPixels = async () => pixels(host.querySelector('canvas')!);
            const alpha = (sample: Pixels, index: number) => sample.rgba[index * 4 + 3]!;
            const boundaryAlpha = (sample: Pixels) => {
              let total = 0;
              for (let y = 0; y < sample.height; y++) {
                for (let x = 0; x < sample.width; x++) {
                  if (x === 0 || y === 0 || x === sample.width - 1 || y === sample.height - 1) {
                    total += alpha(sample, y * sample.width + x);
                  }
                }
              }
              return total;
            };
            const count = (sample: Pixels, predicate: (index: number) => boolean) => {
              let total = 0;
              for (let index = 0; index < sample.width * sample.height; index++) {
                total += Number(predicate(index));
              }
              return total;
            };
            const difference = (first: Pixels, second: Pixels, threshold = 12) => {
              const mask = new Uint8Array(first.width * first.height);
              for (let index = 0; index < mask.length; index++) {
                const offset = index * 4;
                const delta =
                  Math.abs(first.rgba[offset]! - second.rgba[offset]!) +
                  Math.abs(first.rgba[offset + 1]! - second.rgba[offset + 1]!) +
                  Math.abs(first.rgba[offset + 2]! - second.rgba[offset + 2]!) +
                  Math.abs(first.rgba[offset + 3]! - second.rgba[offset + 3]!);
                mask[index] = Number(delta > threshold);
              }
              return mask;
            };
            const components = (mask: Uint8Array, width: number, height: number) => {
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
                let left = width;
                let top = height;
                let right = 0;
                let bottom = 0;
                for (let cursor = 0; cursor < queue.length; cursor++) {
                  const current = queue[cursor]!;
                  const x = current % width;
                  const y = Math.floor(current / width);
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
                parts.push({ area: queue.length, left, top, right, bottom });
              }
              return parts;
            };
            const target = () => {
              const element = original.cloneNode(false) as HTMLElement;
              element.removeAttribute('id');
              element.style.cssText =
                'display:block;width:240px;height:160px;border:0;padding:0;background:transparent;overflow:visible';
              element.innerHTML =
                '<svg viewBox="0 0 240 160" width="240" height="160" aria-hidden="true"><path fill="white" fill-rule="evenodd" d="M16 20h104v36H76v48h44v36H16zM150 28h62v104h-62zM166 44v72h30V44z"/><path d="M12 148h216" stroke="white" stroke-width="4"/></svg>';
              host.append(element);
              return element;
            };
            const sourceSnapshot = (element: HTMLElement) => ({
              html: element.outerHTML,
              box: element.getBoundingClientRect().toJSON(),
            });
            const options = (effect: keyof typeof relativeOptions) => ({
              host,
              clock: 'manual' as const,
              seed: 314,
              time: 2.7,
              intensity: 1,
              ...(mode === 'relative' ? relativeOptions[effect] : {}),
            });
            const attach = async <T extends keyof typeof relativeOptions>(
              effect: T,
              extra: Record<string, number> = {},
            ) => {
              const element = target();
              const before = sourceSnapshot(element);
              const handle = Reflect.apply(window.controlEffects[effect], undefined, [
                element,
                {
                  ...options(effect),
                  ...extra,
                },
              ]);
              await handle.ready;
              if (handle.lifecycle !== 'active') {
                throw new Error(
                  `${effect}:${handle.lifecycle}:${handle.reasonDetail ?? handle.reason}`,
                );
              }
              return { element, before, handle };
            };
            const defaultPair = async <T extends keyof typeof relativeOptions>(
              effect: T,
              key: string,
              value: number,
            ) => {
              const omitted = await attach(effect);
              const omittedPixels = await canvasPixels();
              const unchanged =
                JSON.stringify(sourceSnapshot(omitted.element)) === JSON.stringify(omitted.before);
              omitted.handle.dispose();
              omitted.element.remove();
              const explicit = await attach(effect, { [key]: value });
              const explicitPixels = await canvasPixels();
              explicit.handle.dispose();
              explicit.element.remove();
              return {
                exact: equal(omittedPixels.rgba, explicitPixels.rgba),
                unchanged,
                boundary: [boundaryAlpha(omittedPixels), boundaryAlpha(explicitPixels)],
              };
            };

            const diagnostics = window.controlEffects.diagnostics({ capacity: 512 });
            const baselineBytes = window.controlEffects.memory(document).bytes;
            try {
              const defaults = {
                frost: await defaultPair('frost', 'mistOpacity', 1),
                fire: await defaultPair('fire', 'emberDensity', 1),
                halftone: await defaultPair('halftone', 'dotSpacing', 5.5),
                slime: await defaultPair('slime', 'gloss', 1),
                paper: await defaultPair('burned-paper', 'emberGlow', 1),
              };

              const writable = async <T extends 'frost' | 'slime' | 'burned-paper'>(
                effect: T,
                key: 'mistOpacity' | 'gloss' | 'emberGlow',
              ) => {
                const attached = await attach(effect);
                const initial = await canvasPixels();
                const resourceBefore = {
                  captures: diagnostics.records.filter((record) => record.stage === 'capture')
                    .length,
                  preparations: diagnostics.records.filter((record) => record.stage === 'prepare')
                    .length,
                  bytes: window.controlEffects.memory(document).bytes,
                };
                let textures = 0;
                let buffers = 0;
                let pipelines = 0;
                const createTexture = GPUDevice.prototype.createTexture;
                const createBuffer = GPUDevice.prototype.createBuffer;
                const createPipeline = GPUDevice.prototype.createRenderPipeline;
                GPUDevice.prototype.createTexture = function (...args) {
                  textures++;
                  return createTexture.apply(this, args);
                };
                GPUDevice.prototype.createBuffer = function (...args) {
                  buffers++;
                  return createBuffer.apply(this, args);
                };
                GPUDevice.prototype.createRenderPipeline = function (...args) {
                  pipelines++;
                  return createPipeline.apply(this, args);
                };
                try {
                  attached.handle[key] = 0;
                  await settle();
                  const zero = await canvasPixels();
                  attached.handle[key] = 1;
                  await settle();
                  const restored = await canvasPixels();
                  const resourceAfterWrites = {
                    captures: diagnostics.records.filter((record) => record.stage === 'capture')
                      .length,
                    preparations: diagnostics.records.filter((record) => record.stage === 'prepare')
                      .length,
                    bytes: window.controlEffects.memory(document).bytes,
                  };
                  const allocationsAfterWrites = { textures, buffers, pipelines };
                  attached.handle[key] = 0.4;
                  attached.element.style.width = '0';
                  await settle();
                  attached.element.style.width = '240px';
                  await settle();
                  await attached.handle.refresh();
                  const retained = attached.handle[key];
                  const invalid = [undefined, null, '0', Number.NaN, Infinity].map((value) => {
                    try {
                      Reflect.set(attached.handle, key, value);
                      return 'accepted';
                    } catch (error) {
                      return error instanceof Error ? error.message : String(error);
                    }
                  });
                  return {
                    initial,
                    zero,
                    restored,
                    exact: equal(initial.rgba, restored.rgba),
                    changed: !equal(initial.rgba, zero.rgba),
                    retained,
                    invalid: { errors: invalid, retained: attached.handle[key] },
                    unchanged:
                      JSON.stringify(sourceSnapshot(attached.element)) ===
                      JSON.stringify(attached.before),
                    resources: {
                      before: resourceBefore,
                      afterWrites: resourceAfterWrites,
                      allocationsAfterWrites,
                    },
                  };
                } finally {
                  GPUDevice.prototype.createTexture = createTexture;
                  GPUDevice.prototype.createBuffer = createBuffer;
                  GPUDevice.prototype.createRenderPipeline = createPipeline;
                  attached.handle.dispose();
                  attached.element.remove();
                }
              };

              const frost = await writable('frost', 'mistOpacity');
              const slime = await writable('slime', 'gloss');
              const paper = await writable('burned-paper', 'emberGlow');

              const frostGrains = count(
                frost.zero,
                (index) =>
                  alpha(frost.zero, index) > 24 &&
                  Math.floor(index / frost.zero.width) < frost.zero.height / 2,
              );
              const frostCoating = count(
                frost.zero,
                (index) =>
                  alpha(frost.zero, index) > 24 &&
                  Math.floor(index / frost.zero.width) >= frost.zero.height / 2,
              );
              const slimeGeometry = {
                zero: count(slime.zero, (index) => alpha(slime.zero, index) > 24),
                full: count(slime.initial, (index) => alpha(slime.initial, index) > 24),
                highlights: count(slime.initial, (index) => {
                  const offset = index * 4;
                  return (
                    alpha(slime.initial, index) > 32 &&
                    slime.initial.rgba[offset + 1]! > 220 &&
                    slime.initial.rgba[offset]! > 150
                  );
                }),
                withoutHighlights: count(slime.zero, (index) => {
                  const offset = index * 4;
                  return (
                    alpha(slime.zero, index) > 32 &&
                    slime.zero.rgba[offset + 1]! > 220 &&
                    slime.zero.rgba[offset]! > 150
                  );
                }),
              };
              const paperBands = {
                retained: count(paper.zero, (index) => alpha(paper.zero, index) > 24),
                glowing: count(paper.initial, (index) => {
                  const offset = index * 4;
                  return (
                    alpha(paper.initial, index) > 24 &&
                    paper.initial.rgba[offset]! > 200 &&
                    paper.initial.rgba[offset + 1]! > 80 &&
                    paper.initial.rgba[offset + 2]! < 90
                  );
                }),
                withoutGlow: count(paper.zero, (index) => {
                  const offset = index * 4;
                  return (
                    alpha(paper.zero, index) > 24 &&
                    paper.zero.rgba[offset]! > 200 &&
                    paper.zero.rgba[offset + 1]! > 80 &&
                    paper.zero.rgba[offset + 2]! < 90
                  );
                }),
              };

              const fire: Array<{ density: number; pixels: Pixels }> = [];
              for (const density of [0, 0.5, 1]) {
                const attached = await attach('fire', { emberDensity: density });
                fire.push({ density, pixels: await canvasPixels() });
                attached.handle.dispose();
                attached.element.remove();
              }
              const fireMasks = fire
                .slice(1)
                .map((sample) =>
                  components(
                    difference(sample.pixels, fire[0]!.pixels),
                    sample.pixels.width,
                    sample.pixels.height,
                  ).filter((part) => part.area >= 2),
                );
              const halfMatchesFull = fireMasks[0]!.every((half) =>
                fireMasks[1]!.some(
                  (full) =>
                    half.left >= full.left - 1 &&
                    half.right <= full.right + 1 &&
                    half.top >= full.top - 1 &&
                    half.bottom <= full.bottom + 1,
                ),
              );

              const halftone = [];
              let representative = '';
              for (const spacing of [3, 5.5, 12]) {
                const attached = await attach('halftone', { dotSpacing: spacing });
                halftone.push({ spacing, pixels: await canvasPixels() });
                if (spacing === 5.5) {
                  representative = host.querySelector('canvas')!.toDataURL();
                }
                attached.handle.dispose();
                attached.element.remove();
              }
              const dots = halftone.map(({ pixels }) => {
                const parts = components(
                  Uint8Array.from({ length: pixels.width * pixels.height }, (_, index) =>
                    Number(alpha(pixels, index) > 64),
                  ),
                  pixels.width,
                  pixels.height,
                ).filter((part) => part.area >= 2 && part.area <= 1000);
                const radii = parts
                  .map((part) => Math.sqrt(part.area / Math.PI))
                  .sort((a, b) => a - b);
                const distances: number[] = [];
                for (const part of parts) {
                  const centerX = (part.left + part.right) / 2;
                  const centerY = (part.top + part.bottom) / 2;
                  let nearest = Infinity;
                  for (const other of parts) {
                    if (other === part) {
                      continue;
                    }
                    nearest = Math.min(
                      nearest,
                      Math.hypot(
                        centerX - (other.left + other.right) / 2,
                        centerY - (other.top + other.bottom) / 2,
                      ),
                    );
                  }
                  if (Number.isFinite(nearest)) {
                    distances.push(nearest);
                  }
                }
                return {
                  components: parts.length,
                  radius: radii[Math.floor(radii.length / 2)] ?? 0,
                  pitch: distances.sort((a, b) => a - b)[Math.floor(distances.length / 2)] ?? 0,
                  size: [pixels.width, pixels.height],
                  boundary: boundaryAlpha(pixels),
                };
              });

              return {
                defaults,
                writable: {
                  frost: {
                    exact: frost.exact,
                    changed: frost.changed,
                    retained: frost.retained,
                    invalid: frost.invalid,
                    unchanged: frost.unchanged,
                    resources: frost.resources,
                  },
                  slime: {
                    exact: slime.exact,
                    changed: slime.changed,
                    retained: slime.retained,
                    invalid: slime.invalid,
                    unchanged: slime.unchanged,
                    resources: slime.resources,
                  },
                  paper: {
                    exact: paper.exact,
                    changed: paper.changed,
                    retained: paper.retained,
                    invalid: paper.invalid,
                    unchanged: paper.unchanged,
                    resources: paper.resources,
                  },
                },
                components: { frostGrains, frostCoating, slimeGeometry, paperBands },
                fire: {
                  halfComponents: fireMasks[0]!.length,
                  fullComponents: fireMasks[1]!.length,
                  halfMatchesFull,
                  maxChangedArea: Math.max(
                    ...fireMasks.flatMap((parts) => parts.map((part) => part.area)),
                  ),
                },
                halftone: dots,
                representative,
                released: window.controlEffects.memory(document).bytes - baselineBytes,
                canvases: host.querySelectorAll('canvas').length,
              };
            } finally {
              diagnostics.dispose();
            }
          },
          { mode, relativeOptions },
        );
        const { representative, ...evidence } = result;
        await info.attach(`control-independence-${mode}-dpr${dpr}.png`, {
          body: Buffer.from(representative.split(',')[1]!, 'base64'),
          contentType: 'image/png',
        });
        await info.attach('control-independence.json', {
          body: JSON.stringify(evidence),
          contentType: 'application/json',
        });

        for (const value of Object.values(result.defaults)) {
          expect(value.exact).toBe(true);
          expect(value.unchanged).toBe(true);
          expect(value.boundary).toEqual([0, 0]);
        }
        const rawAlpha = await page.evaluate(
          ({ mode, dpr }) => window.controlEffects.qualifyRawAlphaControls(mode, dpr),
          { mode, dpr },
        );
        await info.attach('control-raw-alpha.json', {
          body: JSON.stringify(rawAlpha),
          contentType: 'application/json',
        });
        expect(rawAlpha.errors).toEqual([]);
        expect(rawAlpha.releasedBytes).toBe(0);
        expect(rawAlpha.samples).toHaveLength(15);
        for (const sample of rawAlpha.samples) {
          expect(sample.nontransparentPixels).toBeGreaterThan(0);
          expect(sample.coloredPixels).toBeGreaterThan(0);
          expect(sample.rgbWithinAlpha).toBe(true);
          expect(sample.transparentRgbZero).toBe(true);
        }
        for (const [effect, value] of Object.entries(result.writable)) {
          expect(value.exact).toBe(true);
          expect(value.changed).toBe(true);
          expect(value.retained).toBe(0.4);
          expect(value.unchanged).toBe(true);
          expect(value.resources.afterWrites).toEqual(value.resources.before);
          expect(value.resources.allocationsAfterWrites).toEqual({
            textures: 0,
            buffers: 0,
            pipelines: 0,
          });
          expect(value.invalid).toEqual({
            errors: Array(5).fill(
              `invalid-${effect === 'paper' ? 'burned-paper' : effect}-parameter`,
            ),
            retained: 0.4,
          });
        }
        expect(result.components.frostGrains).toBeGreaterThan(0);
        expect(result.components.frostCoating).toBeGreaterThan(0);
        expect(result.components.slimeGeometry.zero).toBeGreaterThan(0);
        expect(result.components.slimeGeometry.zero).toBeGreaterThan(
          result.components.slimeGeometry.full * 0.9,
        );
        expect(result.components.slimeGeometry.highlights).toBeGreaterThan(
          result.components.slimeGeometry.withoutHighlights,
        );
        expect(result.components.paperBands.retained).toBeGreaterThan(0);
        expect(result.components.paperBands.glowing).toBeGreaterThan(
          result.components.paperBands.withoutGlow,
        );
        expect(result.fire.halfComponents).toBeGreaterThan(0);
        expect(result.fire.fullComponents).toBeGreaterThanOrEqual(result.fire.halfComponents);
        expect(result.fire.halfMatchesFull).toBe(true);
        // Density may only change compact spark components, never the broad flame body.
        expect(result.fire.maxChangedArea).toBeLessThan(32 * dpr * dpr);
        expect(result.halftone.map((sample) => sample.components)).toEqual(
          expect.arrayContaining([expect.any(Number), expect.any(Number), expect.any(Number)]),
        );
        expect(result.halftone[0]!.pitch).toBeLessThan(result.halftone[1]!.pitch);
        expect(result.halftone[1]!.pitch).toBeLessThan(result.halftone[2]!.pitch);
        expect(result.halftone[0]!.radius).toBeLessThan(result.halftone[1]!.radius);
        expect(result.halftone[1]!.radius).toBeLessThan(result.halftone[2]!.radius);
        expect(result.halftone.map((sample) => sample.size)).toEqual([
          result.halftone[0]!.size,
          result.halftone[0]!.size,
          result.halftone[0]!.size,
        ]);
        expect(result.halftone.map((sample) => sample.boundary)).toEqual([0, 0, 0]);
        expect(result).toMatchObject({ released: 0, canvases: 0 });
      });
    }
  });
}

for (const dpr of [1, 2]) {
  test.describe(`relative default source coverage at DPR ${dpr}`, () => {
    test.use({ deviceScaleFactor: dpr });
    for (const source of ['text', 'svg', 'image'] as const) {
      test(`relative defaults preserve ${source} output`, async ({ page }, info) => {
        await openFixture(page);
        const result = await page.evaluate(async (source: Source) => {
          const host = document.querySelector<HTMLElement>('#host')!;
          host.replaceChildren();
          const settle = () =>
            new Promise<void>((resolve) =>
              requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
            );
          const output = async () => {
            const canvas = host.querySelector('canvas')!;
            const image = new Image();
            image.src = canvas.toDataURL();
            await image.decode();
            return image.src;
          };
          const makeTarget = async () => {
            if (source === 'image') {
              const sourceCanvas = document.createElement('canvas');
              sourceCanvas.width = 240;
              sourceCanvas.height = 160;
              const pen = sourceCanvas.getContext('2d')!;
              pen.strokeStyle = 'white';
              pen.lineWidth = 5;
              pen.strokeRect(14, 14, 90, 90);
              pen.fillStyle = 'white';
              pen.fillRect(148, 42, 60, 76);
              const image = new Image(240, 160);
              image.src = sourceCanvas.toDataURL();
              await image.decode();
              image.style.cssText = 'display:block;width:240px;height:160px';
              host.append(image);
              return image;
            }
            const target = document.createElement('div');
            target.style.cssText =
              source === 'text'
                ? 'box-sizing:border-box;display:block;width:240px;height:160px;padding:20px;color:white;background:transparent;font:64px/1 sans-serif'
                : 'display:block;width:240px;height:160px;color:white;background:transparent';
            target.innerHTML =
              source === 'text'
                ? '<span>i</span><span style="display:inline-block;width:46px;height:46px;margin-left:42px;background:white"></span>'
                : '<svg viewBox="0 0 240 160" width="240" height="160" style="display:block"><path fill="white" fill-rule="evenodd" d="M12 12h100v100H12zM38 38v48h48V38zM158 40h56v64h-56z"/></svg>';
            host.append(target);
            return target;
          };
          const target = await makeTarget();
          const snapshot = target.outerHTML;
          const render = async (extra: Record<string, number>) => {
            const effect = window.controlEffects.frost(target, {
              host,
              clock: 'manual',
              seed: 314,
              time: 2.7,
              intensity: 1,
              coatingDepth: 0.08,
              mistReach: 0.25,
              ...extra,
            });
            await effect.ready;
            if (effect.lifecycle !== 'active') {
              throw new Error(
                `text-source:${effect.lifecycle}:${effect.reasonDetail ?? effect.reason}`,
              );
            }
            await settle();
            const image = await output();
            effect.dispose();
            return image;
          };
          const omitted = await render({});
          const explicit = await render({ mistOpacity: 1 });
          target.remove();
          return {
            exact: omitted === explicit,
            unchanged: target.outerHTML === snapshot,
            canvases: host.querySelectorAll('canvas').length,
          };
        }, source);
        await info.attach('relative-control-source.json', {
          body: JSON.stringify(result),
          contentType: 'application/json',
        });
        expect(result).toEqual({ exact: true, unchanged: true, canvases: 0 });
      });
    }
  });
}
