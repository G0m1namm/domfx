import assert from 'node:assert/strict';
import test from 'node:test';

import { createEffectEnvironment, createEffectSlot } from '../src/effect-slot.ts';

const effect = { id: 'frost', exportName: 'attachFrost' };

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

function target(fonts = Promise.resolve(), images = []) {
  return {
    tagName: 'SPAN',
    ownerDocument: { fonts: { ready: fonts } },
    querySelectorAll: () => images,
    isConnected: true,
  };
}

function environment(initialReason) {
  let reason = initialReason;
  const listeners = new Set();
  return {
    blockedReason: () => reason,
    onChange(callback) {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
    emit(nextReason) {
      reason = nextReason;
      for (const listener of listeners) {
        listener();
      }
    },
    get subscribers() {
      return listeners.size;
    },
  };
}

function recordingLoader(ready = () => Promise.resolve()) {
  const handles = [];
  let loads = 0;
  return {
    handles,
    get loads() {
      return loads;
    },
    async load() {
      loads += 1;
      return (element, options) => {
        const handle = {
          target: element,
          options,
          time: options.time,
          intensity: options.intensity,
          lifecycle: 'active',
          reason: undefined,
          ready: ready(element),
          dispose() {
            this.lifecycle = 'disposed';
          },
        };
        handles.push(handle);
        return handle;
      };
    },
  };
}

function slotWith(loader, gate = environment()) {
  const host = { dataset: {} };
  const slot = createEffectSlot({ host, environment: gate, loader: loader.load });
  return { slot, host, gate };
}

const settle = () => new Promise((resolve) => setImmediate(resolve));

test('a slot exposes its effect only after readiness and releases it on clear', async () => {
  const ready = deferred();
  const loader = recordingLoader(() => ready.promise);
  const { slot, host } = slotWith(loader);
  const showing = slot.show(target(), effect, () => ({ clock: 'manual', time: 2.4 }));
  await settle();
  assert.equal(slot.handle, undefined);
  assert.equal(host.dataset.status, 'initializing');
  ready.resolve();
  await showing;
  assert.equal(slot.handle, loader.handles[0]);
  assert.equal(host.dataset.status, 'active');
  slot.clear();
  assert.equal(loader.handles[0].lifecycle, 'disposed');
  assert.equal(slot.handle, undefined);
  assert.equal(host.dataset.status, 'suspended');
  slot.dispose();
});

test('capture waits for fonts, the image target and descendant images', async () => {
  const fonts = deferred();
  const rootImage = deferred();
  const childImage = deferred();
  const element = target(fonts.promise, [{ decode: () => childImage.promise }]);
  element.tagName = 'IMG';
  element.decode = () => rootImage.promise;
  const loader = recordingLoader();
  const { slot } = slotWith(loader);
  const showing = slot.show(element, effect, () => ({}));
  await settle();
  assert.equal(loader.handles.length, 0);
  fonts.resolve();
  rootImage.resolve();
  await settle();
  assert.equal(loader.handles.length, 0);
  childImage.resolve();
  await showing;
  assert.equal(slot.handle.target, element);
  slot.dispose();
});

test('gates defer loading and hidden-page recovery uses fresh caller options', async () => {
  const gate = environment('reduced-motion');
  const loader = recordingLoader();
  const { slot, host } = slotWith(loader, gate);
  let time = 3;
  await slot.show(target(), effect, () => ({ clock: 'manual', time }));
  assert.equal(loader.loads, 0);
  assert.equal(host.dataset.status, 'unavailable');
  assert.equal(host.dataset.reason, 'reduced-motion');
  gate.emit(undefined);
  await settle();
  assert.equal(slot.handle.time, 3);
  const first = slot.handle;
  gate.emit('target-not-visible');
  assert.equal(first.lifecycle, 'disposed');
  assert.equal(slot.handle, undefined);
  assert.equal(host.dataset.status, 'suspended');
  time = 8.5;
  gate.emit(undefined);
  await settle();
  assert.notEqual(slot.handle, first);
  assert.equal(slot.handle.time, 8.5);
  assert.equal(host.dataset.status, 'active');
  assert.equal(host.dataset.reason, undefined);
  slot.dispose();
  assert.equal(gate.subscribers, 0);
});

test('replacement drops late loads, asset preparation and effect readiness', async () => {
  for (const stage of ['load', 'fonts', 'ready']) {
    const delay = deferred();
    const first = target(stage === 'fonts' ? delay.promise : Promise.resolve());
    const second = target();
    const loader = recordingLoader((element) =>
      stage === 'ready' && element === first ? delay.promise : Promise.resolve(),
    );
    let loads = 0;
    const { slot } = slotWith({
      load: async (...args) => {
        if (stage === 'load' && loads++ === 0) {
          await delay.promise;
        }
        return loader.load(...args);
      },
    });
    const obsolete = slot.show(first, effect, () => ({}));
    await settle();
    await slot.show(second, effect, () => ({}));
    const committed = slot.handle;
    delay.resolve();
    await obsolete;
    assert.equal(slot.handle, committed, stage);
    assert.equal(slot.handle.target, second, stage);
    assert.equal(
      loader.handles.filter((handle) => handle.lifecycle !== 'disposed').length,
      1,
      stage,
    );
    slot.dispose();
  }
});

test('clear and dispose cancel pending work and prevent later gate recovery', async () => {
  for (const operation of ['clear', 'dispose']) {
    const ready = deferred();
    const loader = recordingLoader(() => ready.promise);
    const { slot, gate } = slotWith(loader);
    const showing = slot.show(target(), effect, () => ({}));
    await settle();
    slot[operation]();
    assert.equal(loader.handles[0].lifecycle, 'disposed');
    ready.resolve();
    await showing;
    gate.emit('target-not-visible');
    gate.emit(undefined);
    await settle();
    assert.equal(slot.handle, undefined);
    assert.equal(loader.handles.length, 1);
    slot.dispose();
    slot.dispose();
    await slot.show(target(), effect, () => ({}));
    assert.equal(loader.handles.length, 1);
  }
});

test('callbacks cannot create or retain resources after clearing or disposing their slot', async () => {
  for (const operation of ['clear', 'dispose']) {
    for (const callback of ['options', 'factory']) {
      const ready = deferred();
      const loader = recordingLoader(() => ready.promise);
      const { slot } = slotWith({
        async load() {
          const factory = await loader.load();
          return (...args) => {
            if (callback === 'factory') {
              slot[operation]();
            }
            return factory(...args);
          };
        },
      });
      const showing = slot.show(target(), effect, () => {
        if (callback === 'options') {
          slot[operation]();
        }
        return {};
      });
      await settle();
      assert.equal(loader.handles.length, callback === 'options' ? 0 : 1);
      assert.ok(loader.handles.every((handle) => handle.lifecycle === 'disposed'));
      assert.equal(slot.handle, undefined);
      assert.equal(slot.status.lifecycle, 'suspended');
      ready.resolve();
      await showing;
      slot.dispose();
    }
  }
});

test('a failed image or initialization leaves other hosts usable', async () => {
  for (const failure of ['decode', 'load', 'ready']) {
    const loader = recordingLoader(() =>
      failure === 'ready' ? Promise.reject(new Error('private failure detail')) : Promise.resolve(),
    );
    const bad = slotWith({
      load:
        failure === 'load'
          ? async () => {
              throw new Error('module failed');
            }
          : loader.load,
    });
    const element = target();
    if (failure === 'decode') {
      element.tagName = 'IMG';
      element.decode = async () => {
        throw new Error('image failed');
      };
    }
    const good = slotWith(recordingLoader());
    await Promise.all([
      bad.slot.show(element, effect, () => ({})),
      good.slot.show(target(), effect, () => ({})),
    ]);
    assert.equal(bad.slot.handle, undefined);
    assert.equal(bad.host.dataset.status, 'unavailable');
    assert.equal(bad.host.dataset.reason, undefined);
    assert.equal(good.slot.status.lifecycle, 'active');
    assert.ok(loader.handles.every((handle) => handle.lifecycle === 'disposed'));
    bad.slot.dispose();
    good.slot.dispose();
  }
});

test('a reduced-motion latch survives hide/show until the caller clears it', async () => {
  const loader = recordingLoader();
  const { slot, gate, host } = slotWith(loader);
  await slot.show(target(), effect, () => ({}));
  gate.emit('reduced-motion');
  assert.equal(loader.handles[0].lifecycle, 'disposed');
  gate.emit('target-not-visible');
  gate.emit('reduced-motion');
  await settle();
  assert.equal(loader.handles.length, 1);
  assert.equal(host.dataset.reason, 'reduced-motion');
  gate.emit(undefined);
  await settle();
  assert.equal(slot.status.lifecycle, 'active');
  slot.dispose();
});

test('no WebGPU is unavailable without loading the browser package', async () => {
  const loader = recordingLoader();
  const { slot, host } = slotWith(loader, environment('no-webgpu'));
  await slot.show(target(), effect, () => ({}));
  assert.deepEqual(slot.status, { lifecycle: 'unavailable', reason: 'no-webgpu' });
  assert.equal(host.dataset.reason, 'no-webgpu');
  assert.equal(loader.loads, 0);
  slot.dispose();
});

test('a target removed during preparation cannot gain an effect layer', async () => {
  const fonts = deferred();
  const element = target(fonts.promise);
  const loader = recordingLoader();
  const { slot } = slotWith(loader);
  const showing = slot.show(element, effect, () => ({}));
  element.isConnected = false;
  fonts.resolve();
  await showing;
  assert.equal(loader.handles.length, 0);
  assert.deepEqual(slot.status, { lifecycle: 'suspended', reason: 'target-not-visible' });
  slot.dispose();
});

test('a gate that changes before its event arrives still prevents attachment', async () => {
  const fonts = deferred();
  let blocked = undefined;
  const gate = { blockedReason: () => blocked, onChange: () => () => {} };
  const loader = recordingLoader();
  const { slot } = slotWith(loader, gate);
  const showing = slot.show(target(fonts.promise), effect, () => ({}));
  blocked = 'target-not-visible';
  fonts.resolve();
  await showing;
  assert.equal(loader.handles.length, 0);
  assert.equal(slot.status.lifecycle, 'suspended');
  slot.dispose();
});

test('the browser environment combines visibility, motion and caller-owned Resume', () => {
  const document = new EventTarget();
  document.defaultView = { navigator: { gpu: {} } };
  document.hidden = false;
  const reducedMotion = new EventTarget();
  reducedMotion.matches = false;
  let needsResume = false;
  const gate = createEffectEnvironment({ document, reducedMotion, needsResume: () => needsResume });
  let changes = 0;
  const unsubscribe = gate.onChange(() => {
    changes += 1;
  });
  assert.equal(gate.blockedReason(), undefined);
  document.hidden = true;
  document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(gate.blockedReason(), 'target-not-visible');
  reducedMotion.matches = true;
  reducedMotion.dispatchEvent(new Event('change'));
  needsResume = true;
  document.hidden = false;
  reducedMotion.matches = false;
  gate.update();
  assert.equal(gate.blockedReason(), 'reduced-motion');
  needsResume = false;
  gate.update();
  assert.equal(gate.blockedReason(), undefined);
  assert.equal(changes, 4);
  unsubscribe();
  gate.update();
  document.dispatchEvent(new Event('visibilitychange'));
  reducedMotion.dispatchEvent(new Event('change'));
  assert.equal(changes, 4);
});
