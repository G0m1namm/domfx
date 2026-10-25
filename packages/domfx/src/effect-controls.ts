import type { EffectHandle } from '@domfx/core';

export interface FrostEffectHandle extends EffectHandle {
  /** Finite values clamp to 0–1; invalid writes throw and retain the prior value. */
  mistOpacity: number;
}

export interface FireEffectHandle extends EffectHandle {
  /** Creation-only seeded-site density. Replace the instance to change it. */
  readonly emberDensity: number;
}

export interface HalftoneEffectHandle extends EffectHandle {
  /** Creation-only local CSS-pixel pitch. Replace the instance to change it. */
  readonly dotSpacing: number;
}

export interface SlimeEffectHandle extends EffectHandle {
  /** Finite values clamp to 0–1; invalid writes throw and retain the prior value. */
  gloss: number;
}

export interface BurnedPaperEffectHandle extends EffectHandle {
  /** Finite values clamp to 0–1; invalid writes throw and retain the prior value. */
  emberGlow: number;
}
