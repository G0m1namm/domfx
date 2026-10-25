import assert from 'node:assert/strict';
import test from 'node:test';

import { gsap } from 'gsap';

import type { BurnedPaperEffectHandle, FrostEffectHandle, SlimeEffectHandle } from '@domfx/browser';
import type { EffectHandle } from '@domfx/core';
import { bindEffect, bindEffectAsync, bindFire, bindFireAsync } from '@domfx/gsap';

const options = { time: 4, intensity: 0.5, duration: 4, position: 0 };

function attachment() {
  const callbacks = new Set<() => void>();
  let disposed = false;
  let disposals = 0;
  const effect: EffectHandle = {
    ready: Promise.resolve(),
    refresh: () => Promise.resolve(),
    retry: () => Promise.resolve(),
    get lifecycle() {
      return disposed ? 'disposed' : 'active';
    },
    raster: 'fresh',
    reason: undefined,
    reasonDetail: undefined,
    seed: 0,
    clock: 'manual',
    paused: true,
    time: 0,
    intensity: 1,
    pause() {},
    resume() {},
    onDispose(callback) {
      if (disposed) {
        callback();
      } else {
        callbacks.add(callback);
      }
      return () => {
        callbacks.delete(callback);
      };
    },
    dispose() {
      if (disposed) {
        return;
      }
      disposed = true;
      disposals += 1;
      const pending = [...callbacks];
      callbacks.clear();
      pending.forEach((callback) => callback());
    },
  };
  return {
    effect,
    callbacks,
    get disposals() {
      return disposals;
    },
  };
}

function pendingAttachment() {
  let resolve: ((effect: EffectHandle) => void) | undefined;
  let reject: ((error: Error) => void) | undefined;
  const promise = new Promise<EffectHandle>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return {
    promise,
    resolve(effect: EffectHandle) {
      assert.ok(resolve);
      resolve(effect);
    },
    reject(error: Error) {
      assert.ok(reject);
      reject(error);
    },
  };
}

function host(t: test.TestContext) {
  const sibling = { value: 0 };
  const timeline = gsap.timeline({ paused: true });
  timeline.to(sibling, { value: 10, duration: 10, ease: 'none' });
  t.after(() => timeline.kill());
  return { timeline, sibling };
}

function materialAttachments() {
  const base = attachment().effect;
  let mistOpacity = 1;
  let gloss = 1;
  let emberGlow = 1;
  const frost: FrostEffectHandle = {
    ...base,
    get mistOpacity() {
      return mistOpacity;
    },
    set mistOpacity(value) {
      mistOpacity = value;
    },
  };
  const slime: SlimeEffectHandle = {
    ...base,
    get gloss() {
      return gloss;
    },
    set gloss(value) {
      gloss = value;
    },
  };
  const burnedPaper: BurnedPaperEffectHandle = {
    ...base,
    get emberGlow() {
      return emberGlow;
    },
    set emberGlow(value) {
      emberGlow = value;
    },
  };
  return { frost, slime, burnedPaper };
}

test('native GSAP property tweens update each writable material control', (t) => {
  const timeline = gsap.timeline({ paused: true });
  t.after(() => timeline.kill());
  const { frost, slime, burnedPaper } = materialAttachments();
  timeline.to(frost, { mistOpacity: 0, duration: 1, ease: 'none' });
  timeline.fromTo(slime, { gloss: 0 }, { gloss: 1, duration: 1, ease: 'none' });
  timeline.to(burnedPaper, { emberGlow: 0, duration: 1, ease: 'none' });

  timeline.seek(0.5, true);
  assert.equal(frost.mistOpacity, 0.5);
  timeline.seek(1.5, true);
  assert.equal(slime.gloss, 0.5);
  timeline.reverse();
  timeline.seek(2.5, true);
  assert.equal(burnedPaper.emberGlow, 0.5);
});

test('effect disposal detaches every binding and disposed effects reject new bindings', (t) => {
  const { effect, callbacks } = attachment();
  const { timeline, sibling } = host(t);
  const first = bindFire(effect, timeline, options);
  const second = bindFire(effect, timeline, { ...options, position: 4 });
  timeline.seek(2);
  effect.dispose();
  timeline.seek(8);
  assert.equal(effect.time, 2);
  assert.equal(sibling.value, 8);
  assert.equal(timeline.getChildren().length, 1);
  assert.equal(callbacks.size, 0);
  first.dispose();
  second.dispose();
  assert.throws(() => bindFire(effect, timeline, options), /live attachment/);
});

