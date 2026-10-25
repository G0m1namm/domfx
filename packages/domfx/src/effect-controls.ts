import type { EffectHandle } from '@domfx/core';

export interface ColorEffectHandle extends EffectHandle {
  /** Omit or reset to undefined to restore the effect's authored palette. */
  color: string | undefined;
}

export interface FrostEffectHandle extends ColorEffectHandle {
  /** Finite values clamp to 0–1; invalid writes throw and retain the prior value. */
  mistOpacity: number;
}

export interface FireEffectHandle extends ColorEffectHandle {
  /** Creation-only seeded-site density. Replace the instance to change it. */
  readonly emberDensity: number;
}

export interface BurnedPaperEffectHandle extends EffectHandle {
  /** Finite values clamp to 0–1; invalid writes throw and retain the prior value. */
  emberGlow: number;
}
