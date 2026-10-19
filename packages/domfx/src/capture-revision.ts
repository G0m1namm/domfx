import type { CaptureFrame, EffectHandle } from '@domfx/core';

import { EffectError } from './effect-error.js';
import type { PreparedGpuFrame } from './gpu.js';
import {
  estimateFrameMemory,
  type AllocationLedger,
  type AllocationReservation,
} from './memory.js';
import type { AttachmentRenderer } from './renderer-service.js';

// Capture can outlive its attachment. A new attachment to the same target waits
// for the old capture to finish before starting another one.
const captures = new WeakMap<Element, Promise<void>>();

interface RevisionAdapters {
  target: Element;
  memory: AllocationLedger;
  createRenderer(): Promise<AttachmentRenderer>;
  capture(
    reserve: (width: number, height: number) => void,
    current: () => boolean,
  ): Promise<CaptureFrame | undefined>;
  canRun(): boolean;
  present(frame: CaptureFrame, renderer: AttachmentRenderer): void;
  committed(): void;
  failed(error: unknown, fallback: 'capture-failed' | 'renderer-failed'): void;
  deviceLost(error: unknown): void;
}

/** Owns revision ordering, promises, pending work and retained capture resources. */
export function createCaptureRevisions(adapters: RevisionAdapters) {
  let raster: EffectHandle['raster'] = 'refreshing';
  let revision = 1;
  let generation = 0;
  let enabled = true;
  let work: Promise<void> | undefined;
  let renderer: AttachmentRenderer | undefined;
  let unwatchDeviceLoss: (() => void) | undefined;
  let frame: CaptureFrame | undefined;
  let prepared: PreparedGpuFrame | undefined;
  let retainedMemory: AllocationReservation | undefined;
  const refreshes: { resolve: () => void; reject: (error: unknown) => void }[] = [];

  function settle(error?: unknown) {
    for (const refresh of refreshes.splice(0)) {
      if (error === undefined) {
        refresh.resolve();
      } else {
        refresh.reject(error);
      }
    }
  }

  function releaseRetained() {
    prepared?.destroy();
    prepared = undefined;
    retainedMemory?.release();
    retainedMemory = undefined;
    frame = undefined;
  }

  function releaseRenderer() {
    unwatchDeviceLoss?.();
    unwatchDeviceLoss = undefined;
    if (!work) {
      renderer?.destroy();
      renderer = undefined;
    }
  }

  function invalidate(error: unknown) {
    generation += 1;
    settle(error);
    raster = 'stale';
  }

  function stop(error: unknown) {
    enabled = false;
    invalidate(error);
    releaseRetained();
    releaseRenderer();
  }

  function isRefreshing(requestedRevision: number, requestedGeneration: number) {
    return (
      enabled &&
      raster === 'refreshing' &&
      revision === requestedRevision &&
      generation === requestedGeneration
    );
  }

  function current(requestedRevision: number, requestedGeneration: number) {
    if (!isRefreshing(requestedRevision, requestedGeneration)) {
      return false;
    }
    if (!adapters.canRun()) {
      if (isRefreshing(requestedRevision, requestedGeneration)) {
        invalidate(new Error('refresh-invalidated'));
      }
      return false;
    }
    return isRefreshing(requestedRevision, requestedGeneration);
  }

  function captureRevision(
    requestedRevision: number,
    requestedGeneration: number,
    reserve: (width: number, height: number) => void,
  ) {
    const previous = captures.get(adapters.target) ?? Promise.resolve();
    const captured = previous.then(() => {
      if (!current(requestedRevision, requestedGeneration)) {
        return undefined;
      }
      return adapters.capture(reserve, () => current(requestedRevision, requestedGeneration));
    });
    const settled = captured
      .then(
        () => {},
        () => {},
      )
      .finally(() => {
        if (captures.get(adapters.target) === settled) {
          captures.delete(adapters.target);
        }
      });
    captures.set(adapters.target, settled);
    return captured;
  }

  async function refreshLoop() {
    try {
      if (!renderer && enabled) {
        const acquired = await adapters.createRenderer();
        if (!enabled) {
          acquired.destroy();
          return;
        }
        renderer = acquired;
        const subscription: { callback?: (info: GPUDeviceLostInfo) => void } = {
          callback: adapters.deviceLost,
        };
        void acquired.device.lost.then((info) => {
          if (!subscription.callback) {
            return;
          }
          const error = new EffectError('device-lost', info.message, info);
          stop(error);
          adapters.deviceLost(error);
        });
        unwatchDeviceLoss = () => {
          subscription.callback = undefined;
        };
      }
      while (renderer && enabled && raster === 'refreshing') {
        const requestedRevision = revision;
        const requestedGeneration = generation;
        let nextFrame: CaptureFrame | undefined;
        let nextPrepared: PreparedGpuFrame | undefined;
        let reservation: AllocationReservation | undefined;
        const reserve = (width: number, height: number) => {
          const estimate = estimateFrameMemory(width, height);
          if (reservation) {
            reservation.reconcile(estimate);
          } else {
            reservation = adapters.memory.reserve(adapters.target, estimate);
          }
        };
        let failureReason: 'capture-failed' | 'renderer-failed' = 'capture-failed';
        try {
          if (!current(requestedRevision, requestedGeneration)) {
            continue;
          }
          nextFrame = await captureRevision(requestedRevision, requestedGeneration, reserve);
          if (!nextFrame) {
            if (isRefreshing(requestedRevision, requestedGeneration)) {
              invalidate(new Error('refresh-invalidated'));
            }
            continue;
          }
          if (!current(requestedRevision, requestedGeneration)) {
            continue;
          }
          reserve(nextFrame.width, nextFrame.height);
          if (nextFrame.pixels.byteLength !== nextFrame.width * nextFrame.height * 4) {
            throw new Error('invalid-frame');
          }
          failureReason = 'renderer-failed';
          nextPrepared = await renderer.prepare(nextFrame);
          if (!current(requestedRevision, requestedGeneration)) {
            continue;
          }

          const actual = estimateFrameMemory(nextPrepared.width, nextPrepared.height);
          if (nextPrepared.width !== nextFrame.width || nextPrepared.height !== nextFrame.height) {
            throw new Error('invalid-frame');
          }
          reservation?.reconcile({ ...actual, managedBytes: nextPrepared.managedBytes });

          // Install the replacement before presenting, and keep the previous
          // resources alive until presentation has consumed the new frame.
          const previous = prepared;
          const previousMemory = retainedMemory;
          prepared = nextPrepared;
          nextPrepared = undefined;
          retainedMemory = reservation;
          reservation = undefined;
          frame = nextFrame;
          raster = 'fresh';
          try {
            adapters.present(nextFrame, renderer);
          } finally {
            previous?.destroy();
            previousMemory?.release();
          }
          if (raster === 'fresh' && enabled) {
            settle();
            adapters.committed();
          }
        } catch (error) {
          // A superseded failure cannot reject requests for a newer revision.
          if (
            enabled &&
            revision === requestedRevision &&
            generation === requestedGeneration &&
            (raster === 'fresh' || raster === 'refreshing')
          ) {
            stop(error);
            adapters.failed(error, failureReason);
          }
        } finally {
          nextPrepared?.destroy();
          nextFrame?.release();
          if (frame && nextFrame === frame && prepared && retainedMemory) {
            retainedMemory.reconcile({
              ...estimateFrameMemory(frame.width, frame.height),
              managedBytes: prepared.managedBytes,
              captureBytes: 0,
            });
          }
          reservation?.release();
        }
      }
    } catch (error) {
      if (enabled) {
        stop(error);
        adapters.failed(error, 'renderer-failed');
      }
    }
  }

  function start(): Promise<void> {
    // Deferral coalesces same-task requests and installs the work owner before
    // any adapter can complete or fail.
    work ??= Promise.resolve()
      .then(refreshLoop)
      .finally(() => {
        work = undefined;
        if (!enabled) {
          releaseRenderer();
        } else if (raster === 'refreshing') {
          return start();
        }
      });
    return work;
  }

  function request(): Promise<void> {
    revision += 1;
    raster = 'refreshing';
    const promise = new Promise<void>((resolve, reject) => refreshes.push({ resolve, reject }));
    void start();
    return promise;
  }

  function restart() {
    enabled = true;
    revision += 1;
    raster = 'refreshing';
    return start();
  }

  return {
    get raster() {
      return raster;
    },
    get frame() {
      return frame;
    },
    get prepared() {
      return prepared;
    },
    start,
    request,
    restart,
    invalidate,
    stop,
    async drain() {
      await work;
    },
  };
}
