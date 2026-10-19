import assert from 'node:assert/strict';
import test from 'node:test';

import { diagnosticsFor, startEffectDiagnostics } from '../src/diagnostics.js';

test('diagnostics are opt-in, bounded, opaque and disposed with their timing entries', () => {
  const target = {} as Element;
  assert.equal(diagnosticsFor(target, 'fire'), undefined);
  const session = startEffectDiagnostics({ capacity: 3, userTiming: true });
  try {
    const fire = diagnosticsFor(target, 'fire')!;
    const frost = diagnosticsFor({} as Element, 'frost')!;
    fire(1, 'capture', 'start');
    fire(1, 'capture', 'end');
    fire(1, 'revision', 'drop');
    frost(2, 'revision', 'commit');
    const records = session.records;
    assert.equal(records.length, 3);
    assert.equal(records[0].phase, 'end');
    assert.equal(records[0].target, records[1].target);
    assert.notEqual(records[1].target, records[2].target);
    assert.deepEqual(Object.keys(records[0]).sort(), [
      'at',
      'effect',
      'phase',
      'revision',
      'stage',
      'target',
    ]);
    assert.equal(
      performance.getEntriesByType('mark').filter((entry) => entry.name.startsWith('domfx:'))
        .length,
      3,
    );
    assert.throws(() => startEffectDiagnostics(), /already-active/);
    session.dispose();
    fire(3, 'revision', 'commit');
    assert.equal(session.records.length, 0);
    assert.equal(
      performance.getEntriesByType('mark').filter((entry) => entry.name.startsWith('domfx:'))
        .length,
      0,
    );
    assert.equal(diagnosticsFor(target, 'fire'), undefined);
    session.dispose();
  } finally {
    session.dispose();
  }
});
