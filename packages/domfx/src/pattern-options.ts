import type { FireOptions } from './fire-options.js';

export type PatternEffect =
  | 'halftone'
  | 'stipple'
  | 'scanlines'
  | 'crosshatch'
  | 'diamonds'
  | 'contour-echoes';

/** Shared controls for the six pattern-effect explorations. */
export type PatternOptions = Omit<FireOptions, 'flameHeight'>;
