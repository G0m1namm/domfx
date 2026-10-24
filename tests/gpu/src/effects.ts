import { attachFire, attachFrost, captureElement } from '@domfx/browser';
import { GpuExperiment, startEffectDiagnostics } from '@domfx/browser/experimental';

import { effects } from './effect-selection.js';
import { qualifyRelativeCapture, qualifyRelativeCatalog } from './relative-qualification.js';

async function renderEffects(targetId: string, dpr: number) {
  await document.fonts.ready;
  await document.querySelector<HTMLImageElement>('#image')!.decode();
  const started = performance.now();
  const gpu = await GpuExperiment.create();
  const cleanup = { managedBytes: -1 };
  const initializationMs = performance.now() - started;
  const frame = await captureElement(document.getElementById(targetId)!, { dpr, paddingCss: 32 });
  try {
    const prepared = await gpu.prepare(frame);
    try {
      const samples: { effect: string; time: number; intensity: number; pixels: string }[] = [];
      for (const effect of effects) {
        for (const [time, intensity] of [
          [2.4, 0.7],
          [1.1, 1],
          [2.4, 0.7],
        ]) {
          prepared.render(time, 314, intensity, dpr, undefined, 24, effect);
          samples.push({
            effect,
            time,
            intensity,
            pixels: btoa(
              Array.from(await prepared.readFire(), (value) => String.fromCharCode(value)).join(''),
            ),
          });
        }
      }
      return {
        cleanup,
        width: frame.width,
        height: frame.height,
        initializationMs,
        environment: { userAgent: navigator.userAgent, gpu: gpu.adapterInfo.description, dpr },
        errors: [...gpu.errors],
        samples,
      };
    } finally {
      prepared.destroy();
    }
  } finally {
    frame.release();
    gpu.destroy();
    cleanup.managedBytes = gpu.managedBytes;
  }
}

declare global {
  interface Window {
    renderEffects: typeof renderEffects;
    qualifyRelativeCapture: typeof qualifyRelativeCapture;
    qualifyRelativeCatalog: typeof qualifyRelativeCatalog;
  }
}
window.renderEffects = renderEffects;
window.qualifyRelativeCapture = qualifyRelativeCapture;
window.qualifyRelativeCatalog = qualifyRelativeCatalog;

async function traceEffects() {
  document.body.style.position = 'relative';
  const session = startEffectDiagnostics({ userTiming: true, capacity: 64 });
  const fire = attachFire(document.getElementById('text')!, { host: document.body });
  const frost = attachFrost(document.getElementById('svg')!, { host: document.body });
  try {
    await Promise.all([fire.ready, frost.ready]);
    await fire.refresh();
    return { records: session.records, lifecycle: [fire.lifecycle, frost.lifecycle] };
  } finally {
    fire.dispose();
    frost.dispose();
    session.dispose();
  }
}

declare global {
  interface Window {
    traceEffects: typeof traceEffects;
  }
}
window.traceEffects = traceEffects;
