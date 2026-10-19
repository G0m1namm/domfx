import type { AttachmentOptions } from './attachment-options.js';

export interface FireOptions extends AttachmentOptions {
  /** Flame size in target-local CSS pixels, 8–64. Defaults to 24; padding is automatic. */
  readonly flameHeight?: number;
}
