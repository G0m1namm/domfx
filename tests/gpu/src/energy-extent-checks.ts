import { captureElement } from '@domfx/browser';
import {
  attachElectricityWithAdapters,
  attachKineticWithAdapters,
  GpuExperiment,
  memoryFor,
  type PreparedGpuFrame,
} from '@domfx/browser/experimental';
import type { CaptureFrame } from '@domfx/core';

function alphaBounds(pixels: Uint8Array, width: number, threshold: number) {
  let minX = width;
  let minY = pixels.length / 4 / width;
  let maxX = -1;
  let maxY = -1;
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] <= threshold) {
      continue;
    }
    const x = (i / 4) % width;
    const y = Math.floor(i / 4 / width);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return { minX, minY, maxX, maxY };
}

const nextPaint = () =>
  new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );

/** Real public lifecycle with capture/texture accounting at the existing adapter seam. */
export async function verifyEnergyExtentLifecycle(kind: 'electricity' | 'kinetic') {
  const host = document.createElement('div');
  host.style.cssText = 'position:absolute;left:80px;top:80px';
  const target = document.createElement('div');
  target.style.cssText = 'width:100.25px;height:160.5px;background:white';
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
  const attach = kind === 'electricity' ? attachElectricityWithAdapters : attachKineticWithAdapters;
  const geometry = kind === 'electricity' ? { contourSpread: 0.08 } : { fragmentTravel: 0.08 };
  const effect = attach(
    target,
    { host, ...geometry, seed: 314, time: 1.5 },
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
      throw new Error(`relative-energy-lifecycle: ${effect.reasonDetail ?? effect.reason}`);
    }
    const output = await prepared.readFire();
    let reach = 0;
    let boundary = 0;
    for (let y = 0; y < frame.height; y++) {
      for (let x = 0; x < frame.width; x++) {
        const alpha = output[(y * frame.width + x) * 4 + 3];
        const localX = (x + 0.5) * frame.pixelToLocal.a + frame.pixelToLocal.e;
        const localY = (y + 0.5) * frame.pixelToLocal.d + frame.pixelToLocal.f;
        if (alpha >= 8) {
          reach = Math.max(
            reach,
            Math.hypot(
              Math.max(-localX, localX - frame.contentBounds.width, 0),
              Math.max(-localY, localY - frame.contentBounds.height, 0),
            ),
          );
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
    target.style.width = '400px';
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

/** Capture/packed-render seam with native readback; no internal shader imports. */
export async function verifyEnergyExtentGeometry(kind: 'electricity' | 'kinetic', dpr: number) {
  const gpu = await GpuExperiment.create();
  const host = document.createElement('div');
  host.style.cssText = 'position:absolute;left:80px;top:80px';
  document.body.append(host);
  const samples = [];
  try {
    for (const shape of ['flat', 'text', 'svg', 'image']) {
      const target = document.createElement('div');
      target.style.cssText = 'width:160px;height:100px;color:white;font:60px/1 system-ui';
      if (shape === 'flat') {
        target.style.background = 'white';
      } else if (shape === 'text') {
        target.textContent = 'Arc';
      } else if (shape === 'svg') {
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
      for (const reach of [10, 40, ...(shape === 'flat' ? [80] : [])]) {
        const support = kind === 'kinetic' ? reach + 8 : reach;
        const padding = Math.ceil(support + 4 + 2 / dpr);
        const captures = [];
        for (const [captureIndex, extra] of [0, 16, 16].entries()) {
          const options = {
            dpr,
            paddingCss: padding + extra,
            resolvePadding: () => padding + extra,
          };
          const capture = await captureElement(target, options);
          const rawSource = capture.pixels.slice();
          // Isolate procedural anchoring from browser image resampling: the third
          // capture uses the first raster translated into the larger allocation.
          if (captureIndex === 2) {
            const first = captures[0];
            capture.pixels.fill(0);
            for (let row = 0; row < first.height; row++) {
              capture.pixels.set(
                first.source.subarray(row * first.width * 4, (row + 1) * first.width * 4),
                ((row + 16 * dpr) * capture.width + 16 * dpr) * 4,
              );
            }
          }
          const frame = await gpu.prepare(capture);
          const geometry = {
            pixelToLocal: capture.pixelToLocal,
            directionalReach: reach,
            inwardDepth: 3,
          };
          try {
            const outputs: Uint8Array[] = [];
            for (const time of [1.5, 3, 1.5]) {
              frame.render(time, 314, 1, dpr, undefined, 24, kind, geometry);
              outputs.push(await frame.readFire());
            }
            let strengthError = 0;
            for (const strength of [0.25, 0.6, 0]) {
              frame.render(1.5, 314, strength, dpr, undefined, 24, kind, geometry);
              const pixels = await frame.readFire();
              strengthError = pixels.reduce(
                (error, value, i) => Math.max(error, Math.abs(value - outputs[0][i] * strength)),
                strengthError,
              );
            }
            frame.render(1.5, 314, 1, dpr, undefined, 24, kind, {
              ...geometry,
              directionalReach: 0,
            });
            const zero = (await frame.readFire()).every((value) => value === 0);
            captures.push({
              outputs,
              source: capture.pixels.slice(),
              rawSource,
              mapping: capture.pixelToLocal,
              contentBounds: capture.contentBounds,
              padding: capture.padding,
              sdf: await frame.readSdf(),
              strengthError,
              zero,
              width: frame.width,
              height: frame.height,
            });
          } finally {
            frame.destroy();
            capture.release();
          }
        }
        const [normal, recaptured, larger] = captures;
        let maxDifference = 0;
        let sourceDifference = 0;
        let recaptureDifference = 0;
        let recaptureOutputDifference = 0;
        const detailWidths: number[] = [];
        let sdfDifference = 0;
        let differenceLocation = [0, 0];
        let boundaryAlpha = 0;
        let outsideAlpha = 0;
        let maxReach = 0;
        let nonempty = false;
        // Measure fine marks in local CSS px, away from the pulse/contour.
        if (shape === 'flat') {
          for (let x = Math.ceil((padding + 20) * dpr); x < (padding + 140) * dpr; x++) {
            let run = 0;
            for (let y = 0; y <= padding * dpr; y++) {
              const offset = (y * normal.width + x) * 4;
              const pixels = normal.outputs[0];
              const localDistance = padding - (y + 0.5) / dpr;
              const mark =
                pixels[offset + 3] >= 128 &&
                (kind === 'electricity'
                  ? pixels[offset] >= pixels[offset + 2] * 0.7
                  : localDistance > 8);
              if (mark) {
                run++;
              }
              if ((!mark || y === padding * dpr) && run > 0) {
                detailWidths.push(run / dpr);
                run = 0;
              }
            }
          }
        }
        if (shape === 'flat' && kind === 'kinetic') {
          for (const pixels of normal.outputs.slice(0, 2)) {
            for (let y = 0; y < normal.height; y++) {
              let run = 0;
              for (let x = 0; x < normal.width; x++) {
                const localX = (x + 0.5) / dpr - padding;
                const localY = (y + 0.5) / dpr - padding;
                const distance = Math.hypot(
                  Math.max(-localX, localX - 160, 0),
                  Math.max(-localY, localY - 100, 0),
                );
                const mark = distance > 8 && pixels[(y * normal.width + x) * 4 + 3] >= 32;
                if (mark) {
                  run++;
                }
                if ((!mark || x === normal.width - 1) && run > 0) {
                  detailWidths.push(run / dpr);
                  run = 0;
                }
              }
            }
          }
        }
        for (let y = 0; y < normal.height; y++) {
          for (let x = 0; x < normal.width; x++) {
            const offset = (y * normal.width + x) * 4;
            const other = ((y + 16 * dpr) * larger.width + x + 16 * dpr) * 4;
            for (let channel = 0; channel < 4; channel++) {
              const difference = Math.abs(
                normal.outputs[0][offset + channel] - larger.outputs[0][other + channel],
              );
              if (difference > maxDifference) {
                differenceLocation = [x, y];
              }
              maxDifference = Math.max(maxDifference, difference);
              recaptureOutputDifference = Math.max(
                recaptureOutputDifference,
                Math.abs(
                  normal.outputs[0][offset + channel] - recaptured.outputs[0][other + channel],
                ),
              );
              recaptureDifference = Math.max(
                recaptureDifference,
                Math.abs(
                  normal.rawSource[offset + channel] - recaptured.rawSource[other + channel],
                ),
              );
              sourceDifference = Math.max(
                sourceDifference,
                Math.abs(normal.source[offset + channel] - larger.source[other + channel]),
              );
              if (Math.abs(normal.sdf[offset / 4]) < (support + 2) * dpr) {
                sdfDifference = Math.max(
                  sdfDifference,
                  Math.abs(normal.sdf[offset / 4] - larger.sdf[other / 4]),
                );
              }
            }
            const localX = (x + 0.5) / dpr - padding;
            const localY = (y + 0.5) / dpr - padding;
            // Independent Euclidean distance to the known rectangular source box.
            const distance = Math.hypot(
              Math.max(-localX, localX - 160, 0),
              Math.max(-localY, localY - 100, 0),
            );
            for (const output of normal.outputs.slice(0, 2)) {
              const alpha = output[offset + 3];
              nonempty ||= alpha > 0;
              if (alpha >= 8) {
                maxReach = Math.max(maxReach, distance);
              }
              if (distance > support + 1.5) {
                outsideAlpha = Math.max(outsideAlpha, alpha);
              }
              if (x === 0 || y === 0 || x === normal.width - 1 || y === normal.height - 1) {
                boundaryAlpha = Math.max(boundaryAlpha, alpha);
              }
            }
          }
        }
        samples.push({
          shape,
          reach,
          maxDifference,
          sourceDifference,
          recaptureDifference,
          recaptureOutputDifference,
          captureMappings: captures.slice(0, 2).map((entry) => ({
            width: entry.width,
            height: entry.height,
            mapping: entry.mapping,
            contentBounds: entry.contentBounds,
            padding: entry.padding,
            alphaBounds: alphaBounds(entry.rawSource, entry.width, 0),
            maskBounds: alphaBounds(entry.rawSource, entry.width, 127),
            sourceRgbaBase64:
              shape === 'image' && reach === 10 && dpr === 1.25
                ? btoa(Array.from(entry.rawSource, (value) => String.fromCharCode(value)).join(''))
                : undefined,
          })),
          detailWidths,
          sdfDifference,
          differenceLocation,
          boundaryAlpha,
          outsideAlpha,
          maxReach,
          nonempty,
          zero: normal.zero,
          strengthError: normal.strengthError,
          repeat: normal.outputs[0].every((value, i) => value === normal.outputs[2][i]),
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
