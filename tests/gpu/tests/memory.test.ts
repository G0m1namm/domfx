import assert from 'node:assert/strict';
import { test } from 'node:test';

import { AllocationLedger, estimateFrameMemory } from '@domfx/browser/experimental';

const bytes = (managedBytes: number, captureBytes = 0, outputBytes = 0) => ({
  managedBytes,
  captureBytes,
  outputBytes,
});

test('capture and decimal target boundaries include output and retained replacements', () => {
  assert.deepEqual(estimateFrameMemory(1000, 1000), bytes(36_000_084, 4_000_000, 4_000_000));
  assert.throws(() => estimateFrameMemory(1001, 1000), /capture-budget/);
  const ledger = new AllocationLedger();
  const owner = {};
  const old = ledger.reserve(owner, bytes(44_000_000, 0, 4_000_000));
  assert.throws(() => old.reconcile(bytes(44_000_001, 0, 4_000_000)), /target-budget/);
  const replacement = ledger.reserve(owner, bytes(36_000_000, 0, 4_000_000));
  assert.equal(ledger.bytes, 88_000_000);
  assert.throws(() => replacement.reconcile(bytes(36_000_000, 1, 4_000_000)), /target-budget/);
  assert.equal(ledger.bytes, 88_000_000);
  old.release();
  old.release();
  assert.equal(ledger.bytes, 40_000_000);
  replacement.release();
  assert.equal(ledger.bytes, 0);
});

test('document admission and reconciliation are atomic and include pending work', async () => {
  const ledger = new AllocationLedger();
  const reservations = await Promise.all(
    Array.from({ length: 3 }, async () => ledger.reserve({}, bytes(48_000_000))),
  );
  assert.equal(ledger.bytes, 144_000_000);
  assert.throws(() => ledger.reserve({}, bytes(1)), /aggregate-budget/);
  assert.equal(ledger.bytes, 144_000_000);
  reservations[0].reconcile(bytes(47_999_999));
  const last = ledger.reserve({}, bytes(1));
  assert.throws(() => last.reconcile(bytes(2)), /aggregate-budget/);
  assert.equal(ledger.bytes, 144_000_000);
  last.release();
  reservations.forEach((reservation) => reservation.release());
  assert.equal(ledger.bytes, 0);
  assert.throws(() => last.reconcile(bytes(1)), /reservation-released/);
});

test('capture reconciliation replaces estimates and release removes only its own entry', () => {
  const ledger = new AllocationLedger();
  const a = ledger.reserve({}, estimateFrameMemory(1000, 1000));
  const b = ledger.reserve({}, estimateFrameMemory(1000, 1000));
  a.reconcile(estimateFrameMemory(500, 500));
  assert.equal(ledger.bytes, 55_000_168);
  a.reconcile({ ...estimateFrameMemory(500, 500), captureBytes: 0 });
  assert.equal(ledger.bytes, 54_000_168);
  a.release();
  assert.equal(ledger.bytes, 44_000_084);
  b.release();
  assert.equal(ledger.bytes, 0);
});
