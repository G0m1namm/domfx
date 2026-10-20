import { check, rehearse } from './lifecycle.js';
import { startFire } from './quickstart.js';

void rehearse((target, host) => {
  const demo = startFire(target, host);
  const { effect, timeline, tween } = demo;
  const sibling = { value: 0 };
  timeline.to(sibling, { value: 4, duration: 4, ease: 'none' }, 0);
  check(timeline.getChildren().length === 2, 'tween and caller-owned sibling');
  return {
    effect,
    dispose: demo.dispose,
    controls: {
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
        tween.kill();
      },
      verifyCleanup() {
        check(timeline.getChildren().length === 1, 'tween cleanup must preserve sibling');
        const time = effect.time;
        timeline.seek(3);
        check(
          sibling.value === 3 && effect.time === time,
          'sibling remains usable after tween disposal',
        );
      },
    },
  };
});
