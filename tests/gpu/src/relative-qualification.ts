import { captureElement } from '@domfx/browser';
import * as api from '@domfx/browser';
import type { EffectHandle } from '@domfx/browser';
import { GpuExperiment, memoryFor, startEffectDiagnostics } from '@domfx/browser/experimental';

import { effects } from './effect-selection.js';

const factories = {
  fire: api.attachFire,
  electricity: api.attachElectricity,
  frost: api.attachFrost,
  kinetic: api.attachKinetic,
  slime: api.attachSlime,
  'burned-paper': api.attachBurnedPaper,
  dither: api.attachDither,
  halftone: api.attachHalftone,
  stipple: api.attachStipple,
  scanlines: api.attachScanlines,
  crosshatch: api.attachCrosshatch,
  diamonds: api.attachDiamonds,
  'contour-echoes': api.attachContourEchoes,
  engraving: api.attachEngraving,
  'woven-mesh': api.attachWovenMesh,
  hexagons: api.attachHexagons,
  interference: api.attachInterference,
  shards: api.attachShards,
  circuits: api.attachCircuits,
  'star-shimmer': api.attachStarShimmer,
  'brush-fringe': api.attachBrushFringe,
};

const nextPaint = () =>
  new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );

function relativeOptions(effect: (typeof effects)[number]) {
  switch (effect) {
    case 'fire':
      return { flameReach: 0.1 };
    case 'electricity':
      return { contourSpread: 0.1 };
    case 'frost':
      return { coatingDepth: 0.05, mistReach: 0.1 };
    case 'slime':
      return { coatingDepth: 0.05, dripReach: 0.1 };
    case 'burned-paper':
      return { scorchDepth: 0.05, ashReach: 0.1 };
    case 'kinetic':
      return { fragmentTravel: 0.1 };
    case 'contour-echoes':
      return { echoReach: 0.1 };
    case 'brush-fringe':
      return { fringeReach: 0.1 };
    default:
      return { plumeReach: 0.1, bandDepth: 0.05 };
  }
}

/** Public attachments establish proportional allocation, setter behavior and resize ownership. */
export async function qualifyRelativeCatalog() {
  const host = document.createElement('div');
  host.style.cssText = 'position:absolute;left:80px;top:80px';
  const target = document.createElement('button');
  target.style.cssText =
    'display:block;box-sizing:border-box;width:100px;height:100px;border:0;padding:0;background:white';
  host.append(target);
  document.body.append(host);
  const diagnostics = startEffectDiagnostics({ capacity: 4096 });
  const ledger = memoryFor(document);
  const baseline = ledger.bytes;
  const results = [];
  try {
    for (const effect of effects) {
      target.style.width = '100px';
      target.style.height = '100px';
      // Runtime seam deliberately calls the root-exported factory selected by the catalog.
      const handle: EffectHandle = Reflect.apply(factories[effect], undefined, [
        target,
        { host, ...relativeOptions(effect), seed: 314, time: 1.5 },
      ]);
      try {
        await handle.ready;
        if (handle.lifecycle !== 'active') {
          throw new Error(`${effect}: ${handle.reasonDetail ?? handle.reason}`);
        }
        const canvas = host.querySelector('canvas');
        if (!canvas) {
          throw new Error('missing-relative-canvas');
        }
        const initialWidth = canvas.width;
        const captures = () =>
          diagnostics.records.filter((record) => record.stage === 'capture').length;
        const before = { captures: captures(), bytes: ledger.bytes };
        const sample = async (strength: number, time = 1.5) => {
          handle.intensity = strength;
          handle.time = time;
          await nextPaint();
          const image = new Image();
          image.src = canvas.toDataURL();
          await image.decode();
          const copy = document.createElement('canvas');
          copy.width = canvas.width;
          copy.height = canvas.height;
          const context = copy.getContext('2d');
          if (!context) {
            throw new Error('missing-relative-copy');
          }
          context.drawImage(image, 0, 0);
          const rgba = context.getImageData(0, 0, copy.width, copy.height).data;
          return Float32Array.from(rgba, (value, index) =>
            index % 4 === 3 ? value : (value * rgba[index - (index % 4) + 3]) / 255,
          );
        };
        const full = await sample(1);
        let maximumStrengthError = 0;
        for (const strength of [0.5, 0.2]) {
          const pixels = await sample(strength);
          maximumStrengthError = Math.max(
            maximumStrengthError,
            pixels.reduce(
              (error, value, index) => Math.max(error, Math.abs(value - full[index] * strength)),
              0,
            ),
          );
        }
        const zero = await sample(0);
        await sample(1, -2.5);
        const repeated = await sample(1);
        const stableStrength = before.captures === captures() && before.bytes === ledger.bytes;
        host.style.transform = 'translate(7.25px, 9.5px) scale(1.25, .8)';
        await nextPaint();
        const stablePlacement = before.captures === captures() && before.bytes === ledger.bytes;
        host.style.transform = 'none';
        target.style.width = '400px';
        target.style.height = '400px';
        await handle.refresh();
        const resized = host.querySelector('canvas');
        results.push({
          effect,
          initialWidth,
          resizedWidth: resized?.width,
          maximumStrengthError,
          stableStrength,
          stablePlacement,
          nonempty: full.some((value) => value > 0),
          zero: zero.every((value) => value === 0),
          repeated: full.every((value, index) => value === repeated[index]),
          resizedState: handle.lifecycle,
        });
      } finally {
        handle.dispose();
      }
    }
    return {
      results,
      releasedBytes: ledger.bytes - baseline,
      canvases: host.querySelectorAll('canvas').length,
      userAgent: navigator.userAgent,
      dpr: devicePixelRatio,
    };
  } finally {
    diagnostics.dispose();
    host.remove();
  }
}

