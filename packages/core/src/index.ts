/** SSR-safe capture contracts and alpha classification. */
export type EffectName =
  | 'fire-edge'
  | 'electricity-edge'
  | 'frost-edge'
  | 'kinetic-edge'
  | 'slime-edge'
  | 'burned-paper-edge'
  | 'dither-edge'
  | 'halftone-edge'
  | 'stipple-edge'
  | 'scanlines-edge'
  | 'crosshatch-edge'
  | 'diamonds-edge'
  | 'contour-echoes-edge'
  | 'engraving-edge'
  | 'woven-mesh-edge'
  | 'hexagons-edge'
  | 'interference-edge'
  | 'shards-edge'
  | 'circuits-edge'
  | 'star-shimmer-edge'
  | 'brush-fringe-edge';

/** Stable codes for unavailable effects and temporary suspension. */
export type EffectReason =
  | 'no-webgpu'
  | 'no-adapter'
  | 'capture-failed'
  | 'capture-budget'
  | 'empty-mask'
  | 'missing-exterior'
  | 'aggregate-budget'
  | 'target-budget'
  | 'renderer-failed'
  | 'canvas-webgpu-unavailable'
  | 'device-lost'
  | 'effect-target-owned'
  | 'unsupported-placement'
  | 'unsupported-composition'
  | 'reduced-motion'
  | 'target-not-visible'
  | 'stale-raster';

/** Controls and state shared by every effect instance. */
export interface ManualEffectHandle {
  /** Settles after initialization or cleanup of a cancelled initialization. */
  readonly ready: Promise<void>;
  /** Hide stale output and capture again. Resolves after this or a newer revision
   * commits; rejects on failure, invalidation, disposal or an unavailable handle. */
  refresh(): Promise<void>;
  /** Tear down and reinitialize with retained controls. Concurrent calls share one
   * attempt. Like ready, resolves after work/cleanup; inspect lifecycle and reason.
   * Rejects if already disposed. Never retries automatically. */
  retry(): Promise<void>;
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

/** External time control or automatic animation. */
export type ClockMode = 'manual' | 'auto';

export interface EffectHandle extends ManualEffectHandle {
  readonly clock: ClockMode;
  /** Manual mode is always paused. Independent of lifecycle suspension. */
  readonly paused: boolean;
  /** Freeze automatic animation at the last committed frame; retain pending control writes. */
  pause(): void;
  /** Continue automatic animation without changing seed. No-op in manual mode. */
  resume(): void;
}
