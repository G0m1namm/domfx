import type { ClockMode } from '@domfx/core';

export interface AttachmentOptions {
  /** Positioned HTML container; target must be a strict descendant. */
  readonly host: HTMLElement;
  /** 'manual' (default) lets your code control time; 'auto' advances it automatically.
   * 'ambient' remains a compatible alias for 'auto'. */
  readonly clock?: ClockMode;
  /** Respect reduced motion by default; static always paints at time zero. */
  readonly motion?: 'respect' | 'static';
  readonly seed?: number;
  readonly time?: number;
  readonly intensity?: number;
}
