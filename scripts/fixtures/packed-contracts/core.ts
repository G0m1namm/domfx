import {
  classifyAlpha,
  type CaptureFrame,
  type ClockMode,
  type EffectHandle,
  type EffectName,
  type EffectReason,
  type ManualEffectHandle,
} from '@domfx/core';

export function consume(frame: CaptureFrame, handle: EffectHandle) {
  const mask: Uint8Array = classifyAlpha(frame);
  const manual: ManualEffectHandle = handle;
  const clock: ClockMode = handle.clock;
  const name: EffectName = 'fire-edge';
  const reason: EffectReason | undefined = handle.reason;
  return { mask, manual, clock, name, reason };
}
