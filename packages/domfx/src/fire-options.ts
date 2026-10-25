import type { AttachmentOptions } from './attachment-options.js';

export type FireOptions = AttachmentOptions &
  (
    | {
        /** Legacy artistic scale in local CSS pixels, 8–64. Defaults to 24. */
        readonly flameHeight?: number;
        readonly flameReach?: never;
      }
    | {
        /** Finite nonnegative fraction of the untransformed border-box height.
         * Creation-only; intensity scales strength independently of reach and detail.
         */
        readonly flameReach: number;
        readonly flameHeight?: never;
      }
  ) & {
    /** Creation-only normalized ember-site density, from 0 to 1. Defaults to 1. */
    readonly emberDensity?: number;
  };
