import type { GpuExperiment, PreparedGpuFrame } from '@domfx/browser/experimental';

import { measurementEffect } from './effect-selection.js';

interface RebuildSample {
  totalMs: number;
  targets: Array<{
    id: string;
    width: number;
    height: number;
    captureMs: number;
    prepareMs: number;
  }>;
}

interface MeasurementReport {
  effect?: string;
  outcome: 'running' | 'complete' | 'unavailable' | 'failed';
  condition: 'one-target' | 'two-targets';
  environment: {
    userAgent: string;
    viewport: { width: number; height: number };
    dpr: number;
    visibility: DocumentVisibilityState;
    reducedMotion: boolean;
    gpu?: { vendor: string; architecture: string; device: string; description: string };
  };
  assets?: {
    fontMs: number;
    imageMs: number;
    readyMs: number;
    navigationToReadyMs: number;
    urls: string[];
  };
  firstRender?: { cpuSubmitMs: number; queueCompleteMs: number };
  initialization?: {
    totalMs: number;
    importMs: number;
    serviceMs: number;
    firstRebuild: RebuildSample;
    navigationToSdfMs: number;
  };
  warmups: RebuildSample[];
  rebuilds: RebuildSample[];
  checks: { sdfReadbacks: number; managedBytesAfterCleanup?: number };
  error?: string;
}

declare global {
  interface Window {
    domfxPerformance: MeasurementReport;
  }
}

const query = new URLSearchParams(location.search);
const twoTargets = query.get('targets') === '2';
const report: MeasurementReport = {
  outcome: 'running',
  condition: twoTargets ? 'two-targets' : 'one-target',
  environment: {
    userAgent: navigator.userAgent,
    viewport: { width: innerWidth, height: innerHeight },
    dpr: devicePixelRatio,
    visibility: document.visibilityState,
    reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
  },
  warmups: [],
  rebuilds: [],
  checks: { sdfReadbacks: 0 },
};
window.domfxPerformance = report;

async function measure() {
  let gpu: GpuExperiment | undefined;
  let visibilityChanged = false;
  const visibility = () => {
    visibilityChanged = true;
  };
  document.addEventListener('visibilitychange', visibility);
  try {
    const headline = document.querySelector<HTMLElement>('#headline');
    const raster = document.querySelector<HTMLImageElement>('#raster');
    if (!headline || !raster) {
      throw new Error('missing measurement targets');
    }
    const effect = measurementEffect();
    report.effect = effect;
    const targets = twoTargets ? [headline, raster] : [headline];
    raster.hidden = !twoTargets;
    const assetsStarted = performance.now();
    const fontReady = document.fonts.load('40px Measurement', 'A').then(async (faces) => {
      await document.fonts.ready;
      if (!faces.length) {
        throw new Error('measurement font unavailable');
      }
      return performance.now() - assetsStarted;
    });
    const imageReady = twoTargets
      ? (async () => {
          raster.src = '/examples/silver-ring.png';
          await raster.decode();
          return performance.now() - assetsStarted;
        })()
      : Promise.resolve(0);
    const [fontMs, imageMs] = await Promise.all([fontReady, imageReady]);
    report.assets = {
      fontMs,
      imageMs,
      readyMs: performance.now() - assetsStarted,
      navigationToReadyMs: performance.now(),
      urls: ['/asset-fixtures/block.ttf', ...(twoTargets ? ['/examples/silver-ring.png'] : [])],
    };
    // No runtime library import or GPU request occurs before this boundary.
    const started = performance.now();
    const [{ captureElement }, { GpuExperiment }] = await Promise.all([
      import('@domfx/browser'),
      import('@domfx/browser/experimental'),
    ]);
    const imported = performance.now();
    gpu = await GpuExperiment.create();
    const initialized = performance.now();
    const { vendor, architecture, device, description } = gpu.adapterInfo;
    report.environment.gpu = {
      vendor: vendor || 'unknown',
      architecture: architecture || 'unknown',
      device: device || 'unknown',
      description: description || 'unknown',
    };
    const service = gpu;
    const retained: PreparedGpuFrame[] = [];
    const release = () => {
      for (const frame of retained.splice(0)) {
        frame.destroy();
      }
    };
    async function rebuild(): Promise<RebuildSample> {
      const started = performance.now();
      const samples: RebuildSample['targets'] = [];
      for (const target of targets) {
        const capturing = performance.now();
        const frame = await captureElement(target, { dpr: devicePixelRatio, paddingCss: 32 });
        const captured = performance.now();
        try {
          const prepared = await service.prepare(frame);
          retained.push(prepared);
          // prepare already waits for JFA; explicitly retain the completion boundary here.
          await service.device.queue.onSubmittedWorkDone();
          samples.push({
            id: target.id,
            width: frame.width,
            height: frame.height,
            captureMs: captured - capturing,
            prepareMs: performance.now() - captured,
          });
        } finally {
          frame.release();
        }
      }
      return { totalMs: performance.now() - started, targets: samples };
    }
    async function checkSdf() {
      // Diagnostic GPU readback is outside every timed interval.
      for (const frame of retained) {
        const sdf = await frame.readSdf();
        if (
          sdf.length !== frame.width * frame.height ||
          !sdf.every(Number.isFinite) ||
          !sdf.some((value) => value < 0) ||
          !sdf.some((value) => value > 0)
        ) {
          throw new Error('invalid measured SDF');
        }
        report.checks.sdfReadbacks += 1;
      }
    }
    try {
      const firstRebuild = await rebuild();
      report.initialization = {
        totalMs: performance.now() - started,
        importMs: imported - started,
        serviceMs: initialized - imported,
        firstRebuild,
        navigationToSdfMs: performance.now(),
      };
      const firstUse = performance.now();
      for (const frame of retained) {
        frame.render(2.4, 314, 0.7, devicePixelRatio, undefined, 24, effect);
      }
      const submitted = performance.now();
      await service.device.queue.onSubmittedWorkDone();
      report.firstRender = {
        cpuSubmitMs: submitted - firstUse,
        queueCompleteMs: performance.now() - firstUse,
      };
      await checkSdf();
      release();
      if (query.has('warm')) {
        for (let i = 0; i < 33; i++) {
          const sample = await rebuild();
          (i < 3 ? report.warmups : report.rebuilds).push(sample);
          if (i === 32) {
            await checkSdf();
          }
          release();
        }
      }
      if (service.errors.length) {
        throw new Error(service.errors.join('; '));
      }
      if (visibilityChanged || document.visibilityState !== 'visible') {
        throw new Error('measurement page did not remain visible');
      }
      report.outcome = 'complete';
    } finally {
      release();
    }
  } catch (error) {
    report.error = error instanceof Error ? error.message : String(error);
    report.outcome = ['no-webgpu', 'no-adapter'].includes(report.error) ? 'unavailable' : 'failed';
  } finally {
    gpu?.destroy();
    report.checks.managedBytesAfterCleanup = gpu?.managedBytes ?? 0;
    document.removeEventListener('visibilitychange', visibility);
    const output = document.querySelector('#result');
    if (output) {
      output.textContent = JSON.stringify(report, null, 2);
    }
  }
}

void measure();
