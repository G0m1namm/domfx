export function candidateGate(values, required, limitMs, statistic, eligible = true) {
  const valid = values.filter((value) => Number.isFinite(value) && value >= 0);
  const sorted = [...valid].sort((a, b) => a - b);
  const measuredMs = sorted.length
    ? statistic === 'max'
      ? sorted.at(-1)
      : sorted[Math.ceil(sorted.length * 0.95) - 1]
    : null;
  const complete = eligible && valid.length === required && valid.length === values.length;
  const status =
    measuredMs !== null && measuredMs > limitMs ? 'fail' : complete ? 'pass' : 'untested';
  return {
    status,
    held: status !== 'pass',
    statistic,
    limitMs,
    measuredMs,
    requiredSamples: required,
    recordedSamples: values.length,
    complete,
  };
}

export function summarizeCondition(runs) {
  const clean = runs.every((run) => run.report?.outcome === 'complete' && !run.errors.length);
  const warm = runs.find((run) => run.warm)?.report;
  return {
    initialization: candidateGate(
      runs.flatMap((run) =>
        run.report?.initialization ? [run.report.initialization.totalMs] : [],
      ),
      5,
      2000,
      'max',
      clean,
    ),
    rebuild: candidateGate(
      warm?.rebuilds.map((sample) => sample.totalMs) ?? [],
      30,
      300,
      'p95-nearest-rank',
      clean && warm?.warmups.length === 3,
    ),
  };
}
