/** Refuse to label a partial or unrelated page as a collected homepage baseline. */
export function validateHomepage(state, control) {
  if (
    state.surface !== 'marketing' ||
    state.cards !== 5 ||
    state.hidden ||
    state.visibility !== 'visible' ||
    state.reducedMotion
  ) {
    throw new Error('Expected the visible five-card homepage with reduced motion off');
  }
  if (control === 'effects') {
    const hosts = [state.header, ...state.visiblePreviews];
    if (hosts.some((host) => host.status !== 'active' || host.canvases !== 1)) {
      throw new Error('A visible effect host did not finish initialization');
    }
  } else if (state.canvases.length || state.header.reason !== 'no-webgpu') {
    throw new Error('The diagnostic static control must have no WebGPU output');
  }
}

export function distribution(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const rank = (fraction) => sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)] ?? null;
  return { n: sorted.length, p50: rank(0.5), p95: rank(0.95), max: sorted.at(-1) ?? null };
}

export function validateWindow(window, durationMs, state = {}) {
  if (
    window.hidden ||
    window.visibilityChanges ||
    window.elapsedMs < durationMs ||
    !window.frames.length ||
    window.frames.some((value) => !Number.isFinite(value) || value <= 0)
  ) {
    throw Object.assign(
      new Error('Incomplete or backgrounded timing window; exclude it from comparisons'),
      { measurement: { ...state, timing: window, outcome: 'failed' } },
    );
  }
}
