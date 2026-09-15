import type { EffectHandle } from '@domfx/core';

import { attachFireWithAdapters } from './attachment.js';
import { captureElementWithReservation } from './browser.js';
import type { FireOptions } from './fire-options.js';
import { acquireRenderer } from './renderer-service.js';

/** Batch control writes and refresh observed changes to captured paint. */
export function attachFire(target: Element, options: FireOptions): EffectHandle {
  return attachFireWithAdapters(target, options, {
    capture: captureElementWithReservation,
    createRenderer: () => acquireRenderer(target.ownerDocument),
  });
}

export type { FireOptions } from './fire-options.js';
export { captureElement } from './browser.js';
export { CaptureError, type CaptureErrorCode } from './capture-assets.js';
export type {
  CaptureFrame,
  ClockMode,
  EffectHandle,
  EffectName,
  EffectReason,
  ManualEffectHandle,
} from '@domfx/core';
