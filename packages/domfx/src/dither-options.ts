import type { FireOptions } from './fire-options.js';

/** Dither uses shared controls; flame height belongs only to Fire. */
export type DitherOptions = Omit<FireOptions, 'flameHeight'>;
