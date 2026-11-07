import {
  type ClockMode,
  type EffectHandle,
  type EffectName,
  type EffectReason,
  type ManualEffectHandle,
} from '@domfx/core';

export function consume(handle: EffectHandle) {
  const manual: ManualEffectHandle = handle;
  const clock: ClockMode = handle.clock;
  const name: EffectName = 'fire-edge';
  const reason: EffectReason | undefined = handle.reason;
  return { manual, clock, name, reason };
}

// @ts-expect-error Capture types live in the unstable browser entry.
export type { CaptureFrame } from '@domfx/core';
// @ts-expect-error The alpha classifier is not a library export.
export { classifyAlpha } from '@domfx/core';
