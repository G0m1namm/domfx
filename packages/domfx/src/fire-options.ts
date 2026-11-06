import type { AttachmentOptions } from './attachment-options.js';
import type { ColorRampOptions } from './color-options.js';

export type FireOptions = AttachmentOptions &
  ColorRampOptions & {
    /** Finite nonnegative fraction of the untransformed border-box height.
     * Creation-only; intensity scales strength independently of reach and detail.
     * Omit it for the Default appearance.
     */
    readonly flameReach?: number;
    /** Creation-only normalized ember-site density, from 0 to 1. Defaults to 1. */
    readonly emberDensity?: number;
  };
