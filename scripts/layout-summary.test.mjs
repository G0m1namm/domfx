import assert from 'node:assert/strict';
import test from 'node:test';

import { distribution, metricDelta, traceActivity } from '../tests/gpu/scripts/layout-summary.mjs';

test('frame distributions retain outliers and absent measurements', () => {
  assert.deepEqual(distribution([]), { count: 0, p50: null, p95: null, p99: null, max: null });
  assert.deepEqual(distribution([100, ...Array(19).fill(10)]), {
    count: 20,
    p50: 10,
    p95: 10,
    p99: 100,
    max: 100,
  });
});

test('metrics keep signed heap changes and do not fabricate missing baselines', () => {
  assert.deepEqual(
    metricDelta(
      { metrics: [{ name: 'heap', value: 100 }] },
      {
        metrics: [
          { name: 'heap', value: 80 },
          { name: 'new', value: 9 },
        ],
      },
    ),
    { heap: -20, new: null },
  );
});

test('trace summary excludes other threads and nested GC phases', () => {
  const slice = (name, dur, tid = 2, ts = 1000) => ({ name, dur, pid: 1, tid, ph: 'X', ts });
  const summary = traceActivity([
    { name: 'domfx-layout-start', pid: 1, tid: 2, ts: 1000 },
    { name: 'domfx-layout-end', pid: 1, tid: 2, ts: 5000 },
    slice('Layout', 2000),
    slice('Layout', 9000, 3),
    slice('MinorGC', 3000),
    slice('V8.GC_SCAVENGER', 2000),
    slice('MajorGC', 500, 2, 0),
    slice('MajorGC', 500, 2, 5000),
  ]);
  assert.equal(summary.Layout.totalMs, 2);
  assert.equal(summary.MinorGC.totalMs, 3);
  assert.equal(summary.MajorGC.count, 0);
  assert.equal(traceActivity([]).Layout.availability, 'trial trace markers unavailable');
});
