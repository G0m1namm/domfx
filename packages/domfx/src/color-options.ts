import type { AttachmentOptions } from './attachment-options.js';

/** One optional main color for decorative output. Omit it to retain the authored palette. */
export interface ColorAttachmentOptions extends AttachmentOptions {
  readonly color?: string;
}

/**
 * Either one main color or a pair of ramp endpoints, for an effect that adopts the pair.
 * Each endpoint is optional; an unset one uses that effect's authored color.
 */
export type ColorRampOptions =
  | {
      readonly color?: string;
      readonly rootColor?: never;
      readonly tipColor?: never;
    }
  | {
      readonly color?: never;
      /** Where the effect's ramp begins, such as the base of a flame. */
      readonly rootColor?: string;
      /** Where the effect's ramp ends, such as the ends of a flame. */
      readonly tipColor?: string;
    };
