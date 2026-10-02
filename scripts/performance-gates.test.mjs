import assert from 'node:assert/strict';
import test from 'node:test';

import { candidateGate, summarizeCondition } from '../tests/gpu/scripts/performance-gates.mjs';

test('cold gate requires all five samples at the unchanged 2000 ms limit', () => {
  assert.equal(candidateGate([100, 200, 300, 400, 2000], 5, 2000, 'max').status, 'pass');
  assert.equal(candidateGate([100, 200, 300, 400, 2001], 5, 2000, 'max').status, 'fail');
  assert.equal(candidateGate([2001], 5, 2000, 'max').held, true);
  for (const samples of [[], [1, 2, 3, 4], [1, 2, 3, 4, NaN], [1, 2, 3, 4, -1]]) {
    assert.equal(candidateGate(samples, 5, 2000, 'max').status, 'untested');
  }
});

test('warm P95 is the 29th ordered value, with an inclusive 300 ms limit', () => {
  const samples = [...Array(28).fill(10), 300, 9000].reverse();
  const gate = candidateGate(samples, 30, 300, 'p95-nearest-rank');
  assert.equal(gate.measuredMs, 300);
  assert.equal(gate.status, 'pass');
  samples[1] = 301;
  assert.equal(candidateGate(samples, 30, 300, 'p95-nearest-rank').status, 'fail');
});

test('incomplete warmups, failed fixtures and browser errors cannot pass', () => {
  const runs = Array.from({ length: 5 }, (_, i) => ({
    warm: i === 4,
    errors: [],
    report: {
      outcome: 'complete',
      initialization: { totalMs: 100 },
      warmups: Array(3).fill({ totalMs: 9000 }),
      rebuilds: Array(30).fill({ totalMs: 10 }),
    },
  }));
  assert.equal(summarizeCondition(runs).rebuild.status, 'pass');
  runs[4].report.warmups.pop();
  assert.equal(summarizeCondition(runs).rebuild.status, 'untested');
  runs[0].errors.push('browser error');
  assert.equal(summarizeCondition(runs).initialization.status, 'untested');
  runs[0].errors = [];
  runs[0].report.outcome = 'unavailable';
  assert.equal(summarizeCondition(runs).initialization.held, true);
  assert.equal(summarizeCondition([]).initialization.status, 'untested');
  assert.equal(summarizeCondition([]).rebuild.status, 'untested');
});
