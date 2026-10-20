import assert from 'node:assert/strict';
import test from 'node:test';

import type { CaptureFrame } from '@domfx/core';

import { createCaptureRevisions } from '../src/capture-revision.js';
import { diagnosticsFor, startEffectDiagnostics } from '../src/diagnostics.js';
import type { PreparedGpuFrame } from '../src/gpu.js';
import { AllocationLedger } from '../src/memory.js';
import type { AttachmentRenderer } from '../src/renderer-service.js';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
}

async function until(condition: () => boolean) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (condition()) {
      return;
    }
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
  assert.fail('controlled adapter was not entered');
}

function fixture(target: Element = {} as Element, initialization?: Promise<void>) {
  const events: string[] = [];
  const captureGates: ReturnType<typeof deferred<CaptureFrame | undefined>>[] = [];
  const prepareGates: ReturnType<typeof deferred<PreparedGpuFrame>>[] = [];
  const deviceLossGates: ReturnType<typeof deferred<GPUDeviceLostInfo>>[] = [];
  const memory = new AllocationLedger();
  const reserve = memory.reserve.bind(memory);
  let reservationReleases = 0;
  memory.reserve = (owner, estimate) => {
    const reservation = reserve(owner, estimate);
    return {
      reconcile: (next) => reservation.reconcile(next),
      release() {
        reservationReleases += 1;
        reservation.release();
      },
    };
  };
  let rendererReleases = 0;
  let rendererAcquisitions = 0;
  let canRun = true;
  let failure: unknown;
  const revisions = createCaptureRevisions({
    target,
    trace: diagnosticsFor(target, 'fire'),
    memory,
    async createRenderer() {
      rendererAcquisitions += 1;
      await initialization;
      const deviceLoss = deferred<GPUDeviceLostInfo>();
      deviceLossGates.push(deviceLoss);
      return {
        device: { lost: deviceLoss.promise } as GPUDevice,
        prepare: () => {
          const gate = deferred<PreparedGpuFrame>();
          prepareGates.push(gate);
          return gate.promise;
        },
        destroy() {
          rendererReleases += 1;
          events.push('renderer:release');
        },
      } satisfies AttachmentRenderer;
    },
    capture(reserve) {
      reserve(1, 1);
      const gate = deferred<CaptureFrame | undefined>();
      captureGates.push(gate);
      return gate.promise;
    },
    canRun: () => canRun,
    present(frame) {
      events.push(`present:${frame.pixels[0]}`);
    },
    committed() {
      events.push('committed');
    },
    failed(error) {
      failure = error;
    },
    deviceLost(error) {
      failure = error;
      events.push('device-lost:observer');
    },
  });

  function frame(id: number) {
    const result: CaptureFrame = {
      width: 1,
      height: 1,
      pixels: new Uint8Array([id, 0, 0, 255]),
      contentBounds: { x: 0, y: 0, width: 1, height: 1 },
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
      pixelToLocal: { a: 1, d: 1, e: 0, f: 0 },
      release() {
        events.push(`frame:release:${id}`);
      },
    };
    return result;
  }

  function prepared(id: number): PreparedGpuFrame {
    return {
      width: 1,
      height: 1,
      managedBytes: 20,
      prepareMs: 0,
      readSdf: async () => new Float32Array(),
      render() {},
      present() {},
      readFire: async () => new Uint8Array(),
      destroy() {
        events.push(`prepared:release:${id}`);
      },
    };
  }

  return {
    revisions,
    memory,
    events,
    captureGates,
    prepareGates,
    loseDevice(info: GPUDeviceLostInfo, index = 0) {
      deviceLossGates[index].resolve(info);
    },
    frame,
    prepared,
    get rendererReleases() {
      return rendererReleases;
    },
    get rendererAcquisitions() {
      return rendererAcquisitions;
    },
    get reservationReleases() {
      return reservationReleases;
    },
    get failure() {
      return failure;
    },
    setCanRun(value: boolean) {
      canRun = value;
    },
  };
}

