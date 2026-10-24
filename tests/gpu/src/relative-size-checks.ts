import { captureElement } from '@domfx/browser';
import { GpuExperiment } from '@domfx/browser/experimental';

import { effects } from './effect-selection.js';

const measuredEffects = effects.filter(
  (effect) => !['fire', 'electricity', 'kinetic'].includes(effect),
);
const patchSize = 300;
const padding = 100;
const times = [0.7, 1.5, 2.7, 3.9, 4.5];
const quantile = (values: number[], fraction: number) => {
  values.sort((a, b) => a - b);
  return values[Math.floor((values.length - 1) * fraction)] ?? 0;
};

/** For patterns, minimum-axis runs measure mark thickness, not matched particles.
 * Material clouds/liquid can merge into broad macro coverage; their grain uses
 * a separate fixed-coating interior control below.
 */
function fineRuns(pixels: Uint8Array, sdf: Float32Array) {
  const horizontal = new Uint16Array(patchSize * patchSize);
  const vertical = new Uint16Array(patchSize * patchSize);
  for (let axis = 0; axis < 2; axis++) {
    const lengths = axis === 0 ? horizontal : vertical;
    for (let line = 0; line < patchSize; line++) {
      let start = 0;
      for (let offset = 0; offset <= patchSize; offset++) {
        const index = axis === 0 ? line * patchSize + offset : offset * patchSize + line;
        if (offset < patchSize && pixels[index * 4 + 3] >= 64) {
          continue;
        }
        for (let position = start; position < offset; position++) {
          const i = axis === 0 ? line * patchSize + position : position * patchSize + line;
          lengths[i] = offset - start;
        }
        start = offset + 1;
      }
    }
  }
  const widths = [];
  for (let i = 0; i < sdf.length; i++) {
    if (sdf[i] > 1 && pixels[i * 4 + 3] >= 64) {
      widths.push(Math.min(horizontal[i], vertical[i]));
    }
  }
  return { count: widths.length, median: quantile(widths, 0.5), p90: quantile(widths, 0.9) };
}

function imageOf(pixels: Uint8Array) {
  const canvas = document.createElement('canvas');
  canvas.width = patchSize;
  canvas.height = patchSize;
  const context = canvas.getContext('2d')!;
  // GPU readback is premultiplied: display its RGB over opaque black at 1:1 CSS scale.
  const image = context.createImageData(patchSize, patchSize);
  image.data.set(pixels);
  for (let i = 3; i < image.data.length; i += 4) {
    image.data[i] = 255;
  }
  context.putImageData(image, 0, 0);
  return canvas.toDataURL();
}

/** Real fixed-size source marks inside independently resized transparent border boxes.
 * Matched resolved extents isolate size/coordinate changes; equal fractions measure
 * useful rendered reach. Thin glyphs can cap inward coverage before the requested depth.
 */
