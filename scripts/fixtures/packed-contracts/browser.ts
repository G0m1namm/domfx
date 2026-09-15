import {
  attachFire,
  captureElement,
  CaptureError,
  type CaptureErrorCode,
  type CaptureFrame,
  type EffectHandle,
  type FireOptions,
} from '@domfx/browser';

export async function consume(target: Element, host: HTMLElement) {
  const options: FireOptions = { host, clock: 'manual', time: 1, intensity: 0.5 };
  const handle: EffectHandle = attachFire(target, options);
  const frame: CaptureFrame = await captureElement(target, { paddingCss: 32, dpr: 1 });
  const code: CaptureErrorCode = 'asset-timeout';
  const error: CaptureError = new CaptureError(code, 'fixture');
  await handle.ready;
  handle.time = 2;
  handle.pause();
  handle.resume();
  await handle.refresh();
  await handle.retry();
  handle.dispose();
  frame.release();
  return error;
}

// @ts-expect-error A positioned effect host is required by the attachment contract.
attachFire(document.body, {});
// @ts-expect-error Renderer implementation types are not part of the root contract.
export type { PreparedGpuFrame } from '@domfx/browser';
// @ts-expect-error Test-only distance oracles must remain outside library exports.
export { exactDistanceTransform } from '@domfx/core';
