/** SSR-safe capture contracts and alpha classification. */
export type EffectName = 'fire-edge';

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

export function classifyAlpha(frame: Pick<CaptureFrame, 'width' | 'height' | 'pixels'>, threshold = 128): Uint8Array {
  const result = new Uint8Array(frame.width * frame.height);
  for (let i = 0; i < result.length; i += 1) result[i] = frame.pixels[i * 4 + 3] >= threshold ? 1 : 0;
  return result;
}
