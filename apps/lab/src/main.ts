import { gsap } from 'gsap';

import { captureElement, type EffectHandle } from '@domfx/browser';
import { GpuExperiment, memoryFor, type PreparedGpuFrame } from '@domfx/browser/experimental';
import { classifyAlpha, type CaptureFrame } from '@domfx/core';

import { exactDistanceField } from './diagnostics/distance-oracle.js';
import { verifyFireShape } from './diagnostics/fire-shape.js';
import { verifyPreparationResources } from './diagnostics/preparation-resources.js';
import { createGallery } from './gallery.js';

const element = <T extends Element = HTMLElement>(id: string) =>
  document.getElementById(id)! as unknown as T;
const status = element('status');
const images: Record<string, string> = {};
const report: Record<string, unknown> = {};
declare global {
  interface Window {
    domfxGallery?: ReturnType<typeof createGallery>;
    domfxEvidence?: { report: Record<string, unknown>; images: Record<string, string> };
  }
}
const automation = new URLSearchParams(location.search).has('automation');
// Capture/failure cases retain their real GPU checks without repeating the soak/timing run.
const functional = automation && new URLSearchParams(location.search).has('functional');
report.diagnostics = functional ? 'functional' : 'full';
if (automation) {
  Object.assign(window, { domfxEvidence: { report, images } });
}
let roundedClicks = 0;
element<HTMLButtonElement>('rounded').onclick = () => {
  element('interaction').textContent = `Rounded button clicks: ${++roundedClicks}`;
};
let service: GpuExperiment | undefined;
let live: PreparedGpuFrame | undefined;
let stop = () => {};
let gallery: ReturnType<typeof createGallery> | undefined;
const sleepFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

