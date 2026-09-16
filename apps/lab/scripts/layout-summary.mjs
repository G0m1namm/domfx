export function distribution(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const rank = (fraction) => sorted[Math.ceil(sorted.length * fraction) - 1] ?? null;
  return {
    count: sorted.length,
    p50: rank(0.5),
    p95: rank(0.95),
    p99: rank(0.99),
    max: sorted.at(-1) ?? null,
  };
}

export function metricDelta(before, after) {
  return Object.fromEntries(
    after.metrics.map(({ name, value }) => {
      const previous = before.metrics.find((metric) => metric.name === name);
      return [name, previous ? value - previous.value : null];
    }),
  );
}

export function traceActivity(events) {
  // Select the renderer main thread. Never sum nested GC phases as independent pauses.
  const start = events.find((event) => event.name === 'domfx-layout-start');
  const end = events.find((event) => event.name === 'domfx-layout-end');
  const selected = events.filter(
    (event) =>
      start &&
      end &&
      event.pid === start.pid &&
      event.tid === start.tid &&
      event.ph === 'X' &&
      event.ts < end.ts &&
      event.ts + event.dur > start.ts,
  );
  return Object.fromEntries(
    ['Layout', 'UpdateLayoutTree', 'MinorGC', 'MajorGC'].map((name) => {
      const durations = selected
        .filter((event) => event.name === name)
        .map(
          (event) => (Math.min(event.ts + event.dur, end.ts) - Math.max(event.ts, start.ts)) / 1000,
        );
      return [
        name,
        {
          ...distribution(durations),
          totalMs: durations.reduce((sum, duration) => sum + duration, 0),
          availability:
            start && end
              ? 'observed trace events; empty does not prove absence of work'
              : 'trial trace markers unavailable',
        },
      ];
    }),
  );
}
