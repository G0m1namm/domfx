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
}
