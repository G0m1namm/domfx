import assert from 'node:assert/strict';
import test from 'node:test';

import { initializePage } from '../src/page-lifetime.ts';

test('pagehide releases once and persisted pageshow creates a fresh page lifetime', () => {
  const window = new EventTarget();
  let starts = 0;
  let stops = 0;
  const dispose = initializePage(() => {
    starts += 1;
    return () => {
      stops += 1;
    };
  }, window);
  const show = (persisted) =>
    window.dispatchEvent(Object.assign(new Event('pageshow'), { persisted }));
  show(false);
  assert.equal(starts, 1);
  window.dispatchEvent(new Event('pagehide'));
  window.dispatchEvent(new Event('pagehide'));
  assert.equal(stops, 1);
  show(true);
  assert.equal(starts, 2);
  show(true);
  assert.equal(starts, 2);
  dispose();
  assert.equal(stops, 2);
  show(true);
  window.dispatchEvent(new Event('pagehide'));
  assert.equal(starts, 2);
  assert.equal(stops, 2);
});