/** Synthetic event integration only; this does not establish native DPR event delivery. */
export async function qualifyRelativeResolutionListeners() {
  const host = document.createElement('div');
  host.style.cssText = 'position:absolute;left:80px;top:80px';
  const target = document.createElement('div');
  target.style.cssText = 'width:100px;height:100px;background:white';
  host.append(target);
  document.body.append(host);
  const matchMedia = window.matchMedia;
  const resolutions: MediaQueryList[] = [];
  window.matchMedia = (query) => {
    const result = matchMedia.call(window, query);
    if (query.includes('resolution:')) {
      resolutions.push(result);
    }
    return result;
  };
  const diagnostics = startEffectDiagnostics({ capacity: 4096 });
  const ledger = memoryFor(document);
  const baseline = ledger.bytes;
  const results = [];
  try {
    for (const effect of effects) {
      resolutions.length = 0;
      const handle: EffectHandle = Reflect.apply(factories[effect], undefined, [
        target,
        { host, ...relativeOptions(effect), seed: 314 },
      ]);
      try {
        await handle.ready;
        const query = resolutions.at(-1);
        if (!query) {
          throw new Error(`Missing relative DPR listener: ${effect}`);
        }
        const captures = () =>
          diagnostics.records.filter((record) => record.stage === 'capture').length;
        const before = captures();
        query.dispatchEvent(new Event('change'));
        for (let attempt = 0; attempt < 120; attempt++) {
          await nextPaint();
          if (captures() > before && handle.lifecycle === 'active' && handle.raster === 'fresh') {
            break;
          }
        }
        const refreshed =
          captures() > before && handle.lifecycle === 'active' && handle.raster === 'fresh';
        handle.dispose();
        const disposedCaptures = captures();
        query.dispatchEvent(new Event('change'));
        await nextPaint();
        results.push({
          effect,
          refreshed,
          disposedCapturesStable: captures() === disposedCaptures,
          releasedBytes: ledger.bytes - baseline,
        });
      } finally {
        handle.dispose();
      }
    }
    return { results, canvases: host.querySelectorAll('canvas').length };
  } finally {
    window.matchMedia = matchMedia;
    diagnostics.dispose();
    host.remove();
  }
}

