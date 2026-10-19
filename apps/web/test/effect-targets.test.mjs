import assert from 'node:assert/strict';
import test from 'node:test';

import { createEffectTargetSession } from '../src/scripts/effect-targets.ts';

globalThis.innerHeight = 1000;
globalThis.innerWidth = 1440;
globalThis.getComputedStyle = () => ({ visibility: 'visible' });

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

function element(id) {
  const host = {};
  const bounds = { width: 100, height: 100, top: 200, bottom: 300, left: 20, right: 120 };
  return {
    id,
    bounds,
    closest: () => host,
    getBoundingClientRect: () => bounds,
  };
}

function settings(overrides = {}) {
  return {
    effect: 'fire',
    paused: false,
    reduced: false,
    needsResume: false,
    hasGpu: true,
    hidden: false,
    intensity: 0.7,
    flameHeight: 32,
    speed: 1,
    loop: false,
    rangeStart: 0,
    rangeEnd: 10,
    ...overrides,
  };
}

function recorder(
  elements,
  initial = settings(),
  prepare = async () => {},
  ready = () => Promise.resolve(),
  mount = createEffectTargetSession(),
) {
  const records = [];
  let changes = 0;
  const effects = mount(elements, initial, () => changes++, {
    load: async () => (target, options) => {
      const record = {
        id: target.id,
        time: options.time,
        intensity: options.intensity,
        flameHeight: options.flameHeight,
        lifecycle: 'active',
        reason: undefined,
        reasonDetail: undefined,
        ready: ready(target),
        dispose() {
          this.lifecycle = 'disposed';
        },
      };
      records.push(record);
      return record;
    },
    prepare,
  });
  return { effects, records, changes: () => changes };
}

async function settle() {
  await new Promise((resolve) => setImmediate(resolve));
}

test('each target keeps its own lifetime while sharing speed, repeat and retained time', async () => {
  const image = element('example-image');
  const link = element('scroll-target');
  const { effects, records } = recorder([image, link]);
  effects.refreshLayout();
  await settle();
  assert.equal(records.length, 2);
  effects.tick(1000);
  effects.tick(1500);
  assert.equal(records[0].time, 0.5);
  assert.equal(records[1].time, 0.5);

  effects.configure(settings({ speed: 0.5, loop: true, rangeStart: 2, rangeEnd: 2.2 }));
  effects.tick(2000);
  effects.tick(2300);
  assert.ok(Math.abs(records[0].time - 2.15) < 0.0001);
  assert.ok(Math.abs(records[1].time - 2.15) < 0.0001);

  link.bounds.top = 1200;
  link.bounds.bottom = 1300;
  effects.refreshLayout();
  assert.equal(records[0].lifecycle, 'active');
  assert.equal(records[1].lifecycle, 'disposed');
  link.bounds.top = 200;
  link.bounds.bottom = 300;
  effects.refreshLayout();
  await settle();
  assert.equal(records[2].id, 'scroll-target');
  assert.equal(records[2].time, records[0].time);
  effects.dispose();
  assert.equal(records[0].lifecycle, 'disposed');
  assert.equal(records[2].lifecycle, 'disposed');
});

test('a persisted page recreates attachments at the retained Fire time without a hidden-time jump', async () => {
  const mount = createEffectTargetSession();
  const target = element('example-image');
  const first = recorder(
    [target],
    settings(),
    async () => {},
    () => Promise.resolve(),
    mount,
  );
  first.effects.refreshLayout();
  await settle();
  first.effects.tick(1000);
  first.effects.tick(1500);
  assert.equal(first.records[0].time, 0.5);
  first.effects.dispose();

  const restored = recorder(
    [target],
    settings(),
    async () => {},
    () => Promise.resolve(),
    mount,
  );
  restored.effects.refreshLayout();
  await settle();
  assert.equal(restored.records[0].time, 0.5);
  restored.effects.tick(9000);
  assert.equal(restored.records[0].time, 0.5);
  restored.effects.tick(9100);
  assert.ok(Math.abs(restored.records[0].time - 0.6) < 0.0001);
  restored.effects.dispose();
});

test('continuous intensity and speed inputs do not stall active Fire playback', async () => {
  const { effects, records } = recorder([element('example-image')]);
  effects.refreshLayout();
  await settle();
  effects.tick(1000);
  effects.tick(1500);
  effects.configure(settings({ intensity: 0.8 }));
  effects.tick(1600);
  effects.configure(settings({ intensity: 0.8, speed: 2 }));
  effects.tick(1700);
  effects.configure(settings({ intensity: 0.9, speed: 2 }));
  effects.tick(1800);
  assert.ok(Math.abs(records[0].time - 1) < 0.0001);
  assert.equal(records[0].intensity, 0.9);
  effects.dispose();
});

test('replacement and delayed preparation reject obsolete work', async () => {
  const target = element('example-image');
  const gate = deferred();
  let preparations = 0;
  const { effects, records } = recorder([target], settings(), () => {
    preparations += 1;
    return preparations === 1 ? gate.promise : Promise.resolve();
  });
  effects.refreshLayout();
  assert.equal(effects.status().loading, true);
  effects.configure(settings({ flameHeight: 24 }));
  await settle();
  assert.equal(records.length, 1);
  assert.equal(records[0].flameHeight, 24);
  gate.resolve();
  await settle();
  assert.equal(records.length, 1);
  effects.configure(settings({ effect: 'none', flameHeight: 24 }));
  assert.equal(records[0].lifecycle, 'disposed');
  effects.configure(settings({ flameHeight: 24, paused: true }));
  await settle();
  assert.equal(records[1].time, records[0].time);
  assert.equal(records[1].lifecycle, 'active');
  effects.dispose();
});

test('late attachment readiness, reduced motion and teardown never revive released effects', async () => {
  const target = element('example-image');
  const ready = deferred();
  const { effects, records, changes } = recorder(
    [target],
    settings(),
    async () => {},
    () => ready.promise,
  );
  effects.refreshLayout();
  await settle();
  // Replacement and suppression dispose pending handles before readiness settles.
  effects.configure(settings({ flameHeight: 24 }));
  await settle();
  effects.configure(settings({ flameHeight: 24, reduced: true, needsResume: true }));
  assert.equal(records[1].lifecycle, 'disposed');
  effects.configure(settings({ flameHeight: 24, needsResume: true }));
  assert.equal(records.length, 2);
  effects.configure(settings({ flameHeight: 24 }));
  await settle();
  assert.equal(records.length, 3);
  effects.configure(settings({ flameHeight: 24, hidden: true }));
  assert.equal(records[2].lifecycle, 'disposed');
  effects.dispose();
  const before = changes();
  ready.resolve();
  await settle();
  assert.equal(changes(), before);
  assert.equal(
    records.every((record) => record.lifecycle === 'disposed'),
    true,
  );
});

test('one failed preparation leaves the other target active', async () => {
  const bad = element('example-image');
  const good = element('example-svg');
  const original = console.error;
  console.error = () => {};
  try {
    const { effects, records } = recorder([bad, good], settings(), (target) =>
      target.id === 'example-image'
        ? Promise.reject(new Error('decode failed'))
        : Promise.resolve(),
    );
    effects.refreshLayout();
    await settle();
    assert.equal(effects.status().failed, true);
    assert.equal(records.length, 1);
    assert.equal(records[0].id, 'example-svg');
    assert.equal(records[0].lifecycle, 'active');
    effects.dispose();
  } finally {
    console.error = original;
  }
});
