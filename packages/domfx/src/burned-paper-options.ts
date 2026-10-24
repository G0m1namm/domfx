import type { AttachmentOptions } from './attachment-options.js';

export interface BurnedPaperOptions extends AttachmentOptions {
  /** Creation-only fraction of the shorter untransformed border-box side.
   * Scorching retains local thin-shape caps. Either extent enables relative mode;
   * the omitted partner is zero. Omit both for legacy appearance.
   */
  readonly scorchDepth?: number;
  /** Creation-only fraction of border-box height for ash travel. Finite and
   * nonnegative; zero disables ash. Intensity scales premultiplied strength.
   */
  readonly ashReach?: number;
}
