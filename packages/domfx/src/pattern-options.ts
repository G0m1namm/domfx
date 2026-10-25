import type { ColorAttachmentOptions } from './color-options.js';

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

/** Creation-only target-relative extents for the shared rising-flow patterns.
 * Omit both to retain legacy appearance. In relative mode, an omitted member is zero.
 */
export interface PatternOptions extends ColorAttachmentOptions {
  /** Finite nonnegative fraction of untransformed target border-box height. */
  readonly plumeReach?: number;
  /** Finite nonnegative fraction of the shorter untransformed border-box side. */
  readonly bandDepth?: number;
  readonly echoReach?: never;
  readonly fringeReach?: never;
}

/** Radial echoes keep their fixed local line spacing independently of reach. */
export interface ContourEchoesOptions extends ColorAttachmentOptions {
  /** Creation-only finite nonnegative fraction of the shorter border-box side. */
  readonly echoReach?: number;
  readonly plumeReach?: never;
  readonly bandDepth?: never;
  readonly fringeReach?: never;
}

/** Fixed-size bristles extend beyond the relative sampling envelope. */
export interface BrushFringeOptions extends ColorAttachmentOptions {
  /** Creation-only finite nonnegative fraction of the shorter border-box side.
   * Full support includes up to 5.1 CSS px of fixed bristle footprint.
   */
  readonly fringeReach?: number;
  readonly plumeReach?: never;
  readonly bandDepth?: never;
  readonly echoReach?: never;
}
