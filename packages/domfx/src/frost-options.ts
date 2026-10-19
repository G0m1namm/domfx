import type { FireOptions } from './fire-options.js';

/** Frost uses the shared attachment controls; flame height belongs only to Fire. */
export type FrostOptions = Omit<FireOptions, 'flameHeight'>;