test('superseded capture failure leaves newer requests pending and replacement transfers ownership', async () => {
  const f = fixture();
  const ready = f.revisions.start();
  await until(() => f.captureGates.length === 1);
  f.captureGates[0].resolve(f.frame(1));
  await until(() => f.prepareGates.length === 1);
  f.prepareGates[0].resolve(f.prepared(1));
  await ready;

  const settlements: string[] = [];
  const first = f.revisions.request().then(() => settlements.push('first'));
  await until(() => f.captureGates.length === 2);
  const second = f.revisions.request().then(() => settlements.push('second'));
  const third = f.revisions.request().then(() => settlements.push('third'));
  f.captureGates[1].reject(new Error('obsolete capture failure'));
  await until(() => f.captureGates.length === 3);
  assert.deepEqual(settlements, []);
  f.captureGates[2].resolve(f.frame(3));
  await until(() => f.prepareGates.length === 2);
  f.prepareGates[1].resolve(f.prepared(3));
  await Promise.all([first, second, third]);
  assert.deepEqual(settlements, ['first', 'second', 'third']);
  assert.equal(f.failure, undefined);
  assert.equal(f.events.filter((event) => event === 'present:1').length, 1);
  assert.equal(f.events.filter((event) => event === 'present:3').length, 1);
  assert.ok(f.events.indexOf('present:1') < f.events.indexOf('frame:release:1'));
  assert.ok(f.events.indexOf('present:3') < f.events.indexOf('prepared:release:1'));
  assert.equal(f.events.filter((event) => event === 'frame:release:1').length, 1);
  assert.equal(f.events.filter((event) => event === 'prepared:release:1').length, 1);
  f.revisions.stop(new Error('effect-disposed'));
  await f.revisions.drain();
  assert.equal(f.events.filter((event) => event === 'prepared:release:3').length, 1);
  assert.equal(f.events.filter((event) => event === 'frame:release:3').length, 1);
  assert.equal(f.rendererReleases, 1);
  assert.equal(f.reservationReleases, 3);
  assert.equal(f.memory.bytes, 0);
});

test('false canRun invalidates and settles without relying on adapter mutation', async () => {
  const f = fixture();
  const ready = f.revisions.start();
  await until(() => f.captureGates.length === 1);
  f.captureGates[0].resolve(f.frame(1));
  await until(() => f.prepareGates.length === 1);
  f.prepareGates[0].resolve(f.prepared(1));
  await ready;

  f.setCanRun(false);
  const result = f.revisions.request().catch((error: Error) => error.message);
  assert.equal(await result, 'refresh-invalidated');
  await f.revisions.drain();
  assert.equal(f.revisions.raster, 'stale');
  assert.equal(f.captureGates.length, 1);
  assert.equal(f.failure, undefined);
  assert.equal(f.events.filter((event) => event === 'prepared:release:1').length, 0);
  f.revisions.stop(new Error('effect-disposed'));
  assert.equal(f.events.filter((event) => event === 'prepared:release:1').length, 1);
  assert.equal(f.events.filter((event) => event === 'frame:release:1').length, 1);
  assert.equal(f.rendererReleases, 1);
  assert.equal(f.reservationReleases, 1);
  assert.equal(f.memory.bytes, 0);
});

test('current preparation failure stops and releases without failure observer mutation', async () => {
  const f = fixture();
  const failure = new Error('prepare-failed');
  const result = f.revisions.request().catch((error: Error) => error);
  await until(() => f.captureGates.length === 1);
  f.captureGates[0].resolve(f.frame(1));
  await until(() => f.prepareGates.length === 1);
  f.prepareGates[0].reject(failure);

  assert.equal(await result, failure);
  await f.revisions.drain();
  assert.equal(f.failure, failure);
  assert.equal(f.revisions.raster, 'stale');
  assert.equal(f.events.filter((event) => event === 'frame:release:1').length, 1);
  assert.equal(f.rendererReleases, 1);
  assert.equal(f.reservationReleases, 1);
  assert.equal(f.memory.bytes, 0);
});

