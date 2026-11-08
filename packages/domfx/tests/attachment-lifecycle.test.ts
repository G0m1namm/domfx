import assert from 'node:assert/strict';
import { after, test } from 'node:test';

import {
  attachFireWithAdapters,
  estimateFrameMemory,
  memoryFor,
} from '@domfx/browser/experimental';

import { fakeAdapters, installDom, type Stage } from './attachment-environment.js';

const dom = installDom();
after(() => dom.close());

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

function budgetFailure(): unknown {
  try {
    estimateFrameMemory(1001, 1000);
  } catch (error) {
    return error;
  }
  throw new Error('expected a capture budget failure');
}

test('an active attachment releases everything once on disposal', async () => {
  const { host, target } = dom.mount();
  const baseline = memoryFor(dom.document).bytes;
  const fake = fakeAdapters();
  const effect = attachFireWithAdapters(target, { host }, fake.adapters);
  await effect.ready;

  assert.equal(effect.lifecycle, 'active');
  assert.equal(effect.reason, undefined);
  assert.ok(host.querySelector('canvas'));
  assert.ok(fake.state.presents > 0);
  assert.equal(fake.state.releases, fake.state.captures, 'capture pixels are released');

  let disposals = 0;
  effect.onDispose(() => (disposals += 1));
  effect.dispose();
  effect.dispose();

  assert.equal(effect.lifecycle, 'disposed');
  assert.equal(disposals, 1);
  assert.ok(fake.balanced());
  assert.equal(host.querySelector('canvas'), null);
  assert.equal(memoryFor(dom.document).bytes, baseline);

  let late = 0;
  effect.onDispose(() => (late += 1));
  assert.equal(late, 1, 'a callback added after disposal runs immediately');
  await assert.rejects(effect.refresh(), /effect-disposed/);
  await assert.rejects(effect.retry(), /effect-disposed/);

  const replacement = attachFireWithAdapters(target, { host }, fake.adapters);
  await replacement.ready;
  assert.equal(replacement.lifecycle, 'active', 'disposal releases the target');
  replacement.dispose();
  host.remove();
});

test('a target and its ancestors accept one attachment at a time', async () => {
  const { host, target } = dom.mount();
  const child = dom.document.createElement('span');
  target.append(child);
  const fake = fakeAdapters();
  const effect = attachFireWithAdapters(target, { host }, fake.adapters);

  assert.throws(
    () => attachFireWithAdapters(target, { host }, fake.adapters),
    /effect-target-owned/,
  );
  assert.throws(
    () => attachFireWithAdapters(child, { host }, fake.adapters),
    /effect-target-owned/,
  );

  effect.dispose();
  await effect.ready;
  attachFireWithAdapters(target, { host }, fake.adapters).dispose();
  host.remove();
});

const failures: { stage: Stage; failure: () => unknown; reason: string }[] = [
  { stage: 'setup', failure: () => new Error('no-adapter'), reason: 'renderer-failed' },
  { stage: 'capture', failure: () => new Error('snapshot'), reason: 'capture-failed' },
  { stage: 'capture', failure: budgetFailure, reason: 'capture-budget' },
  { stage: 'prepare', failure: () => new Error('prepare'), reason: 'renderer-failed' },
  { stage: 'paint', failure: () => new Error('paint'), reason: 'renderer-failed' },
];

for (const { stage, failure, reason } of failures) {
  for (const phase of ['initial', 'refresh'] as const) {
    if (stage === 'setup' && phase === 'refresh') {
      continue;
    }
    const error = failure();
    const name = error instanceof Error ? error.message : String(error);
    test(`a ${stage} failure on ${phase} capture makes the attachment unavailable (${name})`, async () => {
      const { host, target } = dom.mount();
      const baseline = memoryFor(dom.document).bytes;
      const fake = fakeAdapters();
      fake.state.failure = error;
      const effect = attachFireWithAdapters(target, { host }, fake.adapters);
      if (phase === 'refresh') {
        await effect.ready;
        assert.equal(effect.lifecycle, 'active');
      }
      fake.state.failAt = stage;

      const rejection: unknown = await effect.refresh().then(
        () => undefined,
        (caught: unknown) => caught,
      );
      await effect.ready;

      assert.equal(rejection, error, 'the adapter error reaches the caller');
      assert.equal(effect.lifecycle, 'unavailable');
      assert.equal(effect.reason, reason);
      assert.equal(effect.reasonDetail, name);
      assert.ok(fake.balanced(), 'every resource is released once');
      assert.equal(host.querySelector('canvas'), null);
      assert.equal(memoryFor(dom.document).bytes, baseline);
      await assert.rejects(effect.refresh(), /effect-unavailable/);

      fake.state.failAt = undefined;
      const replacement = attachFireWithAdapters(target, { host }, fake.adapters);
      await replacement.ready;
      assert.equal(replacement.lifecycle, 'active', 'failure releases the target');
      replacement.dispose();
      effect.dispose();
      assert.ok(fake.balanced());
      host.remove();
    });
  }
}

