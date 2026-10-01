import type { ClockMode } from '@domfx/core';

export interface FireOptions {
  /** Positioned HTML container; target must be a strict descendant. */
  readonly host: HTMLElement;
  /** Defaults to manual for externally owned time. */
  readonly clock?: ClockMode;
  /** Respect reduced motion by default; static always paints at time zero. */
  readonly motion?: 'respect' | 'static';
  readonly seed?: number;
  readonly time?: number;
  readonly intensity?: number;
  /** Flame size in target-local CSS pixels, 8–64. Defaults to 24; padding is automatic. */
  readonly flameHeight?: number;
}
