import type { FireOptions } from './fire-options.js';

/** Slime uses shared attachment controls; flame height belongs only to Fire. */
export type SlimeOptions = Omit<FireOptions, 'flameHeight'>;