test('false canRun after capture releases the pending frame and reservation', async () => {
  const f = fixture();
  const result = f.revisions.request().catch((error: Error) => error.message);
  await until(() => f.captureGates.length === 1);
  f.setCanRun(false);
  f.captureGates[0].resolve(f.frame(1));

  assert.equal(await result, 'refresh-invalidated');
  await f.revisions.drain();
  assert.equal(f.revisions.raster, 'stale');
  assert.equal(f.prepareGates.length, 0);
  assert.equal(f.events.filter((event) => event === 'frame:release:1').length, 1);
  assert.equal(f.reservationReleases, 1);
  f.revisions.stop(new Error('effect-disposed'));
  assert.equal(f.rendererReleases, 1);
  assert.equal(f.memory.bytes, 0);
});

test('empty current capture settles without requiring a callback transition', async () => {
  const f = fixture();
  const result = f.revisions.request().catch((error: Error) => error.message);
  await until(() => f.captureGates.length === 1);
  f.captureGates[0].resolve(undefined);

  assert.equal(await result, 'refresh-invalidated');
  await f.revisions.drain();
  assert.equal(f.revisions.raster, 'stale');
  assert.equal(f.prepareGates.length, 0);
  assert.equal(f.reservationReleases, 1);
  f.revisions.stop(new Error('effect-disposed'));
  assert.equal(f.rendererReleases, 1);
  assert.equal(f.memory.bytes, 0);
});

test('late preparation drains after invalidation and restart reacquires the renderer', async () => {
  const f = fixture();
  const ready = f.revisions.start();
  await until(() => f.captureGates.length === 1);
  f.captureGates[0].resolve(f.frame(1));
  await until(() => f.prepareGates.length === 1);
  f.revisions.stop(new Error('refresh-invalidated'));
  f.prepareGates[0].resolve(f.prepared(1));
  await ready;
  assert.equal(f.revisions.raster, 'stale');
  assert.equal(f.events.includes('present:1'), false);
  assert.equal(f.events.filter((event) => event === 'frame:release:1').length, 1);
  assert.equal(f.events.filter((event) => event === 'prepared:release:1').length, 1);
  assert.equal(f.rendererReleases, 1);
  assert.equal(f.memory.bytes, 0);

  const retry = f.revisions.restart();
  await until(() => f.captureGates.length === 2);
  f.captureGates[1].resolve(f.frame(2));
  await until(() => f.prepareGates.length === 2);
  f.prepareGates[1].resolve(f.prepared(2));
  await retry;
  assert.equal(f.rendererAcquisitions, 2);
  assert.equal(f.events.includes('present:2'), true);
  f.revisions.stop(new Error('effect-disposed'));
  await f.revisions.drain();
  assert.equal(f.rendererReleases, 2);
  assert.equal(f.reservationReleases, 2);
  assert.equal(f.memory.bytes, 0);
});

test('invalidated refresh rejects immediately and never presents a late captured frame', async () => {
  const f = fixture();
  const result = f.revisions.request().catch((error: Error) => error.message);
  await until(() => f.captureGates.length === 1);
  f.setCanRun(false);
  f.revisions.invalidate(new Error('refresh-invalidated'));
  assert.equal(await result, 'refresh-invalidated');
  f.captureGates[0].resolve(f.frame(1));
  await f.revisions.drain();
  assert.equal(f.prepareGates.length, 0);
  assert.equal(f.events.includes('present:1'), false);
  assert.equal(f.events.filter((event) => event === 'frame:release:1').length, 1);
  f.revisions.stop(new Error('effect-disposed'));
  assert.equal(f.reservationReleases, 1);
  assert.equal(f.memory.bytes, 0);
});

