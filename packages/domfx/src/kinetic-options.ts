import type { ColorAttachmentOptions } from './color-options.js';

export interface KineticOptions extends ColorAttachmentOptions {
  /** Maximum outward fragment-center travel as a finite nonnegative fraction of the
   * shorter untransformed border-box side, including transparent margins.
   * Creation-only; omission keeps the Default appearance, zero is transparent.
   * Strength and fine detail stay independent of this ratio.
   */
  readonly fragmentTravel?: number;
}
