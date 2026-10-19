import type { FireOptions } from './fire-options.js';

/** Electricity uses the shared attachment controls; flame height belongs only to Fire. */
export type ElectricityOptions = Omit<FireOptions, 'flameHeight'>;
