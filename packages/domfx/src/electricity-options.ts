import type { ColorAttachmentOptions } from './color-options.js';

export interface ElectricityOptions extends ColorAttachmentOptions {
  /** Maximum exterior contour spread as a finite nonnegative fraction of the
   * shorter untransformed border-box side, including transparent margins.
   * Creation-only; omission preserves legacy rendering, zero is transparent.
   * Strength and fine detail stay independent of this ratio.
   */
  readonly contourSpread?: number;
}
