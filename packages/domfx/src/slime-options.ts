import type { AttachmentOptions } from './attachment-options.js';

export interface SlimeOptions extends AttachmentOptions {
  /** Finite values clamp to 0–1. Defaults to 1. */
  readonly gloss?: number;
  /** Creation-only normalized drip density, from 0 to 1. Defaults to 0.56.
   * Higher values add drip locations; zero disables drips. Does not
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