/** Compare the real relative capture path at identical target-local sample positions. */
export async function qualifyRelativeCapture(kind: string, dpr: number) {
  const host = document.createElement('div');
  host.style.cssText = 'position:absolute;left:80px;top:80px';
  const target = document.createElement('div');
  target.style.cssText = 'width:160.5px;height:100.25px;color:white;font:60px/1 system-ui';
  host.append(target);
  document.body.append(host);
  if (kind === 'image-integer') {
    target.style.width = '160px';
    target.style.height = '100px';
  }
  if (kind === 'text') {
    target.textContent = 'Fire';
  } else if (kind === 'svg') {
    target.innerHTML =
      '<svg width="160.5" height="100.25" viewBox="0 0 160 100"><path fill="white" fill-rule="evenodd" d="M10 5h65v90H10z M25 25v50h35V25z M100 10h2v80h-2z M125 40h25v30h-25z"/></svg>';
  } else if (kind.startsWith('image')) {
    const image = document.createElement('img');
    image.style.cssText = `display:block;width:${target.style.width};height:${target.style.height}`;
    const source = document.createElement('canvas');
    source.width = 160;
    source.height = 100;
    const context = source.getContext('2d');
    if (!context) {
      throw new Error('missing-source-context');
    }
    context.fillStyle = 'white';
    context.beginPath();
    context.arc(40, 50, 35, 0, Math.PI * 2);
    context.arc(120, 50, 25, 0, Math.PI * 2);
    context.fill();
    image.src = source.toDataURL();
    target.append(image);
    await image.decode();
  } else {
    target.style.background = 'white';
  }
  await document.fonts.ready;
  const gpu = await GpuExperiment.create();
  const capture = async (padding: number) => {
    // Preserve authoritative fractional bounds through the same callback as attachments.
    const options = { dpr, paddingCss: padding, resolvePadding: () => padding };
    const frame = await captureElement(target, options);
    return { frame, prepared: await gpu.prepare(frame) };
  };
  try {
    const normal = await capture(60);
    const larger = await capture(76);
    try {
      const offset = 16 * dpr;
      let sourceDifference = 0;
      let maskDifferences = 0;
      for (let y = 0; y < normal.frame.height; y++) {
        for (let x = 0; x < normal.frame.width; x++) {
          const a = (y * normal.frame.width + x) * 4 + 3;
          const b = ((y + offset) * larger.frame.width + x + offset) * 4 + 3;
          if (normal.frame.pixels[a] >= 128 !== larger.frame.pixels[b] >= 128) {
            maskDifferences++;
          }
          sourceDifference = Math.max(
            sourceDifference,
            Math.abs(normal.frame.pixels[a] - larger.frame.pixels[b]),
          );
        }
      }
      const normalSdf = await normal.prepared.readSdf();
      const largerSdf = await larger.prepared.readSdf();
      let sdfDifference = 0;
      for (let y = 0; y < normal.frame.height; y++) {
        for (let x = 0; x < normal.frame.width; x++) {
          const a = y * normal.frame.width + x;
          const b = (y + offset) * larger.frame.width + x + offset;
          if (Math.abs(normalSdf[a]) <= 50 * dpr) {
            sdfDifference = Math.max(sdfDifference, Math.abs(normalSdf[a] - largerSdf[b]));
          }
        }
      }
      const results = [];
      for (const effect of effects) {
        const geometry = { directionalReach: 40, inwardDepth: effect === 'fire' ? 3 : 10 };
        for (const { frame, prepared } of [normal, larger]) {
          prepared.render(1.5, 314, 1, dpr, undefined, 24, effect, {
            ...geometry,
            pixelToLocal: frame.pixelToLocal,
          });
        }
        const a = await normal.prepared.readFire();
        const b = await larger.prepared.readFire();
        let maximumDifference = 0;
        let boundaryAlpha = 0;
        for (let y = 0; y < larger.frame.height; y++) {
          for (let x = 0; x < larger.frame.width; x++) {
            const other = (y * larger.frame.width + x) * 4;
            const inside =
              x >= offset &&
              y >= offset &&
              x < normal.frame.width + offset &&
              y < normal.frame.height + offset;
            if (!inside) {
              boundaryAlpha = Math.max(boundaryAlpha, b[other + 3]);
              continue;
            }
            const original = ((y - offset) * normal.frame.width + x - offset) * 4;
            for (let channel = 0; channel < 4; channel++) {
              maximumDifference = Math.max(
                maximumDifference,
                Math.abs(a[original + channel] - b[other + channel]),
              );
            }
            if (
              x === offset ||
              y === offset ||
              x === normal.frame.width + offset - 1 ||
              y === normal.frame.height + offset - 1
            ) {
              boundaryAlpha = Math.max(boundaryAlpha, a[original + 3]);
            }
          }
        }
        results.push({ effect, maximumDifference, boundaryAlpha });
      }
      return {
        kind,
        dpr,
        sourceDifference,
        maskDifferences,
        sdfDifference,
        box: normal.frame.contentBounds,
        padding: normal.frame.padding,
        mapping: normal.frame.pixelToLocal,
        results,
        errors: [...gpu.errors],
        environment: {
          userAgent: navigator.userAgent,
          gpu: {
            vendor: gpu.adapterInfo.vendor,
            architecture: gpu.adapterInfo.architecture,
            device: gpu.adapterInfo.device,
            description: gpu.adapterInfo.description,
          },
        },
      };
    } finally {
      normal.prepared.destroy();
      larger.prepared.destroy();
      normal.frame.release();
      larger.frame.release();
    }
  } finally {
    gpu.destroy();
    host.remove();
  }
}
