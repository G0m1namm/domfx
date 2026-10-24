import * as BrowserEffects from '@domfx/browser';
import type { EffectHandle } from '@domfx/browser';
import { GpuExperiment } from '@domfx/browser/experimental';

import { effects } from './effect-selection.js';

const patterns = effects.slice(6);

function mask(padding: number, dpr = 1, targetWidth = 100, targetHeight = 100) {
  const width = Math.ceil((targetWidth + padding * 2) * dpr);
  const height = Math.ceil((targetHeight + padding * 2) * dpr);
  const a = (targetWidth + padding * 2) / width;
  const d = (targetHeight + padding * 2) / height;
  const pixels = new Uint8Array(width * height * 4);
  for (let row = 0; row < height; row++) {
    for (let column = 0; column < width; column++) {
      const x = (column + 0.5) * a - padding;
      const y = (row + 0.5) * d - padding;
      // Hole and disconnected stripe exercise more than one exterior contour.
      const solid = x >= 10 && x < targetWidth - 10 && y >= 20 && y < targetHeight - 20;
      const hole = x > 35 && x < 55 && y > 40 && y < 60;
      const stripe = x >= 2 && x < 5 && y >= 10 && y < targetHeight - 10;
      if ((solid && !hole) || stripe) {
        pixels[(row * width + column) * 4 + 3] = 255;
      }
    }
  }
  return { width, height, pixels, pixelToLocal: { a, d, e: -padding, f: -padding } };
}

async function patternStrength() {
  const gpu = await GpuExperiment.create();
  const frame = mask(70);
  try {
    const prepared = await gpu.prepare(frame);
    try {
      const results = [];
      for (const effect of patterns) {
        const geometry = {
          pixelToLocal: frame.pixelToLocal,
          directionalReach: 40,
          inwardDepth: 12,
        };
        const sample = async (intensity: number, zeroExtent = false, time = 1.5) => {
          prepared.render(time, 314, intensity, 1, undefined, 24, effect, {
            ...geometry,
            ...(zeroExtent ? { directionalReach: 0, inwardDepth: 0 } : {}),
          });
          return prepared.readFire();
        };
        const full = await sample(1);
        let maximumError = 0;
        for (const strength of [0.25, 0.6]) {
          const pixels = await sample(strength);
          for (let i = 0; i < pixels.length; i++) {
            maximumError = Math.max(maximumError, Math.abs(pixels[i] - full[i] * strength));
          }
        }
        await sample(1, false, -2.5);
        const repeated = await sample(1);
        const zeroStrength = await sample(0);
        const zeroExtent = await sample(1, true);
        results.push({
          effect,
          maximumError,
          nonempty: full.some((value) => value > 0),
          repeated: full.every((value, index) => value === repeated[index]),
          zeroStrength: zeroStrength.every((value) => value === 0),
          zeroExtent: zeroExtent.every((value) => value === 0),
        });
      }
      return { results, errors: [...gpu.errors], environment: gpu.adapterInfo.description };
    } finally {
      prepared.destroy();
    }
  } finally {
    gpu.destroy();
  }
}

declare global {
  interface Window {
    patternStrength: typeof patternStrength;
  }
}
window.patternStrength = patternStrength;

async function patternSupportChecks(dpr: number) {
  const gpu = await GpuExperiment.create();
  const frame = mask(100, dpr);
  const larger = mask(140, dpr);
  try {
    const normal = await gpu.prepare(frame);
    const expanded = await gpu.prepare(larger);
    try {
      const results = [];
      for (const effect of patterns) {
        const geometry = { directionalReach: 80, inwardDepth: 12 };
        normal.render(1.5, 314, 1, dpr, undefined, 24, effect, {
          ...geometry,
          pixelToLocal: frame.pixelToLocal,
        });
        expanded.render(1.5, 314, 1, dpr, undefined, 24, effect, {
          ...geometry,
          pixelToLocal: larger.pixelToLocal,
        });
        const pixels = await normal.readFire();
        const padded = await expanded.readFire();
        const offset = 40 * dpr;
        let maximumError = 0;
        let boundaryAlpha = 0;
        let extended = false;
        for (let row = 0; row < larger.height; row++) {
          for (let column = 0; column < larger.width; column++) {
            const index = (row * larger.width + column) * 4;
            const inNormal =
              column >= offset &&
              column < offset + frame.width &&
              row >= offset &&
              row < offset + frame.height;
            if (!inNormal) {
              boundaryAlpha = Math.max(boundaryAlpha, padded[index + 3]);
              continue;
            }
            const normalIndex = ((row - offset) * frame.width + column - offset) * 4;
            for (let channel = 0; channel < 4; channel++) {
              maximumError = Math.max(
                maximumError,
                Math.abs(padded[index + channel] - pixels[normalIndex + channel]),
              );
            }
            if (
              row === offset ||
              column === offset ||
              row === offset + frame.height - 1 ||
              column === offset + frame.width - 1
            ) {
              boundaryAlpha = Math.max(boundaryAlpha, padded[index + 3]);
            }
            const localY = (row + 0.5) / dpr - 140;
            if (localY < -10 && padded[index + 3] > 0) {
              extended = true;
            }
          }
        }
        results.push({ effect, maximumError, boundaryAlpha, extended });
      }
      return { results, errors: [...gpu.errors], environment: gpu.adapterInfo.description };
    } finally {
      normal.destroy();
      expanded.destroy();
    }
  } finally {
    gpu.destroy();
  }
}

