import type { AttachmentOptions } from './attachment-options.js';

/** One optional main color for decorative output. Omit it to retain the authored palette. */
export interface ColorAttachmentOptions extends AttachmentOptions {
  readonly color?: string;
}
