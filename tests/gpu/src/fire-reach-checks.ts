import { captureElement } from '@domfx/browser';
import {
  attachFireWithAdapters,
  GpuExperiment,
  memoryFor,
  type PreparedGpuFrame,
} from '@domfx/browser/experimental';
import type { CaptureFrame } from '@domfx/core';

const nextPaint = () =>
  new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );

/** Real public lifecycle with capture/texture accounting at the existing adapter seam. */
export async function verifyFireReachLifecycle() {
  const host = document.createElement('div');
  host.style.cssText = 'position:absolute;left:80px;top:80px';
  const target = document.createElement('div');
  target.style.cssText = 'width:100.25px;height:100.25px;background:white';
  host.append(target);
  document.body.append(host);
  const gpu = await GpuExperiment.create();
  const ledger = memoryFor(document);
  const baseline = ledger.bytes;
  const createTexture = gpu.device.createTexture.bind(gpu.device);
  let textures = 0;
  gpu.device.createTexture = (descriptor) => {
    textures++;
    return createTexture(descriptor);
  };
  let captures = 0;
  let frame: CaptureFrame | undefined;
  let prepared: PreparedGpuFrame | undefined;
  const effect = attachFireWithAdapters(
    target,
    { host, flameReach: 0.1, seed: 314, time: 1.5 },
    {
      capture: async (element, options, reserve, ready) => {
        captures++;
        // Forward the private authoritative-padding resolver through the real adapter.
        const result = await captureElement(element, options);
        reserve?.(result.width, result.height);
        ready?.();
        frame = result;
        return result;
      },
      createRenderer: async () => ({
        device: gpu.device,
        prepare: async (capture) => {
          prepared = await gpu.prepare(capture);
          return prepared;
        },
        destroy() {},
      }),
    },
  );
  const sample = async () => {
    if (!frame || !prepared || effect.lifecycle !== 'active') {
      throw new Error(`relative-fire-lifecycle: ${effect.reasonDetail ?? effect.reason}`);
    }
    const output = await prepared.readFire();
    let reach = 0;
    let boundary = 0;
    for (let y = 0; y < frame.height; y++) {
      for (let x = 0; x < frame.width; x++) {
        const alpha = output[(y * frame.width + x) * 4 + 3];
        const localX = (x + 0.5) * frame.pixelToLocal.a + frame.pixelToLocal.e;
        const localY = (y + 0.5) * frame.pixelToLocal.d + frame.pixelToLocal.f;
        if (localX > 10 && localX < 90 && alpha >= 32) {
          reach = Math.max(reach, -localY);
        }
        if (x === 0 || y === 0 || x === frame.width - 1 || y === frame.height - 1) {
          boundary = Math.max(boundary, alpha);
        }
      }
    }
    const canvas = host.querySelector('canvas');
    if (!canvas) {
      throw new Error('missing-relative-output');
    }
    return {
      reach,
      boundary,
      box: frame.contentBounds,
      padding: frame.padding,
      mapping: frame.pixelToLocal,
      canvasWidth: canvas.width,
      cssWidth: Number.parseFloat(canvas.style.width),
    };
  };
  try {
    await effect.ready;
    const first = await sample();
    const before = { captures, textures, bytes: ledger.bytes };
    effect.intensity = 0.4;
    await nextPaint();
    effect.intensity = 1;
    host.style.transform = 'translate(7.25px, 9.5px) scale(1.25, .8)';
    await nextPaint();
    const placementOnly =
      captures === before.captures && textures === before.textures && ledger.bytes === before.bytes;
    const scaleSample = await sample();
    target.style.height = '400px';
    for (let attempt = 0; attempt < 120; attempt++) {
      await nextPaint();
      if (
        frame?.contentBounds.height === 400 &&
        effect.lifecycle === 'active' &&
        effect.raster === 'fresh'
      ) {
        break;
      }
    }
    const resized = await sample();
    const resizeCaptures = captures;
    await effect.refresh();
    const refreshed = await sample();
    target.style.boxShadow = '0 0 20px white';
    const overflow = await effect.refresh().catch((error: Error) => error.message);
    const rejected = {
      reason: effect.reason,
      bytes: ledger.bytes - baseline,
      canvases: host.querySelectorAll('canvas').length,
    };
    target.style.boxShadow = 'none';
    await effect.retry();
    const recovered = effect.lifecycle === 'active';
    effect.dispose();
    effect.dispose();
    return {
      first,
      scaleSample,
      resized,
      refreshed,
      resizeCaptures,
      placementOnly,
      overflow,
      rejected,
      recovered,
      releasedBytes: ledger.bytes - baseline,
      managedBytes: gpu.managedBytes,
      errors: gpu.errors,
      dpr: devicePixelRatio,
    };
  } finally {
    effect.dispose();
    await effect.ready;
    gpu.destroy();
    host.remove();
  }
}