declare global {
  interface Window {
    patternSupportChecks: typeof patternSupportChecks;
  }
}
window.patternSupportChecks = patternSupportChecks;

const patternFactories = {
  dither: BrowserEffects.attachDither,
  halftone: BrowserEffects.attachHalftone,
  stipple: BrowserEffects.attachStipple,
  scanlines: BrowserEffects.attachScanlines,
  crosshatch: BrowserEffects.attachCrosshatch,
  diamonds: BrowserEffects.attachDiamonds,
  'contour-echoes': BrowserEffects.attachContourEchoes,
  engraving: BrowserEffects.attachEngraving,
  'woven-mesh': BrowserEffects.attachWovenMesh,
  hexagons: BrowserEffects.attachHexagons,
  interference: BrowserEffects.attachInterference,
  shards: BrowserEffects.attachShards,
  circuits: BrowserEffects.attachCircuits,
  'star-shimmer': BrowserEffects.attachStarShimmer,
  'brush-fringe': BrowserEffects.attachBrushFringe,
};

async function publicPatternChecks() {
  const host = document.createElement('div');
  host.style.position = 'relative';
  const target = document.createElement('div');
  target.style.cssText = 'width:100.25px;height:80.125px;background:white';
  host.append(target);
  document.body.append(host);
  const results = [];
  const settle = () =>
    new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
  try {
    for (const [effect, attach] of Object.entries(patternFactories)) {
      let field = 'plumeReach';
      if (effect === 'contour-echoes') {
        field = 'echoReach';
      } else if (effect === 'brush-fringe') {
        field = 'fringeReach';
      }
      const create = (options: Record<string, unknown>): EffectHandle =>
        Reflect.apply(attach, undefined, [target, { host, ...options }]);
      let invalid = 0;
      for (const value of [-1, NaN, Infinity, null, '0.1']) {
        try {
          const instance = create({ [field]: value });
          instance.dispose();
        } catch (error) {
          if (error instanceof Error && error.message === `invalid-${effect}-parameter`) {
            invalid++;
          }
        }
      }
      const instance = create({ [field]: 0.4 });
      await instance.ready;
      const active = instance.lifecycle === 'active';
      const initial = host.querySelector('canvas');
      const initialSize = initial ? [initial.width, initial.height] : [];
      const dpr = window.devicePixelRatio;
      const expected = () => {
        const rect = target.getBoundingClientRect();
        const reach =
          (field === 'plumeReach' ? rect.height : Math.min(rect.width, rect.height)) * 0.4;
        const padding = Math.max(8, Math.ceil(reach + 10 + 2 / dpr));
        return [
          Math.ceil((rect.width + padding * 2) * dpr),
          Math.ceil((rect.height + padding * 2) * dpr),
        ];
      };
      const expectedInitial = expected();
      target.style.height = '160.125px';
      await settle();
      await instance.refresh();
      const resized = host.querySelector('canvas');
      const resizedSize = resized ? [resized.width, resized.height] : [];
      const expectedResized = expected();
      instance.dispose();
      const zero = create({ [field]: 0 });
      await zero.ready;
      const canvas = host.querySelector('canvas');
      let empty = false;
      if (canvas) {
        const image = new Image();
        image.src = canvas.toDataURL();
        await image.decode();
        const copy = document.createElement('canvas');
        copy.width = canvas.width;
        copy.height = canvas.height;
        const context = copy.getContext('2d')!;
        context.drawImage(image, 0, 0);
        empty = context
          .getImageData(0, 0, copy.width, copy.height)
          .data.every((value) => value === 0);
      }
      zero.dispose();
      target.style.height = '80.125px';
      results.push({
        effect,
        invalid,
        active,
        initialSize,
        expectedInitial,
        resizedSize,
        expectedResized,
        empty,
        canvases: host.querySelectorAll('canvas').length,
      });
    }
    const huge = BrowserEffects.attachDither(target, { host, plumeReach: 1e6 });
    await huge.ready;
    const budget = { lifecycle: huge.lifecycle, reason: huge.reason };
    huge.dispose();
    return { results, budget };
  } finally {
    host.remove();
  }
}

declare global {
  interface Window {
    publicPatternChecks: typeof publicPatternChecks;
  }
}
window.publicPatternChecks = publicPatternChecks;
