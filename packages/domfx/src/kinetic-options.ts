import type { AttachmentOptions } from './attachment-options.js';

export interface KineticOptions extends AttachmentOptions {
  /** Maximum outward fragment-center travel as a finite nonnegative fraction of the
   * shorter untransformed border-box side, including transparent margins.
   * Creation-only; omission preserves legacy rendering, zero is transparent.
   * Strength and fine detail stay independent of this ratio.
   */
  readonly fragmentTravel?: number;
}