for (const disposeEffect of [false, true]) {
  test(`context cleanup has explicit effect ownership: ${disposeEffect}`, (t) => {
    const fixture = attachment();
    const { timeline, sibling } = host(t);
    const context = gsap.context(() => {
      bindFire(fixture.effect, timeline, { ...options, disposeEffect });
    });
    timeline.seek(2);
    context.revert();
    context.revert();
    timeline.seek(8);
    assert.equal(sibling.value, 8);
    assert.equal(timeline.getChildren().length, 1);
    assert.equal(fixture.callbacks.size, 0);
    assert.equal(fixture.disposals, disposeEffect ? 1 : 0);
  });
}

test('explicit binding disposal unregisters and survives later context revert', (t) => {
  const fixture = attachment();
  const { timeline } = host(t);
  const context = gsap.context(() => {});
  const binding = context.add(() => bindFire(fixture.effect, timeline, options));
  timeline.seek(2);
  binding.dispose();
  binding.dispose();
  context.revert();
  assert.equal(fixture.effect.time, 2);
  assert.equal(fixture.callbacks.size, 0);
  assert.equal(fixture.disposals, 0);
});

for (const teardown of ['revert', 'dispose'] as const) {
  test(`${teardown} before async completion disposes the late result without inserting a child`, async (t) => {
    const fixture = attachment();
    const { timeline, sibling } = host(t);
    const pending = pendingAttachment();
    const context = gsap.context(() => {});
    const binding = context.add(() =>
      bindFireAsync(pending.promise, timeline, { ...options, disposeEffect: true }),
    );
    if (teardown === 'revert') {
      context.revert();
      context.revert();
    } else {
      binding.dispose();
      binding.dispose();
    }
    // Reusing a context must not revive an earlier cancelled setup.
    context.add(() => {});
    pending.resolve(fixture.effect);
    await binding.ready;
    context.revert();
    binding.dispose();
    timeline.seek(8);
    assert.equal(fixture.disposals, 1);
    assert.equal(fixture.effect.time, 0);
    assert.equal(fixture.callbacks.size, 0);
    assert.equal(timeline.getChildren().length, 1);
    assert.equal(sibling.value, 8);
  });
}

test('async success remains owned by the original context', async (t) => {
  const fixture = attachment();
  const { timeline, sibling } = host(t);
  const context = gsap.context(() => {});
  const binding = context.add(() =>
    bindFireAsync(Promise.resolve(fixture.effect), timeline, { ...options, disposeEffect: true }),
  );
  await binding.ready;
  timeline.seek(2);
  assert.equal(fixture.effect.time, 2);
  context.revert();
  context.revert();
  binding.dispose();
  timeline.seek(8);
  assert.equal(fixture.disposals, 1);
  assert.equal(fixture.callbacks.size, 0);
  assert.equal(timeline.getChildren().length, 1);
  assert.equal(sibling.value, 8);
});

test('rejected attachment and invalid binding setup retain siblings and release owned results', async (t) => {
  const { timeline, sibling } = host(t);
  const pending = pendingAttachment();
  const context = gsap.context(() => {});
  const failed = context.add(() =>
    bindFireAsync(pending.promise, timeline, { ...options, disposeEffect: true }),
  );
  context.revert();
  pending.reject(new Error('attachment-failed'));
  await assert.rejects(failed.ready, /attachment-failed/);
  failed.dispose();
  const fixture = attachment();
  const invalid = bindFireAsync(Promise.resolve(fixture.effect), timeline, {
    ...options,
    duration: -1,
    disposeEffect: true,
  });
  await assert.rejects(invalid.ready, /invalid-gsap-binding-options/);
  invalid.dispose();
  assert.equal(fixture.disposals, 1);
  assert.equal(fixture.callbacks.size, 0);
  assert.equal(timeline.getChildren().length, 1);
  timeline.seek(8);
  assert.equal(sibling.value, 8);
});

test('generic binding names preserve the compatible snapshot and cancellation functions', () => {
  assert.equal(bindEffect, bindFire);
  assert.equal(bindEffectAsync, bindFireAsync);
});
