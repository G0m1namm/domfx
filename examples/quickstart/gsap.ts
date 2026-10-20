import { gsap } from 'gsap';

import { attachFire } from '@domfx/browser';

export function startFire(target: Element, host: HTMLElement) {
  const effect = attachFire(target, { host, clock: 'manual', time: 0, intensity: 0.8, seed: 314 });
  const timeline = gsap.timeline({ paused: true });
  const tween = gsap.to(effect, {
    time: 4,
    intensity: 0.4,
    duration: 4,
    ease: 'none',
    paused: true,
  });

  timeline.add(tween, 0);
  tween.paused(false);
  const unsubscribe = effect.onDispose(() => tween.kill());

  function dispose() {
    unsubscribe();
    tween.kill();
    timeline.kill();
    effect.dispose();
  }

  return { effect, timeline, tween, dispose };
}
