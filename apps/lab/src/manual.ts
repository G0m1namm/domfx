import { attachFire, type EffectHandle } from '@domfx/browser';

import { verifyFailureClassification } from './failure-checks.js';
import { verifyMemory } from './memory-checks.js';
import { createMotionFixture } from './motion-fixture.js';
import { createPlacementFixture } from './placement-fixture.js';
import { verifyRefresh } from './refresh-checks.js';
import { verifyRetryConditions } from './retry-checks.js';
import {
  verifyDocumentIsolation,
  verifySharedDeviceLoss,
  verifySharedInitialization,
  verifySharedTargets,
} from './shared-service-checks.js';

const host = document.querySelector<HTMLElement>('#manual-host');
const target = document.querySelector<HTMLButtonElement>('#manual-target');
const state = document.querySelector<HTMLElement>('#state');
if (!host || !target || !state) {
  throw new Error('missing-manual-fixture');
}
const effect = attachFire(target, { host, seed: 314, time: 1.5, intensity: 0.85 });
function report() {
  const summary = document.querySelector<HTMLElement>('#effect-summary');
  if (summary) {
    const label = `${effect.lifecycle} · ${effect.raster}${effect.reason ? ` · ${effect.reason}` : ''}`;
    if (summary.textContent !== label) {
      summary.textContent = label;
    }
    summary.dataset.tone = effect.lifecycle === 'unavailable' ? 'unavailable' : 'pending';
  }
  if (state) {
    state.textContent = JSON.stringify({
      lifecycle: effect.lifecycle,
      raster: effect.raster,
      reason: effect.reason,
      time: effect.time,
      intensity: effect.intensity,
      seed: effect.seed,
    });
  }
}
async function capture(time: number, intensity: number) {
  effect.time = time;
  effect.intensity = intensity;
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  report();
  return host?.querySelector('canvas')?.toDataURL() ?? '';
}
// Lab-only access to the public consumer API, with no renderer or capture internals.
declare global {
  interface Window {
    manual: {
      effect: EffectHandle;
      createPlacementFixture: typeof createPlacementFixture;
      placementFixture?: Awaited<ReturnType<typeof createPlacementFixture>>;
      createMotionFixture: typeof createMotionFixture;
      motionFixture?: ReturnType<typeof createMotionFixture>;
      attach: typeof attachFire;
      capture: typeof capture;
      verifyRefresh: typeof verifyRefresh;
      verifyFailureClassification: typeof verifyFailureClassification;
      verifyRetryConditions: typeof verifyRetryConditions;
      verifyMemory: typeof verifyMemory;
      verifySharedTargets: typeof verifySharedTargets;
      verifySharedInitialization: typeof verifySharedInitialization;
      verifyDocumentIsolation: typeof verifyDocumentIsolation;
      verifySharedDeviceLoss: typeof verifySharedDeviceLoss;
    };
  }
}
window.manual = {
  effect,
  createPlacementFixture,
  createMotionFixture,
  attach: attachFire,
  capture,
  verifyRefresh,
  verifyFailureClassification,
  verifyRetryConditions,
  verifyMemory,
  verifySharedTargets,
  verifySharedInitialization,
  verifyDocumentIsolation,
  verifySharedDeviceLoss,
};
void effect.ready.then(report);
let clicks = 0;
target.onclick = () => {
  clicks += 1;
  const output = document.querySelector('#clicks');
  if (output) {
    output.textContent = `Target clicks: ${clicks}`;
  }
};
document.querySelector('#seek')?.addEventListener('click', () => capture(1.5, 0.85));
document.querySelector('#zero')?.addEventListener('click', () => capture(effect.time, 0));
document.querySelector('#dispose')?.addEventListener('click', () => {
  effect.dispose();
  report();
});
window.addEventListener('pagehide', () => effect.dispose(), { once: true });
import.meta.hot?.dispose(() => effect.dispose());