function showReport() {
  element('report').textContent = JSON.stringify(report, null, 2);
  const outcome = typeof report.outcome === 'string' ? report.outcome : '';
  const tone = outcome.startsWith('PASS')
    ? 'pass'
    : outcome.startsWith('UNAVAILABLE')
      ? 'unavailable'
      : outcome === 'FAIL'
        ? 'fail'
        : 'pending';
  const summary = element('result-summary');
  summary.dataset.tone = tone;
  summary.textContent = outcome || 'Checks are running. No final render result yet.';
  const error = element('result-error');
  error.hidden = !report.error && !report.galleryError;
  error.textContent = String(report.galleryError ?? report.error ?? '');
  const checks = [
    ['check-capture', report.captures, 7],
    ['check-fire', report.fire],
    ['check-gsap', report.gsap],
    ['check-resources', report.preparationResources],
  ] as const;
  for (const [id, value, count] of checks) {
    const completed =
      typeof value === 'object' &&
      value !== null &&
      (count ? Object.keys(value).length === count : 'pass' in value && value.pass === true);
    const node = element(id);
    node.textContent = completed ? 'PASS' : tone === 'pending' ? 'Pending' : 'Not completed';
    node.dataset.tone = completed ? 'pass' : tone;
  }
}
function check(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}
function hash(bytes: Uint8Array): string {
  let value = 2166136261;
  for (const byte of bytes) {
    value = Math.imul(value ^ byte, 16777619);
  }
  return (value >>> 0).toString(16).padStart(8, '0');
}
function picture(
  name: string,
  width: number,
  height: number,
  bytes: Uint8Array,
  visible?: string,
): void {
  const canvas = visible ? element<HTMLCanvasElement>(visible) : document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas
    .getContext('2d')!
    .putImageData(new ImageData(new Uint8ClampedArray(bytes), width, height), 0, 0);
  images[name] = canvas.toDataURL();
  if (!visible) {
    canvas.width = 0;
    canvas.height = 0;
  }
}
function firePicture(
  name: string,
  width: number,
  height: number,
  premultiplied: Uint8Array,
  visible?: string,
): void {
  const straight = premultiplied.slice();
  for (let i = 0; i < straight.length; i += 4) {
    if (straight[i + 3]) {
      for (let c = 0; c < 3; c++) {
        straight[i + c] = Math.min(255, Math.round((straight[i + c] * 255) / straight[i + 3]));
      }
    }
  }
  picture(name, width, height, straight, visible);
}
function fieldPicture(
  name: string,
  width: number,
  height: number,
  values: Float32Array,
  visible?: string,
): void {
  const bytes = new Uint8Array(values.length * 4);
  for (let i = 0; i < values.length; i++) {
    const inside = values[i] < 0;
    const band = 0.6 + 0.4 * Math.cos(values[i] * 0.6);
    bytes.set(inside ? [20, 90 * band, 255, 255] : [255, 130 * band, 50 * band, 255], i * 4);
  }
  picture(name, width, height, bytes, visible);
}
function compare(mask: Uint8Array, width: number, height: number, gpu: Float32Array) {
  check(gpu.length === width * height, 'GPU readback must cover the full raster');
  const truth = exactDistanceField(mask, width, height);
  let maxError = 0;
  let squaredError = 0;
  let wrongSigns = 0;
  let maxContourError = 0;
  let crossings = 0;
  for (let i = 0; i < gpu.length; i++) {
    const error = Math.abs(gpu[i] - truth[i]);
    check(Number.isFinite(error), `nonfinite distance at ${i}`);
    maxError = Math.max(maxError, error);
    squaredError += error * error;
    if (gpu[i] < 0 !== Boolean(mask[i])) {
      wrongSigns++;
    }
    for (const j of [i % width < width - 1 ? i + 1 : -1, i + width < gpu.length ? i + width : -1]) {
      if (j < 0 || mask[i] === mask[j]) {
        continue;
      }
      crossings++;
      maxContourError = Math.max(
        maxContourError,
        Math.abs(gpu[i] / (gpu[i] - gpu[j]) - truth[i] / (truth[i] - truth[j])),
      );
    }
  }
  const result = {
    pixels: gpu.length,
    maxError,
    rmsError: Math.sqrt(squaredError / gpu.length),
    wrongSigns,
    crossings,
    maxContourError,
    pass: maxError <= 1.5 && wrongSigns === 0 && maxContourError <= 1,
  };
  check(result.pass, `GPU oracle failed: ${JSON.stringify(result)}`);
  return result;
}
function verifiedMask(frame: Pick<CaptureFrame, 'width' | 'height' | 'pixels'>) {
  const mask = classifyAlpha(frame);
  check(
    mask.every((value, i) => value === Number(frame.pixels[i * 4 + 3] >= 128)),
    'alpha classification must retain threshold 128',
  );
  return mask;
}
function boundaryAlpha(frame: CaptureFrame, marginCss = 0): number {
  const mx = Math.max(1, Math.ceil(marginCss / frame.pixelToLocal.a));
  const my = Math.max(1, Math.ceil(marginCss / frame.pixelToLocal.d));
  let max = 0;
  for (let y = 0; y < frame.height; y++) {
    for (let x = 0; x < frame.width; x++) {
      if (x < mx || x >= frame.width - mx || y < my || y >= frame.height - my) {
        max = Math.max(max, frame.pixels[(y * frame.width + x) * 4 + 3]);
      }
    }
  }
  return max;
}
function alphaAt(frame: CaptureFrame, localX: number, localY: number) {
  const x = Math.floor((localX - frame.pixelToLocal.e) / frame.pixelToLocal.a);
  const y = Math.floor((localY - frame.pixelToLocal.f) / frame.pixelToLocal.d);
  return Array.from(
    frame.pixels.subarray((y * frame.width + x) * 4, (y * frame.width + x) * 4 + 4),
  );
}
function verifyCapturePaint(id: string, frame: CaptureFrame) {
  if (id === 'guard') {
    const overflow = [
      [-15, 15],
      [25, -15],
      [79, 15],
      [25, 55],
    ].map(([x, y]) => alphaAt(frame, x, y));
    const background = alphaAt(frame, 30, 20);
    const shadow = alphaAt(frame, 76, 32);
    check(
      overflow.every(
        (pixel) => pixel[0] === 0 && pixel[1] === 255 && pixel[2] === 255 && pixel[3] === 255,
      ),
      'overflow sentinel missing',
    );
    check(background[3] === 0, 'ancestor background was captured');
    check(shadow[0] > 240 && shadow[3] > 0, 'root shadow missing');
    return { overflow, transparentInterior: background, rootShadow: shadow };
  }
  if (id === 'card') {
    const background = alphaAt(frame, 10, 20);
    check(background.join(',') === '194,197,219,255', 'selected root background missing');
    return { background };
  }
  if (id === 'vector' || id === 'transparent') {
    const hole = alphaAt(frame, 32, 32);
    const inside = alphaAt(frame, 15, 32);
    const island = alphaAt(frame, id === 'vector' ? 83 : 80, 32);
    check(
      hole[3] === 0 && inside[3] === 255 && island[3] >= 128,
      'inner contour or island missing',
    );
    return { hole, inside, island };
  }
  if (id !== 'transformed') {
    return undefined;
  }
  check(
    frame.contentBounds.width === 80 && frame.contentBounds.height === 48,
    'transformed content bounds',
  );
  const landmarks = [
    [255, 0, 0, 4, 4],
    [0, 136, 255, 76, 44],
  ].map(([r, g, b, expectedX, expectedY]) => {
    let coverage = 0;
    let sumX = 0;
    let sumY = 0;
    for (let y = 0; y < frame.height; y += 1) {
      for (let x = 0; x < frame.width; x += 1) {
        const i = (y * frame.width + x) * 4;
        if (frame.pixels[i] !== r || frame.pixels[i + 1] !== g || frame.pixels[i + 2] !== b) {
          continue;
        }
        const weight = frame.pixels[i + 3] / 255;
        coverage += weight;
        sumX += (x + 0.5) * weight;
        sumY += (y + 0.5) * weight;
      }
    }
    const { a, d, e, f } = frame.pixelToLocal;
    const localX = (sumX / coverage) * a + e;
    const localY = (sumY / coverage) * d + f;
    const errorRasterPx = [Math.abs(localX - expectedX) / a, Math.abs(localY - expectedY) / d];
    // Independent fixture geometry: two opaque 8 × 8 CSS-pixel squares.
    check(Math.abs(coverage * a * d - 64) < 0.01, 'target scale was baked into marker area');
    check(
      errorRasterPx.every((error) => error <= 0.5),
      'marked pixels map to wrong local coordinates',
    );
    return { expected: [expectedX, expectedY], actual: [localX, localY], coverage, errorRasterPx };
  });
  return { landmarks, pass: true };
}
async function runNumericalFixtures(gpu: GpuExperiment) {
  const results: Record<string, unknown> = {};
  for (const name of [
    'ring',
    'islands',
    'diagonal',
    'semitransparent',
    'opaque-exterior',
    'empty',
    'full-without-exterior',
  ]) {
    const width = 47;
    const height = 39;
    const pixels = new Uint8Array(width * height * 4);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const radius = Math.hypot(x - 23, y - 19);
        let alpha = 0;
        if (name === 'ring') {
          alpha = radius <= 15 && radius >= 7 ? 255 : 0;
        }
        if (name === 'islands') {
          alpha = Math.hypot(x - 12, y - 12) < 7 || Math.hypot(x - 35, y - 26) < 5 ? 255 : 0;
        }
        if (name === 'diagonal') {
          alpha = Math.round(Math.max(0, 1 - Math.abs(y - x * 0.61 - 5) / 2) * 255);
        }
        if (name === 'semitransparent') {
          alpha = x > 8 && x < 38 && y > 8 && y < 30 ? (x < 15 ? 127 : x < 23 ? 128 : 192) : 0;
        }
        if (name === 'opaque-exterior') {
          alpha = x > 5 && x < 41 && y > 5 && y < 33 ? 255 : 0;
        }
        if (name === 'full-without-exterior') {
          alpha = 255;
        }
        pixels.set([200, 120, 60, alpha], (y * width + x) * 4);
      }
    }
    const frame = { width, height, pixels };
    const rejected =
      name === 'empty'
        ? 'empty-mask'
        : name === 'full-without-exterior'
          ? 'missing-exterior'
          : undefined;
    if (rejected) {
      let reason = '';
      try {
        const prepared = await gpu.prepare(frame);
        prepared.destroy();
      } catch (error) {
        reason = String((error as Error).message);
      }
      check(reason === rejected, `expected ${rejected}, received ${reason}`);
      results[name] = { pass: true, reason };
      continue;
    }
    const prepared = await gpu.prepare(frame);
    try {
      const values = await prepared.readSdf();
      results[name] = compare(verifiedMask(frame), width, height, values);
      fieldPicture(`sdf-${name}`, width, height, values);
    } finally {
      prepared.destroy();
    }
  }
  return results;
}
async function captureFixture(gpu: GpuExperiment, id: string, dpr: number) {
  const start = performance.now();
  const frame = await captureElement(element(id), { dpr, paddingCss: 48 });
  const captureMs = performance.now() - start;
  let larger: CaptureFrame | undefined;
  let prepared: PreparedGpuFrame | undefined;
  try {
    larger = await captureElement(element(id), { dpr, paddingCss: 80 });
    picture(
      `capture-${id}-dpr${dpr}`,
      frame.width,
      frame.height,
      frame.pixels,
      id === 'target' ? 'capture' : undefined,
    );
    picture(`reference-${id}-dpr${dpr}`, larger.width, larger.height, larger.pixels);
    const offset = 32 * dpr;
    check(
      frame.pixels.length === frame.width * frame.height * 4,
      'capture rows must be tightly packed',
    );
    check(
      frame.width === Math.ceil((frame.contentBounds.width + 96) * dpr) &&
        frame.height === Math.ceil((frame.contentBounds.height + 96) * dpr) &&
        Object.values(frame.padding).every((padding) => padding === 48) &&
        frame.contentBounds.x === 0 &&
        frame.contentBounds.y === 0 &&
        frame.pixelToLocal.e === -48 &&
        frame.pixelToLocal.f === -48,
      'padded capture metadata mismatch',
    );
    let maxAlphaDifference = 0;
    let omittedPaintPixels = 0;
    for (let y = 0; y < larger.height; y++) {
      for (let x = 0; x < larger.width; x++) {
        const lx = x - offset;
        const ly = y - offset;
        const alpha = larger.pixels[(y * larger.width + x) * 4 + 3];
        if (lx >= 0 && ly >= 0 && lx < frame.width && ly < frame.height) {
          maxAlphaDifference = Math.max(
            maxAlphaDifference,
            Math.abs(alpha - frame.pixels[(ly * frame.width + lx) * 4 + 3]),
          );
        } else if (alpha) {
          omittedPaintPixels++;
        }
      }
    }
    const referenceBoundaryMaxAlpha = boundaryAlpha(larger);
    const capturedBoundaryMaxAlpha = boundaryAlpha(frame);
    const exterior20pxMaxAlpha = boundaryAlpha(frame, 20);
    check(
      omittedPaintPixels === 0 &&
        referenceBoundaryMaxAlpha === 0 &&
        capturedBoundaryMaxAlpha === 0 &&
        exterior20pxMaxAlpha === 0,
      `capture exterior failed for ${id}`,
    );
    check(
      maxAlphaDifference <= 1,
      `capture alignment failed for ${id}: alpha difference ${maxAlphaDifference}`,
    );
    const sentinels = verifyCapturePaint(id, frame);
    prepared = await gpu.prepare(frame);
    const values = await prepared.readSdf();
    const numerical = compare(verifiedMask(frame), frame.width, frame.height, values);
    const details = {
      dpr,
      dimensions: [frame.width, frame.height],
      captureMs,
      prepareMs: prepared.prepareMs,
      mapping: frame.pixelToLocal,
      contentBounds: frame.contentBounds,
      managedGpuBytes: prepared.managedBytes,
      cpuRgbaBytes: frame.pixels.byteLength,
      referenceBoundaryMaxAlpha,
      capturedBoundaryMaxAlpha,
      sentinels,
      exterior20pxMaxAlpha,
      maxAlphaDifference,
      omittedPaintPixels,
      numerical,
    };
    fieldPicture(
      `sdf-${id}-dpr${dpr}`,
      frame.width,
      frame.height,
      values,
      id === 'target' ? 'sdf' : undefined,
    );
    const maskPixels = new Uint8Array(frame.pixels.length);
    classifyAlpha(frame).forEach((value, i) =>
      maskPixels.set([value * 255, value * 255, value * 255, 255], i * 4),
    );
    picture(
      `mask-${id}-dpr${dpr}`,
      frame.width,
      frame.height,
      maskPixels,
      id === 'target' ? 'mask' : undefined,
    );
    prepared.render(1.5, 314, 0.85, 1 / frame.pixelToLocal.a);
    const fire = await prepared.readFire();
    firePicture(`fire-${id}-dpr${dpr}`, frame.width, frame.height, fire);
    check(
      fire.some((value, i) => i % 4 === 3 && value > 0),
      `empty fire for ${id}`,
    );
    return {
      frame,
      prepared,
      details: {
        ...details,
        padding: frame.padding,
        fire: { pass: true, time: 1.5, seed: 314, intensity: 0.85, hash: hash(fire) },
      },
    };
  } catch (error) {
    prepared?.destroy();
    frame.release();
    throw error;
  } finally {
    larger?.release();
  }
}
async function warmMeasurements(gpu: GpuExperiment) {
  const samples: Array<{ captureMs: number; prepareMs: number; totalMs: number }> = [];
  let peakAccountedBytes = 0;
  for (let i = 0; i < 33; i++) {
    const started = performance.now();
    const frame = await captureElement(element('target'), { dpr: 2, paddingCss: 48 });
    const captured = performance.now();
    const prepared = await gpu.prepare(frame);
    const completed = performance.now();
    peakAccountedBytes = Math.max(peakAccountedBytes, gpu.managedBytes + frame.pixels.byteLength);
    if (i >= 3) {
      samples.push({
        captureMs: captured - started,
        prepareMs: completed - captured,
        totalMs: completed - started,
      });
    }
    prepared.destroy();
    frame.release();
  }
  const sorted = samples.map((sample) => sample.totalMs).sort((a, b) => a - b);
  const p95 = sorted[Math.ceil(sorted.length * 0.95) - 1];
  return {
    method:
      'performance.now; fonts/image ready; 3 warmups + 30 rebuilds; upload/JFA await queue completion; excludes oracle, readback and fire',
    samples,
    p95Ms: p95,
    candidate300msPass: p95 <= 300,
    peakAccountedBytes,
    managedBytesAfterWarmFramesReleased: gpu.managedBytes,
    memoryMethod:
      'source 4 + JFA 28 + fire output 4 bytes/pixel; 16-byte fire uniform + 4-byte JFA offset uniform, both released with the prepared frame; CPU frame 4 bytes/pixel. Excludes browser/driver/cache overhead and canvas backing stores; not total VRAM.',
  };
}
async function verifyGsap(prepared: PreparedGpuFrame, pixelsPerCss: number) {
  const controls = { time: 0, intensity: 0.85 };
  const timeline = gsap.timeline({ paused: true });
  const sibling = gsap.to({ value: 0 }, { value: 1, duration: 4, paused: true });
  timeline.add(sibling, 0);
  sibling.paused(false);
  const context = gsap.context(() => {
    const child = gsap.to(controls, { time: 4, duration: 4, ease: 'none', paused: true });
    timeline.add(child, 0);
    child.paused(false);
    return () => {
      timeline.remove(child);
      child.kill();
    };
  });
  const captureTime = async (time: number) => {
    timeline.seek(time, false);
    check(
      Math.abs(controls.time - time) < 0.00001,
      'GSAP controls do not follow the host playhead',
    );
    prepared.render(controls.time, 314, controls.intensity, pixelsPerCss);
    return hash(await prepared.readFire());
  };
  try {
    const at1_5 = await captureTime(1.5);
    const at3 = await captureTime(3);
    timeline.reversed(true);
    const reverseTo1_5 = await captureTime(1.5);
    check(at1_5 === reverseTo1_5 && at1_5 !== at3, 'GSAP seek/reversed playhead frame mismatch');
    context.revert();
    check(timeline.getChildren().includes(sibling), 'context cleanup killed caller-owned sibling');
    timeline.seek(2, false);
    check(Math.abs(sibling.progress() - 0.5) < 0.00001, 'caller-owned sibling no longer advances');
    return { pass: true, at1_5, at3, reverseTo1_5, contextRevertPreservesSibling: true };
  } finally {
    context.revert();
    timeline.kill();
    sibling.kill();
  }
}
async function main() {
  try {
    report.environment = {
      userAgent: navigator.userAgent,
      viewport: [innerWidth, innerHeight],
      devicePixelRatio,
      visibility: document.visibilityState,
      reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
      build: import.meta.env.DEV ? 'Vite development' : 'Vite production',
    };
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      report.outcome = 'UNAVAILABLE: reduced-motion before capture/GPU allocation';
      status.textContent = 'Reduced motion is enabled. Original DOM is shown without an effect.';
      showReport();
      return;
    }
    await document.fonts.ready;
    await element<HTMLImageElement>('transparent').decode();
    const coldStart = performance.now();
    const gpu = (service = await GpuExperiment.create());
    report.serviceInitializationMs = performance.now() - coldStart;
    report.environment = {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      gpu: {
        vendor: gpu.adapterInfo.vendor,
        architecture: gpu.adapterInfo.architecture,
        device: gpu.adapterInfo.device,
        description: gpu.adapterInfo.description,
      },
      viewport: [innerWidth, innerHeight],
      devicePixelRatio,
      visibility: document.visibilityState,
      reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
      date: new Date().toISOString(),
      powerMode: 'unmeasured',
      refreshRate: 'unmeasured',
      build: import.meta.env.DEV ? 'Vite development' : 'Vite production',
    };
    report.numericalFixtures = await runNumericalFixtures(gpu);
    const fireShape = await verifyFireShape(gpu, Math.min(2, devicePixelRatio));
    report.fireShape = fireShape;
    check(fireShape.pass, 'rising fire shape failed');
    if (!functional) {
      status.textContent = 'Checking 1,000 GPU preparation/release cycles…';
      const preparationResources = await verifyPreparationResources();
      report.preparationResources = preparationResources;
      check(preparationResources.pass, 'repeated preparation resources failed');
    }
    report.captures = {};
    const captured: Record<string, unknown> = {};
    for (const id of ['rounded', 'vector', 'transparent', 'card', 'guard', 'transformed']) {
      status.textContent = `Checking ${id} capture and GPU distances…`;
      await sleepFrame();
      const { frame, prepared, details } = await captureFixture(gpu, id, devicePixelRatio);
      if (id === 'transformed') {
        report.transformCapture = details.sentinels;
      }
      captured[id] = details;
      report.captures = captured;
      prepared.destroy();
      frame.release();
    }
    status.textContent = 'Checking headline, GPU fire and deterministic seeking…';
    const hero = await captureFixture(gpu, 'target', Math.min(2, devicePixelRatio));
    live = hero.prepared;
    captured.target = hero.details;
    report.captures = captured;
    report.initialExperimentMs = performance.now() - coldStart;
    hero.prepared.render(1.5, 314, 0.85, 1 / hero.frame.pixelToLocal.a);
    const first = await hero.prepared.readFire();
    firePicture('fire-target-1-5', hero.frame.width, hero.frame.height, first, 'fire');
    hero.prepared.render(2.5, 314, 0.85, 1 / hero.frame.pixelToLocal.a);
    const changed = await hero.prepared.readFire();
    hero.prepared.render(1.5, 314, 0.85, 1 / hero.frame.pixelToLocal.a);
    const repeat = await hero.prepared.readFire();
    hero.prepared.render(1.5, 314, 0, 1 / hero.frame.pixelToLocal.a);
    const zero = await hero.prepared.readFire();
    check(
      first.every((value, i) => value === repeat[i]),
      'fixed time does not reproduce',
    );
    check(
      first.some((value, i) => value !== changed[i]),
      'fire does not animate',
    );
    check(
      zero.every((value) => value === 0),
      'zero intensity is not transparent',
    );
    report.fire = {
      pass: true,
      time1_5Hash: hash(first),
      time2_5Hash: hash(changed),
      seekBackHash: hash(repeat),
      zeroIntensityTransparent: true,
    };
    report.gsap = await verifyGsap(hero.prepared, 1 / hero.frame.pixelToLocal.a);
    if (!functional) {
      status.textContent = 'Measuring 30 warm capture → GPU SDF rebuilds…';
      await sleepFrame();
      report.warmMeasurements = await warmMeasurements(gpu);
    }
    report.gpuErrors = gpu.errors;
    check(gpu.errors.length === 0, 'uncaptured GPU validation errors');
    hero.frame.release();
    hero.prepared.destroy();
    live = undefined;
    gallery = createGallery(images, report, showReport);
    if (automation) {
      window.domfxGallery = gallery;
    }
    await gallery.ready;
    attachDemo(gallery.headline);
    await gallery.saveLiveEvidence();
    check(
      !automation || !new URLSearchParams(location.search).has('inject-failure'),
      'injected assertion failure',
    );
    report.outcome = 'PASS: capture, GPU signed distances and deterministic GPU fire';
    showReport();
    status.textContent = 'PASS · Capture, GPU distance fields, and deterministic fire verified.';
    element<HTMLButtonElement>('save').disabled = !import.meta.env.DEV;
  } catch (error) {
    stop();
    gallery?.dispose();
    live?.destroy();
    service?.destroy();
    report.outcome =
      error instanceof Error && ['no-webgpu', 'no-adapter'].includes(error.message)
        ? 'UNAVAILABLE: no GPU'
        : 'FAIL';
    report.error = error instanceof Error ? error.stack : String(error);
    status.textContent = `${report.outcome === 'UNAVAILABLE: no GPU' ? 'Effect unavailable' : 'Experiment failed'}: ${error instanceof Error ? error.message : String(error)}`;
    showReport();
    element<HTMLButtonElement>('save').disabled = !import.meta.env.DEV;
    console.error(error);
  }
}
function attachDemo(effect: EffectHandle) {
  const updateClock = () => {
    element('clock').textContent =
      `Manual clock · ${effect.time.toFixed(2)}s · seed ${effect.seed} · intensity ${effect.intensity}`;
  };
  const timeline = gsap.timeline({ paused: true, repeat: -1, onUpdate: updateClock });
  timeline.to(effect, { time: 5.5, duration: 4, ease: 'none' });
  effect.onDispose(() => {
    timeline.kill();
    for (const id of ['play', 'seek', 'reverse']) {
      element<HTMLButtonElement>(id).disabled = true;
    }
  });
  stop = () => {
    timeline.kill();
    gallery?.dispose();
    for (const id of ['play', 'seek', 'reverse', 'dispose']) {
      element<HTMLButtonElement>(id).disabled = true;
    }
  };
  for (const id of ['play', 'seek', 'reverse', 'dispose']) {
    element<HTMLButtonElement>(id).disabled = false;
  }
  element<HTMLButtonElement>('play').onclick = () => timeline.play();
  element<HTMLButtonElement>('seek').onclick = () => {
    timeline.pause(0);
    effect.time = 1.5;
    updateClock();
  };
  element<HTMLButtonElement>('reverse').onclick = () => timeline.reverse(timeline.time() || 4);
  element<HTMLButtonElement>('dispose').onclick = () => {
    stop();
    service?.destroy();
    report.disposal = {
      managedBytes: service?.managedBytes,
      attachmentReservedBytes: memoryFor(document).bytes,
      overlayRemoved: document.querySelectorAll('canvas[data-gallery-target]').length === 0,
    };
    showReport();
    status.textContent = 'Effects disposed. Original DOM remains usable.';
  };
  updateClock();
}
element<HTMLButtonElement>('save').onclick = async () => {
  try {
    await gallery?.saveLiveEvidence();
    const response = await fetch('/__evidence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ report, images }),
    });
    if (!response.ok) {
      throw new Error(await response.text());
    }
    const result = await response.json();
    status.textContent = `Evidence saved: ${result.directory}`;
  } catch (error) {
    status.textContent = `Evidence save failed: ${error}`;
  }
};
window.addEventListener(
  'pagehide',
  () => {
    stop();
    gallery?.dispose();
    service?.destroy();
  },
  { once: true },
);
import.meta.hot?.dispose(() => {
  stop();
  gallery?.dispose();
  service?.destroy();
});
void main();
