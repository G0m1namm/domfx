import type { FireOptions } from './fire-options.js';

export type PatternEffect =
  | 'halftone'
  | 'stipple'
  | 'scanlines'
  | 'crosshatch'
  | 'diamonds'
  | 'contour-echoes'
  | 'engraving'
  | 'woven-mesh'
  | 'hexagons'
  | 'interference'
  | 'shards'
  | 'circuits'
  | 'star-shimmer'
  | 'brush-fringe';

/** Shared controls for the pattern-effect explorations. */
export type PatternOptions = Omit<FireOptions, 'flameHeight'>;
