import { gsap } from 'gsap';

import { attachFire } from '@domfx/browser';
import type { EffectHandle } from '@domfx/core';
import { bindFire } from '@domfx/gsap';

const host = document.querySelector<HTMLElement>('#host');
const target = document.querySelector<HTMLElement>('#target');
const button = document.querySelector<HTMLButtonElement>('#activate');
const state = document.querySelector<HTMLElement>('#state');
const activations = document.querySelector<HTMLElement>('#activations');
if (!host || !target || !button || !state || !activations) {
  throw new Error('missing-accessibility-fixture');
}

const counts = { property: 0, listener: 0 };
function propertyHandler() {
  counts.property += 1;
}
button.onclick = propertyHandler;
button.addEventListener('click', () => {
  counts.listener += 1;
  activations.textContent = `Property handler: ${counts.property}; listener: ${counts.listener}`;
});

let effect: EffectHandle | undefined;
let context: gsap.Context | undefined;
let timeline: gsap.core.Timeline | undefined;

const report = () => {
  const text = effect ? `${effect.lifecycle}: ${effect.reason ?? effect.raster}` : 'No effect';
  if (state.textContent !== text) {
    state.textContent = text;
  }
};

function dispose() {
  context?.revert();
  timeline?.kill();
  effect?.dispose();
  report();
}

const attach = async () => {
  dispose();
  effect = attachFire(target, { host, clock: 'manual', time: 1.5, intensity: 0.85, seed: 314 });
  const current = effect;
  const currentTimeline = gsap.timeline({ paused: true });
  timeline = currentTimeline;
  context = gsap.context(() => {
    bindFire(current, currentTimeline, { time: 3.5, intensity: 0.5, duration: 2 });
  });
  await current.ready;
  report();
};

function revert(owned = false) {
  context?.revert();
  if (owned && effect && effect.lifecycle !== 'disposed' && timeline) {
    const current = effect;
    const currentTimeline = timeline;
    const ownedContext = gsap.context(() => {
      bindFire(current, currentTimeline, {
        time: 3.5,
        intensity: 0.5,
        duration: 2,
        disposeEffect: true,
      });
    });
    ownedContext.revert();
  }
  report();
}

const fixture = {
  attach,
  revert,
  dispose,
  snapshot: () => ({
    lifecycle: effect?.lifecycle ?? 'baseline',
    reason: effect?.reason,
    counts: { ...counts },
    originalTarget: document.querySelector('#target') === target,
    originalButton: document.querySelector('#activate') === button,
    originalHandler: button.onclick === propertyHandler,
  }),
};
declare global {
  interface Window {
    accessibilityFixture: typeof fixture;
  }
}
window.accessibilityFixture = fixture;
document.querySelector('#attach')?.addEventListener('click', () => {
  void attach().catch((error: unknown) => {
    state.textContent = String(error);
  });
});
document.querySelector('#revert')?.addEventListener('click', () => revert());
document.querySelector('#revert-owned')?.addEventListener('click', () => revert(true));
document.querySelector('#dispose')?.addEventListener('click', dispose);
// Sample diagnostics because automatic paint refresh has no public change event.
const reportTimer = window.setInterval(report, 100);
function cleanup() {
  clearInterval(reportTimer);
  dispose();
}
window.addEventListener('pagehide', cleanup, { once: true });
import.meta.hot?.dispose(cleanup);