test('new attachment waits for a disposed owner capture on the same target', async () => {
  const target = {} as Element;
  const old = fixture(target);
  const oldReady = old.revisions.start();
  await until(() => old.captureGates.length === 1);
  old.revisions.stop(new Error('effect-disposed'));

  const next = fixture(target);
  const nextReady = next.revisions.start();
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(next.captureGates.length, 0);
  old.captureGates[0].resolve(old.frame(1));
  await oldReady;
  await until(() => next.captureGates.length === 1);
  next.captureGates[0].resolve(next.frame(2));
  await until(() => next.prepareGates.length === 1);
  next.prepareGates[0].resolve(next.prepared(2));
  await nextReady;
  next.revisions.stop(new Error('effect-disposed'));
  assert.equal(old.rendererReleases, 1);
  assert.equal(next.rendererReleases, 1);
  assert.equal(old.memory.bytes, 0);
  assert.equal(next.memory.bytes, 0);
});

test('device loss notifies and settles while capture remains pending, then drains once', async () => {
  const f = fixture();
  const result = f.revisions.request().catch((error: unknown) => error);
  await until(() => f.captureGates.length === 1);
  const info = { message: 'device gone', reason: 'destroyed' } as GPUDeviceLostInfo;
  f.loseDevice(info);
  await until(() => f.events.includes('device-lost:observer'));
  const notified = f.failure;

  assert.equal(await result, notified);
  assert.ok(notified instanceof Error);
  assert.equal(notified.message, 'device gone');
  assert.equal(notified.name, 'EffectError');
  assert.equal((notified as Error & { code?: string }).code, 'device-lost');
  assert.equal(notified.cause, info);
  assert.equal(f.revisions.raster, 'stale');
  assert.equal(f.rendererReleases, 0);
  assert.equal(f.reservationReleases, 0);

  f.captureGates[0].resolve(f.frame(1));
  await f.revisions.drain();
  assert.equal(f.rendererReleases, 1);
  assert.ok(f.events.indexOf('device-lost:observer') < f.events.indexOf('renderer:release'));
  assert.equal(f.events.filter((event) => event === 'frame:release:1').length, 1);
  assert.equal(f.reservationReleases, 1);
  assert.equal(f.memory.bytes, 0);
});

test('device loss notifies during preparation and releases the late result once', async () => {
  const f = fixture();
  const result = f.revisions.request().catch((error: unknown) => error);
  await until(() => f.captureGates.length === 1);
  f.captureGates[0].resolve(f.frame(1));
  await until(() => f.prepareGates.length === 1);

  const info = { message: 'device gone', reason: 'destroyed' } as GPUDeviceLostInfo;
  f.loseDevice(info);
  await until(() => f.events.includes('device-lost:observer'));
  assert.equal(await result, f.failure);
  assert.equal(f.revisions.raster, 'stale');
  assert.equal(f.rendererReleases, 0);
  assert.equal(f.events.filter((event) => event === 'frame:release:1').length, 0);

  f.prepareGates[0].resolve(f.prepared(1));
  await f.revisions.drain();
  assert.equal(f.events.filter((event) => event === 'frame:release:1').length, 1);
  assert.equal(f.events.filter((event) => event === 'prepared:release:1').length, 1);
  assert.equal(f.reservationReleases, 1);
  assert.equal(f.rendererReleases, 1);
  assert.equal(f.memory.bytes, 0);

  const retry = f.revisions.restart();
  await until(() => f.captureGates.length === 2);
  assert.equal(f.rendererAcquisitions, 2);
  assert.equal(f.events.filter((event) => event === 'device-lost:observer').length, 1);
  f.captureGates[1].resolve(f.frame(2));
  await until(() => f.prepareGates.length === 2);
  f.prepareGates[1].resolve(f.prepared(2));
  await retry;
  assert.equal(f.revisions.raster, 'fresh');
  f.revisions.stop(new Error('effect-disposed'));
  assert.equal(f.events.filter((event) => event === 'device-lost:observer').length, 1);
  assert.equal(f.rendererReleases, 2);
  assert.equal(f.reservationReleases, 2);
  assert.equal(f.memory.bytes, 0);
});

