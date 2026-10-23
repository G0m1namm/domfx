import type { gsap } from 'gsap';

import type { EffectHandle } from '@domfx/browser';

/** This body is also displayed verbatim in the guide's complete example. */
export function addGsapSequence(
  timeline: ReturnType<typeof gsap.timeline>,
  host: HTMLElement,
  fire: EffectHandle,
) {
  timeline.from(host, { opacity: 0, duration: 0.5, immediateRender: false });
  timeline.addLabel('ignite', 0.5);
  timeline.to(fire, { time: 4, intensity: 0.4, duration: 4, ease: 'none' }, 'ignite');
}
