import { gsap } from 'gsap';

import { attachFire } from '@domfx/browser';
import { bindFire } from '@domfx/gsap';

export function startFire(target: Element, host: HTMLElement) {
  const effect = attachFire(target, { host, clock: 'manual', time: 0, intensity: 0.8, seed: 314 });
  const timeline = gsap.timeline({ paused: true });
  const binding = bindFire(effect, timeline, {
    time: 4,
    intensity: 0.4,
    duration: 4,
    position: 0,
  });

  function dispose() {
    binding.dispose();
    timeline.kill();
    effect.dispose();
  }

  return { effect, timeline, binding, dispose };
}
