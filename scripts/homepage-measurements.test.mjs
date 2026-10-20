import assert from 'node:assert/strict';
import test from 'node:test';

import { distribution, validateHomepage, validateWindow } from './homepage-measurements.mjs';

const homepage = {
  surface: 'marketing',
  cards: 5,
  hidden: false,
  visibility: 'visible',
  reducedMotion: false,
  canvases: [{ width: 100, height: 100 }],
  header: { status: 'active', canvases: 1 },
  visiblePreviews: [],
};

test('collection rejects a wrong page, hidden window and unavailable live output', () => {
  validateHomepage(homepage, 'effects');
  for (const changes of [
    { surface: 'library' },
    { cards: 0 },
    { hidden: true },
    { visibility: 'hidden' },
    { reducedMotion: true },
    { header: { status: 'unavailable', canvases: 0 } },
    { visiblePreviews: [{ status: 'initializing', canvases: 0 }] },
  ]) {
    assert.throws(() => validateHomepage({ ...homepage, ...changes }, 'effects'));
  }
});

test('static collection cannot silently retain a live canvas', () => {
  const state = { ...homepage, header: { reason: 'no-webgpu' }, canvases: [] };
  validateHomepage(state, 'capability-static');
  assert.throws(() =>
    validateHomepage({ ...state, canvases: homepage.canvases }, 'capability-static'),
  );
  assert.throws(() => validateHomepage({ ...state, header: {} }, 'capability-static'));
});

test('trial statistics retain nearest-rank tails and never invent empty samples', () => {
  assert.deepEqual(distribution([100, 1, 5, 3]), { n: 4, p50: 3, p95: 100, max: 100 });
  assert.deepEqual(distribution([]), { n: 0, p50: null, p95: null, max: null });
});

test('background transitions, empty and truncated windows cannot enter distributions', () => {
  const window = { frames: [16, 17], elapsedMs: 1501, visibilityChanges: 0, hidden: false };
  validateWindow(window, 1500);
  for (const changes of [
    { frames: [] },
    { frames: [NaN] },
    { frames: [-1] },
    { elapsedMs: 1499 },
    { visibilityChanges: 1 },
    { hidden: true },
  ]) {
    const attempted = { ...window, ...changes };
    const before = { visibility: 'visible' };
    assert.throws(
      () => validateWindow(attempted, 1500, { label: 'steady-home', before }),
      (error) => {
        assert.equal(error.measurement.timing, attempted);
        assert.equal(error.measurement.before, before);
        assert.equal(error.measurement.label, 'steady-home');
        assert.equal(error.measurement.outcome, 'failed');
        return true;
      },
    );
  }
});
