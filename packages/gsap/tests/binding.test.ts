import assert from 'node:assert/strict';
import test from 'node:test';

import { gsap } from 'gsap';

import type { EffectHandle } from '@domfx/core';
import { bindEffect, bindEffectAsync } from '@domfx/gsap';

/** A manual attachment's public controls; only the binding's seams behave. */
function fakeEffect(clock: EffectHandle['clock'] = 'manual') {
  const callbacks = new Set<() => void>();
  let lifecycle: EffectHandle['lifecycle'] = 'active';
  let disposals = 0;
  const effect: EffectHandle = {
    clock,
    paused: clock === 'manual',
    pause() {},
    resume() {},
    ready: Promise.resolve(),
    refresh: async () => {},
    retry: async () => {},
    time: 0,
    intensity: 1,
    seed: 0,
    raster: 'fresh',
    reason: undefined,
    reasonDetail: undefined,
    get lifecycle() {
      return lifecycle;
    },
    onDispose(callback) {
      if (lifecycle === 'disposed') {
        callback();
        return () => {};
      }
      callbacks.add(callback);
      return () => callbacks.delete(callback);
    },
    dispose() {
      if (lifecycle === 'disposed') {
        return;
      }
      lifecycle = 'disposed';
      disposals += 1;
      const pending = [...callbacks];
      callbacks.clear();
      pending.forEach((callback) => callback());
    },
  };
  return { effect, disposals: () => disposals, subscribers: () => callbacks.size };
}

const options = { time: 4, intensity: 0.5, duration: 2 };

test('seeking the timeline drives time and intensity', () => {
  const { effect } = fakeEffect();
  const timeline = gsap.timeline({ paused: true });
  bindEffect(effect, timeline, { ...options, intensity: 3 });

  timeline.seek(1);
  assert.equal(effect.time, 2);
  assert.equal(effect.intensity, 1, 'intensity is clamped before interpolation');
  timeline.seek(2);
  assert.equal(effect.time, 4);
  timeline.seek(0);
  assert.equal(effect.time, 0, 'reversing restores the start values');
});

test('the binding starts at its position on an advanced timeline', () => {
  const { effect } = fakeEffect();
  // Smooth child timing would move an unpaused child to the current playhead.
  const timeline = gsap.timeline({ paused: true, smoothChildTiming: true });
  timeline.to({}, { duration: 5 });
  timeline.seek(5);
  bindEffect(effect, timeline, { ...options, position: 1 });

  timeline.seek(2);
  assert.equal(effect.time, 2);
});

test('invalid bindings are rejected before touching the timeline', () => {
  const timeline = gsap.timeline({ paused: true });
  assert.throws(() => bindEffect(fakeEffect('auto').effect, timeline, options), /manual/);
  const disposed = fakeEffect();
  disposed.effect.dispose();
  assert.throws(() => bindEffect(disposed.effect, timeline, options), /live attachment/);
  for (const invalid of [
    { ...options, time: Number.NaN },
    { ...options, time: Number.MAX_VALUE },
    { ...options, intensity: Number.POSITIVE_INFINITY },
    { ...options, duration: -1 },
  ]) {
    assert.throws(() => bindEffect(fakeEffect().effect, timeline, invalid), /invalid-gsap/);
  }
  assert.equal(timeline.getChildren().length, 0);
});

test('disposal removes the tween, once, and keeps a caller-owned effect', () => {
  const fake = fakeEffect();
  const timeline = gsap.timeline({ paused: true });
  const binding = bindEffect(fake.effect, timeline, options);

  binding.dispose();
  binding.dispose();
  timeline.seek(2);

  assert.equal(fake.effect.time, 0, 'a disposed binding no longer writes controls');
  assert.equal(timeline.getChildren().length, 0);
  assert.equal(fake.subscribers(), 0);
  assert.equal(fake.disposals(), 0, 'the caller still owns the effect');
});

test('an owning binding disposes its effect', () => {
  const fake = fakeEffect();
  const binding = bindEffect(fake.effect, gsap.timeline({ paused: true }), {
    ...options,
    disposeEffect: true,
  });
  binding.dispose();
  assert.equal(fake.disposals(), 1);
});

