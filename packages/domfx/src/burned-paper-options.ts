import type { FireOptions } from './fire-options.js';

/** Burned paper uses shared controls; flame height belongs only to Fire. */
export type BurnedPaperOptions = Omit<FireOptions, 'flameHeight'>;