export async function verifyRelativeSizes(kind: 'text' | 'svg' | 'image') {
  const host = document.createElement('div');
  host.style.cssText = 'position:absolute;left:80px;top:80px';
  const target = document.createElement('div');
  target.style.cssText = 'position:relative;width:100px;height:100px';
  if (kind === 'text') {
    target.innerHTML =
      '<span style="position:absolute;left:10px;top:15px;font:900 52px/1 sans-serif;color:white">FX</span>';
  } else if (kind === 'svg') {
    target.innerHTML =
      '<svg width="80" height="80" viewBox="0 0 80 80" style="position:absolute;left:10px;top:10px"><path fill="white" fill-rule="evenodd" d="M0 0H50V80H0Z M10 10V18H18V10Z"/><path fill="white" d="M65 0h2v80h-2z M72 35h8v10h-8z"/></svg>';
  } else {
    const source = document.createElement('canvas');
    source.width = 80;
    source.height = 80;
    const context = source.getContext('2d')!;
    context.fillStyle = 'white';
    context.beginPath();
    context.arc(40, 40, 35, 0, Math.PI * 2);
    context.arc(74, 6, 3, 0, Math.PI * 2);
    context.fill();
    const image = document.createElement('img');
    image.style.cssText = 'position:absolute;left:10px;top:10px;width:80px;height:80px';
    image.src = source.toDataURL();
    target.append(image);
    await image.decode();
  }
  host.append(target);
  document.body.append(host);
  await document.fonts.ready;
  const gpu = await GpuExperiment.create();
  const baselines = new Map<string, Uint8Array>();
  const materialBaselines = new Map<string, Uint8Array>();
  const results = [];
  try {
    for (const size of [100, 400]) {
      target.style.width = `${size}px`;
      target.style.height = `${size}px`;
      const options = { dpr: 1, resolvePadding: () => padding };
      const capture = await captureElement(target, options);
      const prepared = await gpu.prepare(capture);
      try {
        const sdf = await prepared.readSdf();
        const patchSdf = new Float32Array(patchSize * patchSize);
        for (let y = 0; y < patchSize; y++) {
          patchSdf.set(
            sdf.subarray(y * capture.width, y * capture.width + patchSize),
            y * patchSize,
          );
        }
        const availableDepth = patchSdf.reduce((depth, value) => Math.max(depth, -value), 0);
        for (const fraction of size === 100 ? [0.1, 0.2] : [0.025, 0.05, 0.1, 0.2]) {
          for (const effect of measuredEffects) {
            const radial = effect === 'contour-echoes' || effect === 'brush-fringe';
            const reach = size * fraction;
            const depth = radial ? 6 : reach / 4;
            let maxOutside = 0;
            let maxInside = 0;
            let boundaryAlpha = 0;
            let matchedDifference: number | undefined;
            let image = '';
            let materialDetailDifference: number | undefined;
            let materialDetailPixels = 0;
            const medians = [];
            const p90s = [];
            let detailSamples = 0;
            for (const [index, time] of times.entries()) {
              prepared.render(time, 314, 1, 1, undefined, 24, effect, {
                directionalReach: reach,
                inwardDepth: depth,
                pixelToLocal: capture.pixelToLocal,
              });
              const pixels = await prepared.readFire();
              const patch = new Uint8Array(patchSize * patchSize * 4);
              for (let y = 0; y < patchSize; y++) {
                patch.set(
                  pixels.subarray(y * capture.width * 4, (y * capture.width + patchSize) * 4),
                  y * patchSize * 4,
                );
              }
              for (let i = 0; i < patchSdf.length; i++) {
                if (patch[i * 4 + 3] >= 8) {
                  maxOutside = Math.max(maxOutside, patchSdf[i]);
                  maxInside = Math.max(maxInside, -patchSdf[i]);
                }
              }
              for (let x = 0; x < capture.width; x++) {
                boundaryAlpha = Math.max(
                  boundaryAlpha,
                  pixels[x * 4 + 3],
                  pixels[((capture.height - 1) * capture.width + x) * 4 + 3],
                );
              }
              for (let y = 0; y < capture.height; y++) {
                boundaryAlpha = Math.max(
                  boundaryAlpha,
                  pixels[y * capture.width * 4 + 3],
                  pixels[(y * capture.width + capture.width - 1) * 4 + 3],
                );
              }
              const detail = fineRuns(patch, patchSdf);
              medians.push(detail.median);
              p90s.push(detail.p90);
              detailSamples += detail.count;
              if (index === 0) {
                image = imageOf(patch);
                const key = `${effect}:${reach}`;
                if (size === 100) {
                  baselines.set(key, patch);
                } else {
                  const baseline = baselines.get(key);
                  if (baseline) {
                    matchedDifference = patch.reduce(
                      (max, value, i) => Math.max(max, Math.abs(value - baseline[i])),
                      0,
                    );
                  }
                }
              }
            }
            if (['frost', 'slime', 'burned-paper'].includes(effect)) {
              // Hold coating geometry fixed while travel and the reference box
              // change. Interior grain/highlight pixels should retain their
              // actual values/phase, rather than comparing a changing cloud.
              const detailDepth = Math.min(8, availableDepth * 0.8);
              prepared.render(1.5, 314, 1, 1, undefined, 24, effect, {
                directionalReach: reach,
                inwardDepth: detailDepth,
                pixelToLocal: capture.pixelToLocal,
              });
              const pixels = await prepared.readFire();
              const patch = new Uint8Array(patchSize * patchSize * 4);
              for (let y = 0; y < patchSize; y++) {
                patch.set(
                  pixels.subarray(y * capture.width * 4, (y * capture.width + patchSize) * 4),
                  y * patchSize * 4,
                );
              }
              if (!materialBaselines.has(effect)) {
                materialBaselines.set(effect, patch);
              }
              const baseline = materialBaselines.get(effect)!;
              materialDetailDifference = 0;
              for (let i = 0; i < patchSdf.length; i++) {
                const inside = -patchSdf[i];
                const selected =
                  effect === 'slime'
                    ? inside > detailDepth * 0.65 && inside < detailDepth * 0.9
                    : inside > 1;
                if (!selected || baseline[i * 4 + 3] < 8) {
                  continue;
                }
                materialDetailPixels++;
                for (let channel = 0; channel < 4; channel++) {
                  materialDetailDifference = Math.max(
                    materialDetailDifference,
                    Math.abs(patch[i * 4 + channel] - baseline[i * 4 + channel]),
                  );
                }
              }
            }
            results.push({
              kind,
              effect,
              size,
              fraction,
              reach,
              depth,
              availableDepth,
              maxOutside,
              maxInside,
              boundaryAlpha,
              detailSamples,
              exteriorRunMedian: quantile(medians, 0.5),
              exteriorRunP90: quantile(p90s, 0.5),
              materialDetailDifference,
              materialDetailPixels,
              matchedDifference,
              image,
            });
          }
        }
      } finally {
        prepared.destroy();
        capture.release();
      }
    }
    return { results, errors: [...gpu.errors], managedBytes: gpu.managedBytes };
  } finally {
    gpu.destroy();
    host.remove();
  }
}
