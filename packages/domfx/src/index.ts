import type { EffectHandle } from '@domfx/core';

import {
  attachElectricityWithAdapters,
  attachFireWithAdapters,
  attachFrostWithAdapters,
  attachKineticWithAdapters,
  attachSlimeWithAdapters,
} from './attachment.js';
import { captureElementWithReservation } from './browser.js';
import type { ElectricityOptions } from './electricity-options.js';
import type { FireOptions } from './fire-options.js';
import type { FrostOptions } from './frost-options.js';
import type { KineticOptions } from './kinetic-options.js';
import { acquireRenderer } from './renderer-service.js';
import type { SlimeOptions } from './slime-options.js';

/** Batch control writes and refresh observed changes to captured paint. */
export function attachFire(target: Element, options: FireOptions): EffectHandle {
  return attachFireWithAdapters(target, options, {
    capture: captureElementWithReservation,
    createRenderer: () => acquireRenderer(target.ownerDocument),
  });
}

/** Attach deterministic electric filaments to a captured silhouette. */
export function attachElectricity(target: Element, options: ElectricityOptions): EffectHandle {
  return attachElectricityWithAdapters(target, options, {
    capture: captureElementWithReservation,
    createRenderer: () => acquireRenderer(target.ownerDocument),
  });
}

/** Attach an icy rim, white mist and fine frost particles to a captured silhouette. */
export function attachFrost(target: Element, options: FrostOptions): EffectHandle {
  return attachFrostWithAdapters(target, options, {
    capture: captureElementWithReservation,
    createRenderer: () => acquireRenderer(target.ownerDocument),
  });
}

/** Attach a traveling light pulse and geometric fragments to a silhouette. */
export function attachKinetic(target: Element, options: KineticOptions): EffectHandle {
  return attachKineticWithAdapters(target, options, {
    capture: captureElementWithReservation,
    createRenderer: () => acquireRenderer(target.ownerDocument),
  });
}

/** Attach a solid slime rim and gravity-driven drips to a captured silhouette. */
export function attachSlime(target: Element, options: SlimeOptions): EffectHandle {
  return attachSlimeWithAdapters(target, options, {
    capture: captureElementWithReservation,
    createRenderer: () => acquireRenderer(target.ownerDocument),
  });
}

export type { SlimeOptions } from './slime-options.js';
export type { KineticOptions } from './kinetic-options.js';
export type { FireOptions } from './fire-options.js';
export type { ElectricityOptions } from './electricity-options.js';
export type { FrostOptions } from './frost-options.js';
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
