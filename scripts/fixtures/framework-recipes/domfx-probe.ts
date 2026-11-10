// Test harness: records the latest Fire effect so the browser check can read its controls.
import * as domfx from '../node_modules/@domfx/browser/dist/index.js';

export * from '../node_modules/@domfx/browser/dist/index.js';

export const attachFire: typeof domfx.attachFire = (target, options) => {
  const effect = domfx.attachFire(target, options);
  Object.assign(globalThis, { recipeEffect: effect });
  return effect;
};
