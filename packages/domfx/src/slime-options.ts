import type { AttachmentOptions } from './attachment-options.js';

export interface SlimeOptions extends AttachmentOptions {
  /** Creation-only fraction of the shorter untransformed border-box side.
   * Either extent enables relative mode; the omitted partner is zero.
   * Omit both for legacy appearance. Intensity scales premultiplied strength.
   */
  readonly coatingDepth?: number;
  /** Creation-only fraction of border-box height for attached and released drip
   * travel. Finite and nonnegative; zero disables drips. Bead/neck detail stays fixed.
   */
  readonly dripReach?: number;
}
