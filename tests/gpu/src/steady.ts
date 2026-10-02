import { captureElement } from '@domfx/browser';
import { GpuExperiment, type PreparedGpuFrame } from '@domfx/browser/experimental';

interface Trial {
  durationMs: number;
  rafMs: number[];
  cpuSubmitMs: number[];
  gpuMs: number[];
  timestampPairsNs: string[][];
  longTasks: Array<{ startTime: number; duration: number }>;
  renderedFrames: number[];
  active: boolean;
}

interface SteadyReport {
  outcome: 'running' | 'complete' | 'failed' | 'unavailable';
  targets: number;
  timestampQuery: boolean;
  longTaskObserver: boolean;
  environment: {
    userAgent: string;
    dpr: number;
    viewport: { width: number; height: number };
    visibility: DocumentVisibilityState;
    reducedMotion: boolean;
    gpu?: { vendor: string; architecture: string; device: string; description: string };
  };
  dimensions: Array<{ width: number; height: number }>;
  trials: Trial[];
  visibilityChanges: number;
  preparedCount: number;
  managedBytes: number;
  timingBufferBytes: number;
  managedBytesAfterCleanup?: number;
  error?: string;
}

declare global {
  interface Window {
    domfxSteady: SteadyReport;
  }
}

const targets = Number(new URLSearchParams(location.search).get('targets') ?? 1);
const report: SteadyReport = {
  outcome: 'running',
  targets,
  timestampQuery: false,
  longTaskObserver: PerformanceObserver.supportedEntryTypes.includes('longtask'),
  environment: {
    userAgent: navigator.userAgent,
    dpr: devicePixelRatio,
    viewport: { width: innerWidth, height: innerHeight },
    visibility: document.visibilityState,
    reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
  },
  dimensions: [],
  trials: [],
  visibilityChanges: 0,
  preparedCount: 0,
  managedBytes: 0,
  timingBufferBytes: 0,
};
window.domfxSteady = report;

