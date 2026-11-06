import type { gsap } from 'gsap';

import type { EffectHandle } from '@domfx/browser';

/** This body is also displayed verbatim beside the guide's interactive sequence. */
export function addIgnitionSequence(
  timeline: ReturnType<typeof gsap.timeline>,
  host: HTMLElement,
  letters: readonly HTMLElement[],
  fires: readonly EffectHandle[],
) {
  timeline.fromTo(
    host,
    { opacity: 0 },
    { opacity: 1, duration: 0.4, ease: 'none', immediateRender: false },
    0,
  );
  timeline.fromTo(
    letters,
    { y: 70 },
    { y: 0, duration: 0.8, ease: 'back.out(2.2)', stagger: 0.06, immediateRender: false },
    0,
  );
  timeline.addLabel('ignite', 1);
  timeline.to(fires, { intensity: 1, duration: 0.7, ease: 'power3.in', stagger: 0.14 }, 'ignite');
  timeline.addLabel('surge', 2.4);
  timeline.to(
    fires,
    { rootColor: '#ffffff', tipColor: '#ffd27a', duration: 0.7, ease: 'power1.in' },
    'surge',
  );
  timeline.to(
    fires,
    { rootColor: '#99ddff', tipColor: '#0066ff', duration: 0.8, ease: 'power1.out' },
    'surge+=0.7',
  );
  timeline.to(
    letters,
    { y: -18, duration: 0.3, ease: 'sine.inOut', yoyo: true, repeat: 1, stagger: 0.07 },
    'surge+=0.3',
  );
  timeline.addLabel('burnOut', 4.2);
  timeline.to(
    fires,
    { intensity: 0.08, duration: 1, ease: 'power2.out', stagger: { each: 0.15, from: 'end' } },
    'burnOut',
  );
  timeline.to(fires, { time: 6, duration: 6, ease: 'none' }, 0);
}
