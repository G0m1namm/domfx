import type { AttachmentOptions } from './attachment-options.js';

export interface FrostOptions extends AttachmentOptions {
  /** Creation-only fraction of the shorter untransformed border-box side.
   * Either extent enables relative mode; the omitted partner is zero.
   * Omit both for legacy appearance. Intensity scales premultiplied strength.
   */
  readonly coatingDepth?: number;
  /** Creation-only fraction of border-box height for mist and ice-grain travel.
   * Finite and nonnegative; zero disables this component, without scaling detail.
   */
  readonly mistReach?: number;
}
