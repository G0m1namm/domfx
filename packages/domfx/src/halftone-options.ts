import type { PatternOptions } from './pattern-options.js';

/** Halftone-only creation settings. */
export interface HalftoneOptions extends PatternOptions {
  /** Creation-only local CSS-pixel screen pitch, from 3 to 12. Defaults to 5.5. */
  readonly dotSpacing?: number;
}
