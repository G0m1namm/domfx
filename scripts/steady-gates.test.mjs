import assert from 'node:assert/strict';
import test from 'node:test';

import { compareSteady, summarizeSteady } from '../tests/gpu/scripts/steady-gates.mjs';

function fixture(timestampQuery = true, targets = 2) {
  return [
    {
      errors: [],
      report: {
        outcome: 'complete',
        targets,
        timestampQuery,
        longTaskObserver: true,
        visibilityChanges: 0,
        managedBytesAfterCleanup: 0,
        preparedCount: targets,
        trials: Array.from({ length: 5 }, () => ({
          active: true,
          durationMs: 2000,
          rafMs: Array(120).fill(20),
          cpuSubmitMs: Array(119).fill(1),
          renderedFrames: Array(targets).fill(119),
          gpuMs: timestampQuery && targets ? Array(119).fill(6) : [],
          timestampPairsNs:
            timestampQuery && targets ? Array(119 * targets).fill(['1', '6000001']) : [],
          longTasks: [{ duration: 50 }],
        })),
      },
    },
  ];
}

test('GPU gate applies inclusive 6 ms to every trial and retains regressions', () => {
  const runs = fixture();
  assert.equal(summarizeSteady(runs).status, 'pass');
  runs[0].report.trials[4].gpuMs.fill(6.01);
  assert.equal(summarizeSteady(runs).status, 'fail');
  runs[0].report.trials.pop();
  assert.equal(summarizeSteady(runs).status, 'untested');
});

test('fallback needs five active trials, long-task observation and explicit 60 Hz', () => {
  const runs = fixture(false);
  assert.equal(summarizeSteady(runs).status, 'untested');
  assert.equal(summarizeSteady(runs, '120').status, 'untested');
  assert.equal(summarizeSteady(runs, '60').status, 'pass');
  runs[0].report.trials[0].longTasks[0].duration = 50.01;
  assert.equal(summarizeSteady(runs, '60').status, 'fail');
  runs[0].report.trials[0].longTasks = [];
  runs[0].report.trials[0].rafMs.fill(20.01);
  assert.equal(summarizeSteady(runs, '60').status, 'fail');
  const unknownDisplay = summarizeSteady(runs);
  assert.equal(unknownDisplay.status, 'untested');
  assert.equal(unknownDisplay.raf.observedLimitExceeded, true);
});

test('missing, suspended, partial, invalid and errored evidence stays held', () => {
  assert.equal(summarizeSteady([]).status, 'untested');
  for (const mutate of [
    (run) => {
      run.errors.push('GPU error');
    },
    (run) => {
      run.report.visibilityChanges = 1;
    },
    (run) => {
      run.report.trials[0].active = false;
    },
    (run) => {
      run.report.trials[0].durationMs = 1999;
    },
    (run) => {
      run.report.trials[0].renderedFrames[0] = 0;
    },
    (run) => {
      run.report.trials[0].gpuMs[0] = NaN;
    },
    (run) => {
      run.report.trials[0].timestampPairsNs.pop();
    },
    (run) => {
      run.report.preparedCount += 1;
    },
  ]) {
    const runs = fixture();
    mutate(runs[0]);
    assert.equal(summarizeSteady(runs).held, true);
  }
  const fallback = fixture(false);
  fallback[0].report.longTaskObserver = false;
  assert.equal(summarizeSteady(fallback, '60').status, 'untested');
});

test('baseline has no invented GPU samples and comparisons preserve signed overhead', () => {
  const baseline = summarizeSteady(fixture(true, 0));
  assert.equal(baseline.status, 'pass');
  assert.equal(baseline.statistics.gpuP95Ms, null);
  const effect = fixture();
  effect[0].report.trials.forEach((trial) => trial.cpuSubmitMs.fill(2));
  const comparison = compareSteady([
    { targets: 0, gates: baseline },
    { targets: 2, gates: summarizeSteady(effect) },
  ])[0];
  assert.equal(comparison.eligible, true);
  assert.equal(comparison.cpuSubmitP95DeltaMs, 1);
});
