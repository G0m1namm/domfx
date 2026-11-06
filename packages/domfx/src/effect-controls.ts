import type { EffectHandle } from '@domfx/core';

export interface ColorEffectHandle extends EffectHandle {
  /** Omit or reset to undefined to restore the effect's authored palette. */
  color: string | undefined;
}

/**
 * Ramp endpoints, exclusive with `color`: writing a color while the other side is set throws
 * and retains the prior value, so reset to undefined first. Undefined restores an authored endpoint.
 */
export interface ColorRampEffectHandle extends ColorEffectHandle {
  rootColor: string | undefined;
  tipColor: string | undefined;
}

export interface FrostEffectHandle extends ColorEffectHandle {
  /** Finite values clamp to 0–1; invalid writes throw and retain the prior value. */
  mistOpacity: number;
}

export interface FireEffectHandle extends ColorRampEffectHandle {
  /** Creation-only seeded-site density. Replace the instance to change it. */
  readonly emberDensity: number;
}

export interface BurnedPaperEffectHandle extends EffectHandle {
  /** Finite values clamp to 0–1; invalid writes throw and retain the prior value. */
  emberGlow: number;
}
