import { gsap } from 'gsap';

import { captureElement } from '@domfx/browser';
import { GpuExperiment, type PreparedGpuFrame } from '@domfx/browser/experimental';
import { classifyAlpha, type CaptureFrame } from '@domfx/core';

import { exactDistanceField } from './diagnostics/distance-oracle.js';
import './style.css';

const element = <T extends Element = HTMLElement>(id: string) =>
  document.getElementById(id)! as unknown as T;
const status = element('status');
const images: Record<string, string> = {};
const report: Record<string, unknown> = {};
let roundedClicks = 0;
element<HTMLButtonElement>('rounded').onclick = () => {
  element('interaction').textContent = `Rounded button clicks: ${++roundedClicks}`;
};
let service: GpuExperiment | undefined;
let live: PreparedGpuFrame | undefined;
let stop = () => {};
const sleepFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

function showReport() {
  element('report').textContent = JSON.stringify(report, null, 2);
}
function check(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}
function hash(bytes: Uint8Array): string {
  let value = 2166136261;
  for (const byte of bytes) value = Math.imul(value ^ byte, 16777619);
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
  for (let i = 0; i < straight.length; i += 4)
    if (straight[i + 3]) {
      for (let c = 0; c < 3; c++)
        straight[i + c] = Math.min(255, Math.round((straight[i + c] * 255) / straight[i + 3]));
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
    const inside = values[i] < 0,
      band = 0.6 + 0.4 * Math.cos(values[i] * 0.6);
    bytes.set(inside ? [20, 90 * band, 255, 255] : [255, 130 * band, 50 * band, 255], i * 4);
  }
  picture(name, width, height, bytes, visible);
}
function compare(mask: Uint8Array, width: number, height: number, gpu: Float32Array) {
  const truth = exactDistanceField(mask, width, height);
  let maxError = 0,
    squaredError = 0,
    wrongSigns = 0,
    maxContourError = 0,
    crossings = 0;
  for (let i = 0; i < gpu.length; i++) {
    const error = Math.abs(gpu[i] - truth[i]);
    check(Number.isFinite(error), `nonfinite distance at ${i}`);
    maxError = Math.max(maxError, error);
    squaredError += error * error;
    if (gpu[i] < 0 !== Boolean(mask[i])) wrongSigns++;
    for (const j of [i % width < width - 1 ? i + 1 : -1, i + width < gpu.length ? i + width : -1]) {
      if (j < 0 || mask[i] === mask[j]) continue;
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
function boundaryAlpha(frame: CaptureFrame, marginCss = 0): number {
  const mx = Math.max(1, Math.ceil(marginCss / frame.pixelToLocal.a));
  const my = Math.max(1, Math.ceil(marginCss / frame.pixelToLocal.d));
  let max = 0;
  for (let y = 0; y < frame.height; y++)
    for (let x = 0; x < frame.width; x++) {
      if (x < mx || x >= frame.width - mx || y < my || y >= frame.height - my)
        max = Math.max(max, frame.pixels[(y * frame.width + x) * 4 + 3]);
    }
  return max;
}
function alphaAt(frame: CaptureFrame, localX: number, localY: number) {
  const x = Math.floor((localX - frame.pixelToLocal.e) / frame.pixelToLocal.a),
    y = Math.floor((localY - frame.pixelToLocal.f) / frame.pixelToLocal.d);
  return Array.from(
    frame.pixels.subarray((y * frame.width + x) * 4, (y * frame.width + x) * 4 + 4),
  );
}
function createRaster() {
  const canvas = document.createElement('canvas');
  canvas.width = 96;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#efc878';
  ctx.beginPath();
  ctx.arc(32, 32, 27, 0, Math.PI * 2);
  ctx.arc(32, 32, 13, 0, Math.PI * 2, true);
  ctx.fill();
  ctx.fillStyle = '#7bd7ff';
  ctx.fillRect(75, 12, 14, 40);
  element<HTMLImageElement>('transparent').src = canvas.toDataURL();
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
    const width = 47,
      height = 39,
      pixels = new Uint8Array(width * height * 4);
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const radius = Math.hypot(x - 23, y - 19);
        let alpha = 0;
        if (name === 'ring') alpha = radius <= 15 && radius >= 7 ? 255 : 0;
        if (name === 'islands')
          alpha = Math.hypot(x - 12, y - 12) < 7 || Math.hypot(x - 35, y - 26) < 5 ? 255 : 0;
        if (name === 'diagonal')
          alpha = Math.round(Math.max(0, 1 - Math.abs(y - x * 0.61 - 5) / 2) * 255);
        if (name === 'semitransparent')
          alpha = x > 8 && x < 38 && y > 8 && y < 30 ? (x < 15 ? 127 : x < 23 ? 128 : 192) : 0;
        if (name === 'opaque-exterior') alpha = x > 5 && x < 41 && y > 5 && y < 33 ? 255 : 0;
        if (name === 'full-without-exterior') alpha = 255;
        pixels.set([200, 120, 60, alpha], (y * width + x) * 4);
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
      results[name] = compare(classifyAlpha(frame), width, height, values);
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
  const larger = await captureElement(element(id), { dpr, paddingCss: 80 });
  const offset = 32 * dpr;
  let maxAlphaDifference = 0,
    omittedPaintPixels = 0;
  for (let y = 0; y < larger.height; y++)
    for (let x = 0; x < larger.width; x++) {
      const lx = x - offset,
        ly = y - offset,
        alpha = larger.pixels[(y * larger.width + x) * 4 + 3];
      if (lx >= 0 && ly >= 0 && lx < frame.width && ly < frame.height) {
        maxAlphaDifference = Math.max(
          maxAlphaDifference,
          Math.abs(alpha - frame.pixels[(ly * frame.width + lx) * 4 + 3]),
        );
      } else if (alpha) omittedPaintPixels++;
    }
  const capturedBoundaryMaxAlpha = boundaryAlpha(frame);
  const exterior20pxMaxAlpha = boundaryAlpha(frame, 20);
  check(
    omittedPaintPixels === 0 && capturedBoundaryMaxAlpha === 0 && exterior20pxMaxAlpha === 0,
    `capture exterior failed for ${id}`,
  );
  check(
    maxAlphaDifference <= 1,
    `capture alignment failed for ${id}: alpha difference ${maxAlphaDifference}`,
  );
  larger.release();
  const prepared = await gpu.prepare(frame);
  const values = await prepared.readSdf();
  const numerical = compare(classifyAlpha(frame), frame.width, frame.height, values);
  const details = {
    dpr,
    dimensions: [frame.width, frame.height],
    captureMs,
    prepareMs: prepared.prepareMs,
    mapping: frame.pixelToLocal,
    contentBounds: frame.contentBounds,
    managedGpuBytes: prepared.managedBytes,
    cpuRgbaBytes: frame.pixels.byteLength,
    capturedBoundaryMaxAlpha,
    exterior20pxMaxAlpha,
    maxAlphaDifference,
    omittedPaintPixels,
    numerical,
  };
  picture(
    `capture-${id}-dpr${dpr}`,
    frame.width,
    frame.height,
    frame.pixels,
    id === 'target' ? 'capture' : undefined,
  );
  fieldPicture(
    `sdf-${id}-dpr${dpr}`,
    frame.width,
    frame.height,
    values,
    id === 'target' ? 'sdf' : undefined,
  );
  if (id === 'target') {
    const maskPixels = new Uint8Array(frame.pixels.length);
    classifyAlpha(frame).forEach((value, i) =>
      maskPixels.set([value * 255, value * 255, value * 255, 255], i * 4),
    );
    picture('mask-target', frame.width, frame.height, maskPixels, 'mask');
  }
  return { frame, prepared, details };
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
    if (i >= 3)
      samples.push({
        captureMs: captured - started,
        prepareMs: completed - captured,
        totalMs: completed - started,
      });
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
      'source 4 + JFA 28 + fire output 4 bytes/pixel; 16-byte fire uniform; 16-byte JFA offset uniform retained per prepare until service disposal; CPU frame 4 bytes/pixel. Excludes browser/driver/cache overhead and canvas backing stores.',
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
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      report.outcome = 'UNAVAILABLE: reduced-motion before capture/GPU allocation';
      status.textContent = 'Reduced motion is enabled. Original DOM is shown without an effect.';
      showReport();
      return;
    }
    createRaster();
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
      date: new Date().toISOString(),
      powerMode: 'unmeasured',
      refreshRate: 'unmeasured',
      build: import.meta.env.DEV ? 'Vite development' : 'Vite production',
      versions: {
        snapdom: '2.24.15',
        typegpu: '0.12.4',
        sdf: '0.12.0',
        typegpuPlugin: '0.12.3',
        gsap: '3.15.0',
        vite: '7.3.6',
      },
    };
    report.numericalFixtures = await runNumericalFixtures(gpu);
    report.captures = {};
    const captured: Record<string, unknown> = {};
    for (const id of ['rounded', 'vector', 'transparent', 'card', 'guard', 'transformed']) {
      status.textContent = `Checking ${id} capture and GPU distances…`;
      await sleepFrame();
      const { frame, prepared, details } = await captureFixture(gpu, id, 1);
      if (id === 'guard') {
        const overflow = alphaAt(frame, -15, 15),
          background = alphaAt(frame, 30, 20),
          shadow = alphaAt(frame, 76, 22);
        check(
          overflow[1] > 240 && overflow[2] > 240 && overflow[3] === 255,
          'overflow sentinel missing',
        );
        check(background[3] === 0, 'ancestor background was captured');
        check(shadow[3] > 0, 'root shadow missing');
        report.captureGuard = { overflow, transparentInterior: background, rootShadow: shadow };
      }
      if (id === 'transformed') {
        const origin = alphaAt(frame, 4, 4),
          corner = alphaAt(frame, 76, 44),
          gap = alphaAt(frame, 12, 12);
        check(
          origin[0] === 255 &&
            origin[3] === 255 &&
            corner[2] === 255 &&
            corner[3] === 255 &&
            gap[3] === 0,
          'target scale was baked into capture',
        );
        report.transformCapture = { origin, corner, gap, pass: true };
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
    status.textContent = 'Measuring 30 warm capture → GPU SDF rebuilds…';
    await sleepFrame();
    report.warmMeasurements = await warmMeasurements(gpu);
    report.gpuErrors = gpu.errors;
    check(gpu.errors.length === 0, 'uncaptured GPU validation errors');
    attachDemo(hero.frame, hero.prepared);
    hero.frame.release();
    report.outcome = 'PASS: capture, GPU signed distances and deterministic GPU fire';
    showReport();
    status.textContent = 'Spike passed: real capture → verified GPU SDF → deterministic GPU fire.';
    element<HTMLButtonElement>('save').disabled = !import.meta.env.DEV;
  } catch (error) {
    stop();
    live?.destroy();
    service?.destroy();
    report.outcome = 'FAIL';
    report.error = error instanceof Error ? error.stack : String(error);
    status.textContent = `Experiment failed: ${error instanceof Error ? error.message : String(error)}`;
    showReport();
    element<HTMLButtonElement>('save').disabled = !import.meta.env.DEV;
    console.error(error);
  }
}
function attachDemo(frame: CaptureFrame, prepared: PreparedGpuFrame) {
  const host = element('host'),
    target = element('target');
  const canvas = document.createElement('canvas');
  canvas.width = frame.width;
  canvas.height = frame.height;
  canvas.className = 'effect';
  canvas.setAttribute('aria-hidden', 'true');
  const context = canvas.getContext('webgpu')!;
  context.configure({
    device: service!.device,
    format: 'rgba8unorm',
    alphaMode: 'premultiplied',
    usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
  });
  host.append(canvas);
  const params = { time: 1.5, intensity: 0.85 },
    reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let dirty = true,
    raf = 0,
    disposed = false;
  const controls = {
    get time() {
      return params.time;
    },
    set time(value: number) {
      params.time = value;
      dirty = true;
    },
    get intensity() {
      return params.intensity;
    },
    set intensity(value: number) {
      params.intensity = value;
      dirty = true;
    },
  };
  const timeline = gsap.timeline({ paused: true, repeat: -1 });
  const sibling = gsap.to({ value: 0 }, { value: 1, duration: 4, paused: true });
  timeline.add(sibling, 0);
  sibling.paused(false);
  const child = gsap.to(controls, { time: 5.5, duration: 4, ease: 'none', paused: true });
  timeline.add(child, 0);
  child.paused(false);
  const tick = () => {
    if (disposed) return;
    const targetRect = target.getBoundingClientRect(),
      hostRect = host.getBoundingClientRect();
    const sx = targetRect.width / frame.contentBounds.width,
      sy = targetRect.height / frame.contentBounds.height;
    canvas.style.left = `${targetRect.left - hostRect.left - host.clientLeft + host.scrollLeft + frame.pixelToLocal.e * sx}px`;
    canvas.style.top = `${targetRect.top - hostRect.top - host.clientTop + host.scrollTop + frame.pixelToLocal.f * sy}px`;
    canvas.style.width = `${frame.width * frame.pixelToLocal.a * sx}px`;
    canvas.style.height = `${frame.height * frame.pixelToLocal.d * sy}px`;
    if (dirty) {
      prepared.render(reduced ? 0 : params.time, 314, params.intensity, 1 / frame.pixelToLocal.a);
      prepared.present(context.getCurrentTexture());
      dirty = false;
      element('clock').textContent =
        `Manual clock · ${params.time.toFixed(2)}s · seed 314 · intensity ${params.intensity}`;
    }
    raf = requestAnimationFrame(tick);
  };
  stop = () => {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(raf);
    timeline.remove(child);
    child.kill();
    // This demo owns its host timeline; a reusable adapter must never kill a caller's.
    timeline.kill();
    sibling.kill();
    context.unconfigure();
    canvas.remove();
    prepared.destroy();
    for (const id of ['play', 'seek', 'reverse', 'dispose'])
      element<HTMLButtonElement>(id).disabled = true;
  };
  for (const id of ['play', 'seek', 'reverse', 'dispose'])
    element<HTMLButtonElement>(id).disabled = false;
  element<HTMLButtonElement>('play').onclick = () => {
    if (!reduced) timeline.play();
  };
  element<HTMLButtonElement>('seek').onclick = () => {
    timeline.pause(0);
    controls.time = 1.5;
  };
  element<HTMLButtonElement>('reverse').onclick = () => {
    if (!reduced) timeline.reverse(timeline.time() || 4);
  };
  element<HTMLButtonElement>('dispose').onclick = () => {
    stop();
    service?.destroy();
    report.disposal = { managedBytes: service?.managedBytes, overlayRemoved: !canvas.isConnected };
    showReport();
    status.textContent = 'Effect disposed. Original DOM remains usable.';
  };
  tick();
}
element<HTMLButtonElement>('save').onclick = async () => {
  try {
    const response = await fetch('/__evidence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ report, images }),
    });
    if (!response.ok) throw new Error(await response.text());
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
    service?.destroy();
  },
  { once: true },
);
import.meta.hot?.dispose(() => {
  stop();
  service?.destroy();
});
void main();
