import { EffectError } from './effect-error.js';

/** Electricity bounds all positive signed distance. Kinetic travel bounds outward
 * center displacement; its fixed 3px tangent drift + 5px footprint also need space.
 * Pulse/wake coverage is fixed inside the same 8px minimum exterior envelope.
 */
export function energyExtentSupport(effect: string, reach: number): number {
  return effect === 'kinetic' ? reach + 8 : reach;
}

export function energyExtentPadding(effect: string, reach: number, dpr: number): number {
  const support = energyExtentSupport(effect, reach);
  if (!Number.isFinite(support) || !Number.isFinite(Math.fround(support))) {
    throw new EffectError('capture-budget');
  }
  return Math.max(8, Math.ceil(support + 4 + 2 / dpr));
}
