import type { EffectHandle } from '@domfx/core';

import {
  attachBurnedPaperWithAdapters,
  attachDitherWithAdapters,
  attachPatternWithAdapters,
  attachElectricityWithAdapters,
  attachFireWithAdapters,
  attachFrostWithAdapters,
  attachKineticWithAdapters,
  attachSlimeWithAdapters,
} from './attachment.js';
import { captureElementWithReservation } from './browser.js';
import type { BurnedPaperOptions } from './burned-paper-options.js';
import type { DitherOptions } from './dither-options.js';
import type { ElectricityOptions } from './electricity-options.js';
import type { FireOptions } from './fire-options.js';
import type { FrostOptions } from './frost-options.js';
import type { KineticOptions } from './kinetic-options.js';
import type { PatternOptions } from './pattern-options.js';
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

/** Attach a charred paper overlay without erasing or deforming the source. */
export function attachBurnedPaper(target: Element, options: BurnedPaperOptions): EffectHandle {
  return attachBurnedPaperWithAdapters(target, options, {
    capture: captureElementWithReservation,
    createRenderer: () => acquireRenderer(target.ownerDocument),
  });
}

/** Attach an ordered-dot edge and rising dither wisps without erasing the source. */
export function attachDither(target: Element, options: DitherOptions): EffectHandle {
  return attachDitherWithAdapters(target, options, {
    capture: captureElementWithReservation,
    createRenderer: () => acquireRenderer(target.ownerDocument),
  });
}

/** Attach the halftone pattern exploration to a captured silhouette. */
export function attachHalftone(target: Element, options: PatternOptions): EffectHandle {
  return attachPatternWithAdapters(target, 'halftone', options, {
    capture: captureElementWithReservation,
    createRenderer: () => acquireRenderer(target.ownerDocument),
  });
}

/** Attach the stipple pattern exploration to a captured silhouette. */
export function attachStipple(target: Element, options: PatternOptions): EffectHandle {
  return attachPatternWithAdapters(target, 'stipple', options, {
    capture: captureElementWithReservation,
    createRenderer: () => acquireRenderer(target.ownerDocument),
  });
}

/** Attach the scanlines pattern exploration to a captured silhouette. */
export function attachScanlines(target: Element, options: PatternOptions): EffectHandle {
  return attachPatternWithAdapters(target, 'scanlines', options, {
    capture: captureElementWithReservation,
    createRenderer: () => acquireRenderer(target.ownerDocument),
  });
}

/** Attach the crosshatch pattern exploration to a captured silhouette. */
export function attachCrosshatch(target: Element, options: PatternOptions): EffectHandle {
  return attachPatternWithAdapters(target, 'crosshatch', options, {
    capture: captureElementWithReservation,
    createRenderer: () => acquireRenderer(target.ownerDocument),
  });
}

/** Attach the diamond lattice pattern exploration to a captured silhouette. */
export function attachDiamonds(target: Element, options: PatternOptions): EffectHandle {
  return attachPatternWithAdapters(target, 'diamonds', options, {
    capture: captureElementWithReservation,
    createRenderer: () => acquireRenderer(target.ownerDocument),
  });
}

/** Attach the contour echoes pattern exploration to a captured silhouette. */
export function attachContourEchoes(target: Element, options: PatternOptions): EffectHandle {
  return attachPatternWithAdapters(target, 'contour-echoes', options, {
    capture: captureElementWithReservation,
    createRenderer: () => acquireRenderer(target.ownerDocument),
  });
}

export type { PatternEffect, PatternOptions } from './pattern-options.js';
export type { DitherOptions } from './dither-options.js';
export type { BurnedPaperOptions } from './burned-paper-options.js';
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
