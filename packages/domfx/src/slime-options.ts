import type { AttachmentOptions } from './attachment-options.js';

export interface SlimeOptions extends AttachmentOptions {
  /** Creation-only fraction of candidate drip locations, from 0 to 1. Defaults
   * to 0.56. Zero disables drips; one enables every eligible location. Does not
   * change drip size, travel, timing or intensity, or enable relative mode.
   */
  readonly dripDensity?: number;
  /** Creation-only fraction of the shorter untransformed border-box side.
   * Either extent enables relative mode; the omitted partner is zero.
   * Omit both for legacy sizing. Relative intensity scales premultiplied strength.
   */
  readonly coatingDepth?: number;
  /** Creation-only fraction of border-box height for attached and released drip
   * travel. Finite and nonnegative; zero disables drips. Bead/neck detail stays fixed.
   */
  readonly dripReach?: number;
}
