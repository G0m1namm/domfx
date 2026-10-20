import type { RenderEffect } from './effect-programs.js';

export type DiagnosticStage = 'renderer' | 'capture' | 'prepare' | 'revision' | 'presentation';
export type DiagnosticPhase = 'start' | 'end' | 'commit' | 'drop' | 'error';
export interface EffectDiagnostic {
  readonly effect: RenderEffect;
  /** Opaque session-local identity, never DOM text, selectors or attributes. */
  readonly target: number;
  readonly revision: number;
  readonly stage: DiagnosticStage;
  readonly phase: DiagnosticPhase;
  /** CPU monotonic milliseconds; presentation means submission, not GPU completion. */
  readonly at: number;
}

export type DiagnosticTrace = (
  revision: number,
  stage: DiagnosticStage,
  phase: DiagnosticPhase,
) => void;

let active:
  | {
      trace(target: Element, effect: RenderEffect): DiagnosticTrace;
    }
  | undefined;

/** Opt-in local debugging seam. One bounded session; no frame-by-frame records. */
export function startEffectDiagnostics(options: { capacity?: number; userTiming?: boolean } = {}) {
  const capacity = options.capacity ?? 128;
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 4096) {
    throw new Error('invalid-diagnostic-capacity');
  }
  if (active) {
    throw new Error('diagnostics-already-active');
  }
  const records: EffectDiagnostic[] = [];
  const marks: string[] = [];
  const targets = new WeakMap<Element, number>();
  let nextTarget = 0;
  let nextMark = 0;
  let disposed = false;
  const session = {
    trace(target: Element, effect: RenderEffect): DiagnosticTrace {
      let identity = targets.get(target);
      if (identity === undefined) {
        identity = ++nextTarget;
        targets.set(target, identity);
      }
      const id = identity;
      return (revision, stage, phase) => {
        if (disposed) {
          return;
        }
        const record: EffectDiagnostic = {
          effect,
          target: id,
          revision,
          stage,
          phase,
          at: performance.now(),
        };
        records.push(record);
        if (records.length > capacity) {
          records.shift();
        }
        if (options.userTiming) {
          const name = `domfx:${effect}:${id}:${revision}:${stage}:${phase}:${++nextMark}`;
          performance.mark(name, { detail: record });
          marks.push(name);
          if (marks.length > capacity) {
            performance.clearMarks(marks.shift());
          }
        }
      };
    },
  };
  active = session;
  return {
    /** Snapshot, so consumers cannot grow or mutate retained storage. */
    get records(): readonly EffectDiagnostic[] {
      return records.map((record) => ({ ...record }));
    },
    dispose() {
      if (disposed) {
        return;
      }
      disposed = true;
      active = undefined;
      for (const name of marks) {
        performance.clearMarks(name);
      }
      marks.length = 0;
      records.length = 0;
    },
  };
}

/** Disabled instrumentation allocates nothing and never reads the clock. */
export function diagnosticsFor(target: Element, effect: RenderEffect): DiagnosticTrace | undefined {
  return active?.trace(target, effect);
}
