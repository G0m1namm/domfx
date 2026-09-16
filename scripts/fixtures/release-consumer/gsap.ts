import { gsap } from 'gsap';

import { bindFire, type FireBindingOptions } from '@domfx/gsap';

import { check, rehearse } from './lifecycle.js';

void rehearse((effect) => {
  const timeline = gsap.timeline({ paused: true });
  const sibling = { value: 0 };
  timeline.to(sibling, { value: 4, duration: 4, ease: 'none' }, 0);
  const options: FireBindingOptions = { time: 4, intensity: 0.4, duration: 4, position: 0 };
  const binding = bindFire(effect, timeline, options);
  check(timeline.getChildren().length === 2, 'binding and caller-owned sibling');
  return {
    seek(time) {
      const changed = timeline.time() !== time;
      timeline.seek(time);
      if (changed) {
        check(
          effect.time === time && Math.abs(effect.intensity - (0.8 - time * 0.1)) < 1e-6,
          'GSAP must interpolate both public controls',
        );
      }
    },
    dispose() {
      binding.dispose();
    },
    verifyCleanup() {
      check(timeline.getChildren().length === 1, 'binding cleanup must preserve sibling');
      const time = effect.time;
      timeline.seek(3);
      check(
        sibling.value === 3 && effect.time === time,
        'sibling remains usable after binding disposal',
      );
      timeline.kill();
    },
  };
});
