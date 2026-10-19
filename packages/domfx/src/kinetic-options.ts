import type { FireOptions } from './fire-options.js';

/** Kinetic bloom uses shared controls; flame height belongs only to Fire. */
export type KineticOptions = Omit<FireOptions, 'flameHeight'>;