async function measure() {
  let gpu: GpuExperiment | undefined;
  const layers: HTMLCanvasElement[] = [];
  const visibility = () => {
    report.visibilityChanges += 1;
  };
  document.addEventListener('visibilitychange', visibility);
  try {
    if (![0, 1, 2].includes(targets)) {
      throw new Error('invalid target count');
    }
    const headline = document.querySelector<HTMLElement>('#headline');
    const raster = document.querySelector<HTMLImageElement>('#raster');
    const host = document.querySelector<HTMLElement>('#host');
    if (!headline || !raster || !host) {
      throw new Error('missing fixture');
    }
    raster.src = '/examples/silver-ring.png';
    const [fonts] = await Promise.all([
      document.fonts.load('40px Measurement', 'A'),
      raster.decode(),
    ]);
    await document.fonts.ready;
    if (!fonts.length) {
      throw new Error('font unavailable');
    }
    gpu = await GpuExperiment.create(navigator.gpu ?? null, true);
    const service = gpu;
    const { vendor, architecture, device, description } = service.adapterInfo;
    report.environment.gpu = { vendor, architecture, device, description };
    report.timestampQuery = service.device.features.has('timestamp-query');
    const elements = [headline, raster];
    const frames: PreparedGpuFrame[] = [];
    const contexts: GPUCanvasContext[] = [];
    for (const target of elements.slice(0, targets)) {
      const capture = await captureElement(target, { dpr: devicePixelRatio, paddingCss: 32 });
      try {
        const frame = await service.prepare(capture);
        frames.push(frame);
        report.preparedCount += 1;
        report.dimensions.push({ width: frame.width, height: frame.height });
        const layer = document.createElement('canvas');
        layers.push(layer);
        layer.width = frame.width;
        layer.height = frame.height;
        const rect = target.getBoundingClientRect();
        const hostRect = host.getBoundingClientRect();
        layer.style.cssText = `position:absolute;pointer-events:none;left:${rect.left - hostRect.left - 32}px;top:${rect.top - hostRect.top - 32}px;width:${frame.width / devicePixelRatio}px;height:${frame.height / devicePixelRatio}px`;
        layer.setAttribute('aria-hidden', 'true');
        host.append(layer);
        const context = layer.getContext('webgpu');
        if (!context) {
          throw new Error('no canvas context');
        }
        context.configure({
          device: service.device,
          format: 'rgba8unorm',
          alphaMode: 'premultiplied',
          usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
        });
        contexts.push(context);
      } finally {
        capture.release();
      }
    }
    report.managedBytes = service.managedBytes;
    const active = () =>
      document.visibilityState === 'visible' &&
      !report.visibilityChanges &&
      !matchMedia('(prefers-reduced-motion: reduce)').matches &&
      elements.every((target) => {
        const rect = target.getBoundingClientRect();
        return (
          rect.left >= 32 &&
          rect.top >= 32 &&
          rect.right + 32 <= innerWidth &&
          rect.bottom + 32 <= innerHeight
        );
      });
    const render = (time: number, querySet?: GPUQuerySet, offset = 0) => {
      frames.forEach((frame, i) => {
        frame.render(
          time,
          7,
          1,
          devicePixelRatio,
          querySet
            ? {
                querySet,
                beginningOfPassWriteIndex: offset + i * 2,
                endOfPassWriteIndex: offset + i * 2 + 1,
              }
            : undefined,
        );
        frame.present(contexts[i]!.getCurrentTexture());
      });
    };
    const nextFrame = () => new Promise<number>((resolve) => requestAnimationFrame(resolve));
    // Warm pipelines/presentation for one second; no warmup sample enters a trial.
    const warmStart = await nextFrame();
    let now = warmStart;
    while (now - warmStart < 1000) {
      render((now - warmStart) / 1000);
      now = await nextFrame();
    }
    await service.device.queue.onSubmittedWorkDone();
    for (let trialIndex = 0; trialIndex < 5; trialIndex++) {
      // Enough slots for 1024 two-target frames; overflow fails, never drops slow samples.
      const queryCount = 4096;
      const querySet =
        report.timestampQuery && targets
          ? service.device.createQuerySet({ type: 'timestamp', count: queryCount })
          : undefined;
      const resolveBuffer = querySet
        ? service.device.createBuffer({
            size: queryCount * 8,
            usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC,
          })
        : undefined;
      const readBuffer = querySet
        ? service.device.createBuffer({
            size: queryCount * 8,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
          })
        : undefined;
      report.timingBufferBytes = querySet ? queryCount * 16 : 0;
      const trial: Trial = {
        durationMs: 0,
        rafMs: [],
        cpuSubmitMs: [],
        gpuMs: [],
        timestampPairsNs: [],
        longTasks: [],
        renderedFrames: frames.map(() => 0),
        active: active(),
      };
      report.trials.push(trial);
      const longTasks: PerformanceEntry[] = [];
      const observer = report.longTaskObserver
        ? new PerformanceObserver((list) => longTasks.push(...list.getEntries()))
        : undefined;
      observer?.observe({ type: 'longtask' });
      try {
        const start = await nextFrame();
        let previous = start;
        let count = 0;
        render(0);
        while (true) {
          const time = await nextFrame();
          trial.rafMs.push(time - previous);
          previous = time;
          trial.active &&= active();
          if (time - start >= 2000) {
            break;
          }
          const offset = count * targets * 2;
          if (querySet && offset + targets * 2 > queryCount) {
            throw new Error('timestamp capacity exceeded');
          }
          const cpuStart = performance.now();
          render((time - start) / 1000, querySet, offset);
          trial.cpuSubmitMs.push(performance.now() - cpuStart);
          trial.renderedFrames = trial.renderedFrames.map((value) => value + 1);
          count += 1;
        }
        trial.durationMs = previous - start;
        // Resolve/map once after the trial: never serialize animation on a readback.
        if (querySet && resolveBuffer && readBuffer && count) {
          const encoder = service.device.createCommandEncoder();
          const used = count * targets * 2;
          encoder.resolveQuerySet(querySet, 0, used, resolveBuffer, 0);
          encoder.copyBufferToBuffer(resolveBuffer, 0, readBuffer, 0, used * 8);
          service.device.queue.submit([encoder.finish()]);
          await readBuffer.mapAsync(GPUMapMode.READ);
          const stamps = new BigUint64Array(readBuffer.getMappedRange());
          for (let frame = 0; frame < count; frame++) {
            let sum = 0;
            for (let target = 0; target < targets; target++) {
              const index = (frame * targets + target) * 2;
              const begin = stamps[index]!;
              const end = stamps[index + 1]!;
              if (begin === 0n || end < begin) {
                throw new Error('invalid GPU timestamp');
              }
              trial.timestampPairsNs.push([begin.toString(), end.toString()]);
              sum += Number(end - begin) / 1e6;
            }
            trial.gpuMs.push(sum);
          }
          readBuffer.unmap();
        }
        await service.device.queue.onSubmittedWorkDone();
        // Allow the long-task observer to deliver entries for the final animation task.
        await new Promise((resolve) => setTimeout(resolve, 0));
        longTasks.push(...(observer?.takeRecords() ?? []));
        trial.longTasks = longTasks
          .filter((entry) => entry.startTime < previous && entry.startTime + entry.duration > start)
          .map(({ startTime, duration }) => ({ startTime, duration }));
      } finally {
        observer?.disconnect();
        querySet?.destroy();
        resolveBuffer?.destroy();
        readBuffer?.destroy();
      }
    }
    if (service.errors.length) {
      throw new Error(service.errors.join('; '));
    }
    if (!active() || report.trials.some((trial) => !trial.active)) {
      throw new Error('measurement not continuously active and visible');
    }
    report.outcome = 'complete';
  } catch (error) {
    report.error = error instanceof Error ? error.message : String(error);
    report.outcome = ['no-webgpu', 'no-adapter'].includes(report.error) ? 'unavailable' : 'failed';
  } finally {
    gpu?.destroy();
    report.managedBytesAfterCleanup = gpu?.managedBytes ?? 0;
    layers.forEach((layer) => {
      layer.getContext('webgpu')?.unconfigure();
      layer.remove();
    });
    document.removeEventListener('visibilitychange', visibility);
    document.querySelector('#result')!.textContent = JSON.stringify(report, null, 2);
  }
}

void measure();
