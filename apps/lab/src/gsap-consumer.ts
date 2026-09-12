import { gsap } from 'gsap';

import { attachFire } from '@domfx/browser';
import { bindFire, bindFireAsync } from '@domfx/gsap';

const host = document.querySelector<HTMLElement>('#host');
const target = document.querySelector<HTMLButtonElement>('#target');
const state = document.querySelector<HTMLElement>('#state');
if (!host || !target || !state) {
  throw new Error('missing-gsap-fixture');
}
const effect = attachFire(target, { host, time: 1.5, intensity: 0.85, seed: 314 });
const timeline = gsap.timeline({ paused: true, onUpdate: report });
const binding = bindFire(effect, timeline, { time: 5.5, intensity: 0.25, duration: 4 });

function report() {
  if (state) {
    state.textContent = JSON.stringify({
      lifecycle: effect.lifecycle,
      reason: effect.reason,
      time: effect.time,
      intensity: effect.intensity,
    });
  }
}
function dispose() {
  binding.dispose();
  timeline.kill(); // This consumer owns the host timeline.
  effect.dispose();
  report();
}

const consumer = {
  effect,
  timeline,
  binding,
  bind: bindFire,
  bindAsync: bindFireAsync,
  attach: attachFire,
  gsap,
};
declare global {
  interface Window {
    bindingConsumer: typeof consumer;
  }
}
window.bindingConsumer = consumer;
void effect.ready.then(report);
let clicks = 0;
target.onclick = () => {
  clicks += 1;
  const output = document.querySelector('#clicks');
  if (output) {
    output.textContent = `Target clicks: ${clicks}`;
  }
};
document.querySelector('#play')?.addEventListener('click', () => timeline.play());
document.querySelector('#seek')?.addEventListener('click', () => {
  timeline.pause().seek(2);
  report();
});
document.querySelector('#reverse')?.addEventListener('click', () => timeline.reverse());
document.querySelector('#unbind')?.addEventListener('click', () => binding.dispose());
document.querySelector('#dispose')?.addEventListener('click', dispose);
window.addEventListener('pagehide', dispose, { once: true });
import.meta.hot?.dispose(dispose);
