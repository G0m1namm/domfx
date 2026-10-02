import type { EffectReason } from '@domfx/core';

type EffectErrorCode = Exclude<EffectReason, 'target-not-visible' | 'stale-raster'>;
type FailureStage = 'capture-failed' | 'renderer-failed';

/** Internal identity for unavailable failures; diagnostic wording is not a code. */
export class EffectError extends Error {
  constructor(
    readonly code: EffectErrorCode,
    message: string = code,
    cause?: unknown,
  ) {
    super(message, { cause });
    this.name = 'EffectError';
  }
}

/** Attachment adapter failures retain their context, including CaptureError metadata.
 * Unknown capture errors use capture-failed; setup, preparation and paint use renderer-failed.
 */
export function normalizeEffectError(error: unknown, stage: FailureStage): EffectError {
  return error instanceof EffectError
    ? error
    : new EffectError(stage, error instanceof Error ? error.message : String(error), error);
}

/** Describe rejected CSS only on failure; retain the typed reason for program logic. */
export function cssEffectError(
  code: 'unsupported-placement' | 'unsupported-composition',
  element: Element,
  property: string,
  value: string,
  correction: string,
): EffectError {
  const identity = element.localName + (element.id ? `#${element.id}` : '');
  return new EffectError(code, `${identity}: ${property}: ${value}. ${correction}`);
}