test('disposing the effect disposes the binding', () => {
  const fake = fakeEffect();
  const timeline = gsap.timeline({ paused: true });
  bindEffect(fake.effect, timeline, options);

  fake.effect.dispose();
  timeline.seek(2);

  assert.equal(fake.effect.time, 0);
  assert.equal(timeline.getChildren().length, 0);
});

test('reverting a GSAP context disposes its bindings', () => {
  const fake = fakeEffect();
  const timeline = gsap.timeline({ paused: true });
  const context = gsap.context(() => {
    bindEffect(fake.effect, timeline, { ...options, disposeEffect: true });
  });

  context.revert();

  assert.equal(fake.disposals(), 1);
  assert.equal(timeline.getChildren().length, 0);
});

test('a failed setup cleans up and rethrows', () => {
  const fake = fakeEffect();
  const failure = new Error('add failed');
  const timeline = {
    add() {
      throw failure;
    },
  } as unknown as gsap.core.Timeline;

  assert.throws(
    () => bindEffect(fake.effect, timeline, { ...options, disposeEffect: true }),
    failure,
  );
  assert.equal(fake.subscribers(), 0);
  assert.equal(fake.disposals(), 1, 'an owning binding still disposes its effect');
});

test('an async binding binds once the attachment resolves', async () => {
  const fake = fakeEffect();
  const timeline = gsap.timeline({ paused: true });
  const binding = bindEffectAsync(Promise.resolve(fake.effect), timeline, {
    ...options,
    disposeEffect: true,
  });

  await binding.ready;
  timeline.seek(1);
  assert.equal(fake.effect.time, 2);

  binding.dispose();
  binding.dispose();
  assert.equal(fake.disposals(), 1);
  assert.equal(timeline.getChildren().length, 0);
});

test('an async binding requires ownership of the attachment', () => {
  assert.throws(
    () =>
      bindEffectAsync(Promise.resolve(fakeEffect().effect), gsap.timeline(), {
        ...options,
        disposeEffect: false as true,
      }),
    /ownership/,
  );
});

test('disposing before the attachment resolves disposes the late effect', async () => {
  const fake = fakeEffect();
  let resolve = (_effect: EffectHandle) => {};
  const attachment = new Promise<EffectHandle>((done) => {
    resolve = done;
  });
  const timeline = gsap.timeline({ paused: true });
  const binding = bindEffectAsync(attachment, timeline, { ...options, disposeEffect: true });

  binding.dispose();
  resolve(fake.effect);
  await binding.ready;

  assert.equal(fake.disposals(), 1);
  assert.equal(timeline.getChildren().length, 0);
});

test('reverting a context before the attachment resolves disposes the late effect', async () => {
  const fake = fakeEffect();
  let resolve = (_effect: EffectHandle) => {};
  const attachment = new Promise<EffectHandle>((done) => {
    resolve = done;
  });
  let binding: ReturnType<typeof bindEffectAsync> | undefined;
  const context = gsap.context(() => {
    binding = bindEffectAsync(attachment, gsap.timeline({ paused: true }), {
      ...options,
      disposeEffect: true,
    });
  });

  context.revert();
  resolve(fake.effect);
  await binding?.ready;

  assert.equal(fake.disposals(), 1);
});

test('a failed attachment rejects ready', async () => {
  const failure = new Error('no-adapter');
  const binding = bindEffectAsync(Promise.reject(failure), gsap.timeline({ paused: true }), {
    ...options,
    disposeEffect: true,
  });
  await assert.rejects(binding.ready, failure);
  binding.dispose();
});

test('a binding that cannot start disposes the attachment and rejects ready', async () => {
  const fake = fakeEffect('auto');
  const binding = bindEffectAsync(Promise.resolve(fake.effect), gsap.timeline({ paused: true }), {
    ...options,
    disposeEffect: true,
  });
  await assert.rejects(binding.ready, /manual/);
  assert.equal(fake.disposals(), 1);
});
