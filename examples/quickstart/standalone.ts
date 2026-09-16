import { attachFire } from '@domfx/browser';

export function startFire(target: Element, host: HTMLElement) {
  // Select the element whose captured paint should define the silhouette.
  return attachFire(target, { host, clock: 'manual', time: 0, intensity: 0.8, seed: 314 });
}