test('retry recovers an unavailable attachment, sharing one attempt', async () => {
  const { host, target } = dom.mount();
  const fake = fakeAdapters();
  fake.state.failAt = 'capture';
  const effect = attachFireWithAdapters(target, { host }, fake.adapters);
  await effect.ready;
  assert.equal(effect.lifecycle, 'unavailable');
  assert.equal(effect.reason, 'capture-failed');

  fake.state.failAt = undefined;
  const first = effect.retry();
  assert.equal(effect.retry(), first, 'concurrent calls share one attempt');
  await first;
  await effect.ready;
  await settle();

  assert.equal(effect.lifecycle, 'active');
  assert.equal(effect.reason, undefined);
  assert.ok(host.querySelector('canvas'));
  effect.dispose();
  assert.ok(fake.balanced());
  host.remove();
});

test('retry tears down an active attachment and captures again', async () => {
  const { host, target } = dom.mount();
  const fake = fakeAdapters();
  const effect = attachFireWithAdapters(target, { host }, fake.adapters);
  await effect.ready;
  const captures = fake.state.captures;

  const retrying = effect.retry();
  await assert.rejects(effect.refresh(), /effect-retrying/);
  await retrying;
  await settle();

  assert.equal(effect.lifecycle, 'active');
  assert.ok(fake.state.captures > captures);
  effect.dispose();
  assert.ok(fake.balanced());
  host.remove();
});

test('disposal during capture releases the late frame without painting', async () => {
  const { host, target } = dom.mount();
  const fake = fakeAdapters();
  const release = fake.holdCapture();
  const effect = attachFireWithAdapters(target, { host }, fake.adapters);
  await fake.state.captureStarted.promise;

  effect.dispose();
  release();
  await effect.ready;
  await settle();

  assert.equal(effect.lifecycle, 'disposed');
  assert.equal(fake.state.presents, 0);
  assert.ok(fake.balanced());
  assert.equal(host.querySelector('canvas'), null);
  host.remove();
});

test('disposal during renderer setup destroys the late renderer', async () => {
  const { host, target } = dom.mount();
  const fake = fakeAdapters();
  const release = fake.holdRenderer();
  const effect = attachFireWithAdapters(target, { host }, fake.adapters);
  await fake.state.rendererStarted.promise;

  effect.dispose();
  release();
  await effect.ready;
  await settle();

  assert.equal(effect.lifecycle, 'disposed');
  assert.equal(fake.state.renderers, 1);
  assert.ok(fake.balanced());
  host.remove();
});

test('removing the target disposes its attachment', async () => {
  const { host, target } = dom.mount();
  const fake = fakeAdapters();
  const effect = attachFireWithAdapters(target, { host }, fake.adapters);
  await effect.ready;

  target.remove();
  await settle();

  assert.equal(effect.lifecycle, 'disposed');
  assert.ok(fake.balanced());
  assert.equal(host.querySelector('canvas'), null);
  host.remove();
});

test('a disposal callback failure still finishes disposal', async () => {
  const { host, target } = dom.mount();
  const fake = fakeAdapters();
  const effect = attachFireWithAdapters(target, { host }, fake.adapters);
  await effect.ready;
  let later = 0;
  effect.onDispose(() => {
    throw new Error('callback');
  });
  effect.onDispose(() => (later += 1));

  assert.throws(() => effect.dispose(), AggregateError);
  assert.equal(effect.lifecycle, 'disposed');
  assert.equal(later, 1, 'later callbacks still run');
  assert.ok(fake.balanced());
  host.remove();
});