/** Native output at the existing capture/renderer seam, compared in local coordinates. */
export async function verifyFireReachGeometry(dpr: number) {
  const gpu = await GpuExperiment.create();
  const host = document.createElement('div');
  host.style.cssText = 'position:absolute;left:80px;top:80px';
  document.body.append(host);
  const samples = [];
  try {
    for (const kind of ['flat', 'text', 'svg', 'image']) {
      const target = document.createElement('div');
      target.style.cssText = 'width:160px;height:100px;color:white;font:60px/1 system-ui';
      if (kind === 'flat') {
        target.style.background = 'white';
      } else if (kind === 'text') {
        target.textContent = 'Fire';
      } else if (kind === 'svg') {
        target.innerHTML =
          '<svg width="160" height="100" viewBox="0 0 160 100"><path fill="white" fill-rule="evenodd" d="M10 5h65v90H10z M25 25v50h35V25z M100 10h2v80h-2z M125 40h25v30h-25z"/></svg>';
      } else {
        const image = document.createElement('img');
        image.width = 160;
        image.height = 100;
        const source = document.createElement('canvas');
        source.width = 160;
        source.height = 100;
        const context = source.getContext('2d');
        if (!context) {
          throw new Error('missing-image-source');
        }
        context.fillStyle = 'white';
        context.beginPath();
        context.arc(40, 50, 35, 0, Math.PI * 2);
        context.arc(120, 50, 25, 0, Math.PI * 2);
        context.fill();
        image.src = source.toDataURL();
        target.append(image);
        await image.decode();
      }
      host.append(target);
      await document.fonts.ready;
      for (const reach of [10, 40]) {
        const padding = Math.ceil(reach + 4 + 2 / dpr);
        const captures = [];
        for (const extra of [0, 16]) {
          const capture = await captureElement(target, { dpr, paddingCss: padding + extra });
          const frame = await gpu.prepare(capture);
          try {
            frame.render(1.5, 314, 1, dpr, undefined, 24, 'fire', {
              pixelToLocal: capture.pixelToLocal,
              directionalReach: reach,
              inwardDepth: 3,
            });
            captures.push({
              pixels: await frame.readFire(),
              source: capture.pixels.slice(),
              sdf: await frame.readSdf(),
              width: frame.width,
              height: frame.height,
            });
          } finally {
            frame.destroy();
            capture.release();
          }
        }
        const [normal, larger] = captures;
        let maxDifference = 0;
        let sourceDifference = 0;
        let distanceDifference = 0;
        let boundaryAlpha = 0;
        let supportAlpha = 0;
        let maxReach = 0;
        const emberWidths: number[] = [];
        for (let y = 0; y < normal.height; y++) {
          let emberRun = 0;
          for (let x = 0; x < normal.width; x++) {
            const offset = (y * normal.width + x) * 4;
            const other = ((y + 16 * dpr) * larger.width + x + 16 * dpr) * 4;
            for (let channel = 0; channel < 4; channel++) {
              maxDifference = Math.max(
                maxDifference,
                Math.abs(normal.pixels[offset + channel] - larger.pixels[other + channel]),
              );
            }
            sourceDifference = Math.max(
              sourceDifference,
              Math.abs(normal.source[offset + 3] - larger.source[other + 3]),
            );
            if (normal.sdf[offset / 4] > -4 * dpr && normal.sdf[offset / 4] < reach * dpr + 2) {
              distanceDifference = Math.max(
                distanceDifference,
                Math.abs(normal.sdf[offset / 4] - larger.sdf[other / 4]),
              );
            }
            const alpha = normal.pixels[offset + 3];
            const localY = (y + 0.5) / dpr - padding;
            const gold =
              localY < -reach * 0.5 &&
              alpha > 24 &&
              normal.pixels[offset + 1] > normal.pixels[offset] * 0.7 &&
              normal.pixels[offset + 2] > normal.pixels[offset] * 0.15;
            if (gold) {
              emberRun++;
            }
            if ((!gold || x === normal.width - 1) && emberRun > 0) {
              emberWidths.push(emberRun / dpr);
              emberRun = 0;
            }
            if (localY < -reach - 1) {
              supportAlpha = Math.max(supportAlpha, alpha);
            }
            if (x > 20 * dpr && x < 140 * dpr && alpha >= 32) {
              maxReach = Math.max(maxReach, -localY);
            }
            if (x === 0 || y === 0 || x === normal.width - 1 || y === normal.height - 1) {
              boundaryAlpha = Math.max(boundaryAlpha, alpha);
            }
          }
        }
        samples.push({
          kind,
          reach,
          maxDifference,
          sourceDifference,
          distanceDifference,
          boundaryAlpha,
          supportAlpha,
          maxReach,
          emberWidths,
        });
      }
      target.remove();
    }
    return {
      samples,
      errors: gpu.errors,
      managedBytes: gpu.managedBytes,
      gpu: gpu.adapterInfo.description,
      userAgent: navigator.userAgent,
      dpr,
    };
  } finally {
    gpu.destroy();
    host.remove();
  }
}