test('loss from an obsolete device does not stop a restarted revision', async () => {
  const f = fixture();
  const first = f.revisions.start();
  await until(() => f.captureGates.length === 1);
  f.revisions.stop(new Error('refresh-invalidated'));
  f.captureGates[0].resolve(f.frame(1));
  await first;
  assert.equal(f.rendererReleases, 1);

  const retry = f.revisions.restart();
  await until(() => f.captureGates.length === 2);
  f.loseDevice({ message: 'obsolete device', reason: 'destroyed' } as GPUDeviceLostInfo, 0);
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(f.events.includes('device-lost:observer'), false);
  assert.equal(f.revisions.raster, 'refreshing');

  f.captureGates[1].resolve(f.frame(2));
  await until(() => f.prepareGates.length === 1);
  f.prepareGates[0].resolve(f.prepared(2));
  await retry;
  assert.equal(f.revisions.raster, 'fresh');
  f.revisions.stop(new Error('effect-disposed'));
  assert.equal(f.events.includes('device-lost:observer'), false);
  assert.equal(f.events.filter((event) => event === 'frame:release:1').length, 1);
  assert.equal(f.events.filter((event) => event === 'frame:release:2').length, 1);
  assert.equal(f.events.filter((event) => event === 'prepared:release:2').length, 1);
  assert.equal(f.reservationReleases, 2);
  assert.equal(f.rendererReleases, 2);
  assert.equal(f.memory.bytes, 0);
});

test('trace correlates a superseded preparation and replacement to the same opaque target', async () => {
  const session = startEffectDiagnostics();
  const f = fixture();
  try {
    const ready = f.revisions.start();
    await until(() => f.captureGates.length === 1);
    f.captureGates[0].resolve(f.frame(1));
    await until(() => f.prepareGates.length === 1);
    const refreshed = f.revisions.request();
    f.prepareGates[0].resolve(f.prepared(1));
    await until(() => f.captureGates.length === 2);
    f.captureGates[1].resolve(f.frame(2));
    await until(() => f.prepareGates.length === 2);
    f.prepareGates[1].resolve(f.prepared(2));
    await Promise.all([ready, refreshed]);
    const records = session.records;
    assert.equal(new Set(records.map((record) => record.target)).size, 1);
    assert.ok(records.every((record) => record.effect === 'fire'));
    assert.ok(records.some((record) => record.revision === 1 && record.phase === 'drop'));
    assert.ok(!records.some((record) => record.revision === 1 && record.phase === 'commit'));
    assert.ok(records.some((record) => record.revision === 2 && record.phase === 'commit'));
    for (const revision of [1, 2]) {
      for (const stage of ['capture', 'prepare']) {
        const stages = records.filter(
          (record) => record.revision === revision && record.stage === stage,
        );
        assert.deepEqual(
          stages.map((record) => record.phase),
          ['start', 'end'],
        );
        assert.ok(stages[1].at >= stages[0].at);
      }
    }
  } finally {
    f.revisions.stop(new Error('effect-disposed'));
    await f.revisions.drain();
    session.dispose();
  }
});

test('renderer failure retains its initiating revision after a pending refresh', async () => {
  const session = startEffectDiagnostics();
  const initialization = deferred<void>();
  const f = fixture({} as Element, initialization.promise);
  try {
    const ready = f.revisions.start();
    await until(() => f.rendererAcquisitions === 1);
    const failure = new Error('initialization failed');
    const refreshed = f.revisions.request().catch((error: unknown) => error);
    initialization.reject(failure);
    assert.equal(await refreshed, failure);
    await ready;
    assert.equal(f.failure, failure);
    assert.deepEqual(
      session.records
        .filter((record) => record.stage === 'renderer')
        .map(({ revision, phase }) => ({ revision, phase })),
      [
        { revision: 1, phase: 'start' },
        { revision: 1, phase: 'error' },
      ],
    );
  } finally {
    f.revisions.stop(new Error('effect-disposed'));
    await f.revisions.drain();
    session.dispose();
  }
});
