import { candidateGate } from './performance-gates.mjs';

const p95 = (values) =>
  candidateGate(values, values.length, Infinity, 'p95-nearest-rank').measuredMs;

function steadyGate(values, limitMs, eligible, applicable) {
  const gate = candidateGate(values, 5, limitMs, 'max', eligible);
  return {
    ...gate,
    applicable,
    observedLimitExceeded: gate.measuredMs !== null && gate.measuredMs > limitMs,
    status: applicable ? gate.status : 'untested',
    held: !applicable || gate.held,
  };
}

export function summarizeSteady(runs, refreshRate) {
  const report = runs[0]?.report;
  const trials = report?.trials ?? [];
  const clean =
    runs.length === 1 &&
    !runs[0].errors.length &&
    report?.outcome === 'complete' &&
    report.visibilityChanges === 0 &&
    report.managedBytesAfterCleanup === 0 &&
    report.preparedCount === report.targets &&
    trials.length === 5 &&
    trials.every(
      (trial) =>
        trial.active &&
        trial.durationMs >= 2000 &&
        trial.rafMs.length > 1 &&
        trial.cpuSubmitMs.length > 0 &&
        trial.renderedFrames.length === report.targets &&
        trial.renderedFrames.every((count) => count === trial.cpuSubmitMs.length),
    );
  const timestamps = report?.timestampQuery === true;
  const gpuSamplesValid = trials.every(
    (trial) =>
      trial.gpuMs.length === trial.cpuSubmitMs.length &&
      trial.gpuMs.every((value) => Number.isFinite(value) && value >= 0) &&
      trial.timestampPairsNs.length === trial.gpuMs.length * report.targets,
  );
  // Each trial must meet its P95; a pooled statistic must not hide a bad trial.
  const gpu = steadyGate(
    trials.map((trial) => p95(trial.gpuMs)),
    6,
    clean && gpuSamplesValid,
    timestamps && report.targets > 0,
  );
  const raf = steadyGate(
    trials.map((trial) => p95(trial.rafMs)),
    20,
    clean,
    !timestamps && refreshRate === '60' && report?.longTaskObserver === true,
  );
  const longTask = steadyGate(
    trials.map((trial) => Math.max(0, ...trial.longTasks.map((entry) => entry.duration))),
    50,
    clean,
    !timestamps && refreshRate === '60' && report?.longTaskObserver === true,
  );
  const status = timestamps
    ? report.targets === 0
      ? clean
        ? 'pass'
        : 'untested'
      : gpu.status
    : [raf, longTask].some((gate) => gate.status === 'fail')
      ? 'fail'
      : [raf, longTask].every((gate) => gate.status === 'pass')
        ? 'pass'
        : 'untested';
  return {
    status,
    held: status !== 'pass',
    method: timestamps
      ? 'GPU render timestamps (no-effect baseline submits no GPU work)'
      : 'responsiveness, not GPU time; requires operator-recorded 60 Hz',
    gpu,
    raf,
    longTask,
    statistics: {
      gpuP95Ms: p95(trials.flatMap((trial) => trial.gpuMs)),
      rafP95Ms: p95(trials.flatMap((trial) => trial.rafMs)),
      cpuSubmitP95Ms: p95(trials.flatMap((trial) => trial.cpuSubmitMs)),
      maximumLongTaskMs: Math.max(
        0,
        ...trials.flatMap((trial) => trial.longTasks.map((entry) => entry.duration)),
      ),
    },
  };
}

export function compareSteady(conditions) {
  const baseline = conditions.find((condition) => condition.targets === 0)?.gates;
  return conditions
    .filter((condition) => condition.targets > 0)
    .map(({ targets, gates }) => ({
      targets,
      eligible: baseline?.status === 'pass' && gates.status === 'pass',
      rafP95DeltaMs:
        Number.isFinite(baseline?.statistics.rafP95Ms) && Number.isFinite(gates.statistics.rafP95Ms)
          ? gates.statistics.rafP95Ms - baseline.statistics.rafP95Ms
          : null,
      cpuSubmitP95DeltaMs:
        Number.isFinite(baseline?.statistics.cpuSubmitP95Ms) &&
        Number.isFinite(gates.statistics.cpuSubmitP95Ms)
          ? gates.statistics.cpuSubmitP95Ms - baseline.statistics.cpuSubmitP95Ms
          : null,
      gpuRenderP95Ms: gates.statistics.gpuP95Ms,
      note: 'Signed effect-minus-baseline deltas; positive values are added cost. No-effect submits no render passes; its GPU duration is unmeasured, not a fabricated timestamp sample. Thresholds are unchanged.',
    }));
}
