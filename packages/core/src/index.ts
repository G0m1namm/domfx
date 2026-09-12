/** SSR-safe capture contracts and alpha classification. */
export type EffectName = 'fire-edge';

/** Stable codes for unavailable effects and temporary suspension. */
export type EffectReason =
  | 'no-webgpu'
  | 'no-adapter'
  | 'capture-failed'
  | 'capture-budget'
  | 'empty-mask'
  | 'missing-exterior'
  | 'aggregate-budget'
  | 'renderer-failed'
  | 'canvas-webgpu-unavailable'
  | 'device-lost'
  | 'unsupported-placement'
  | 'reduced-motion'
  | 'target-not-visible'
  | 'stale-raster';

/** Readable controls shared by manual and ambient attachments. */
export interface ManualEffectHandle {
  /** Settles after initialization or cleanup of a cancelled initialization. */
  readonly ready: Promise<void>;
  /** Hide stale output and capture again. Resolves after this or a newer revision
   * commits; rejects on failure, invalidation, disposal or an unavailable handle. */
  refresh(): Promise<void>;
  readonly lifecycle: 'active' | 'suspended' | 'unavailable' | 'disposed';
  readonly raster: 'fresh' | 'refreshing' | 'stale';
  readonly reason: EffectReason | undefined;
  /** Underlying failure message for diagnostics; use reason for branching. */
  readonly reasonDetail: string | undefined;
  readonly seed: number;
  /** Absolute time in seconds; finite values, including negative time, are accepted. */
  time: number;
  /** Finite values are clamped to [0, 1]. */
  intensity: number;
  /** Called once on disposal, or immediately if disposed. Returns an unsubscribe function. */
  onDispose(callback: () => void): () => void;
  dispose(): void;
}

export type ClockMode = 'manual' | 'ambient';

export interface EffectHandle extends ManualEffectHandle {
  readonly clock: ClockMode;
  /** Manual mode is always paused. Independent of lifecycle suspension. */
  readonly paused: boolean;
  /** Freeze ambient time at the last committed frame; retain pending control writes. */
  pause(): void;
  /** Continue ambient time without changing seed. No-op in manual mode. */
  resume(): void;
}

export interface CaptureFrame {
  readonly width: number;
  readonly height: number;
  /** Straight, tightly packed RGBA8 pixels in top-left origin order. */
  readonly pixels: Uint8Array<ArrayBuffer>;
  readonly padding: Readonly<{ top: number; right: number; bottom: number; left: number }>;
  /** Untransformed target border box in local CSS pixels. */
  readonly contentBounds: Readonly<{ x: number; y: number; width: number; height: number }>;
  /** Maps raster coordinates (sample at x + .5, y + .5) to local CSS pixels. */
  readonly pixelToLocal: Readonly<{ a: number; d: number; e: number; f: number }>;
  release(): void;
}

export function classifyAlpha(
  frame: Pick<CaptureFrame, 'width' | 'height' | 'pixels'>,
  threshold = 128,
): Uint8Array {
  const result = new Uint8Array(frame.width * frame.height);
  for (let i = 0; i < result.length; i += 1) {
    result[i] = frame.pixels[i * 4 + 3] >= threshold ? 1 : 0;
  }
  return result;
}
