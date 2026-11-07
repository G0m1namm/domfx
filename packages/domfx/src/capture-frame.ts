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
