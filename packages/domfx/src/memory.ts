import { EffectError } from './effect-error.js';

/** Managed textures/buffers, CPU pixels and one estimated RGBA output surface.
 * Browser capture intermediates, swapchain multiplicity and driver overhead are excluded.
 */
export function estimateFrameMemory(width: number, height: number) {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1) {
    throw new Error('invalid-frame');
  }
  const pixels = width * height;
  if (pixels > 1_000_000) {
    throw new EffectError('capture-budget');
  }
  return { managedBytes: pixels * 36 + 52, captureBytes: pixels * 4, outputBytes: pixels * 4 };
}

type FrameMemory = ReturnType<typeof estimateFrameMemory>;

export interface AllocationReservation {
  reconcile(memory: FrameMemory): void;
  release(): void;
}

/** Synchronous admission includes pending work and retained frames exactly once. */
export class AllocationLedger {
  private readonly entries = new Map<AllocationReservation, { owner: object; bytes: number }>();

  get bytes(): number {
    return [...this.entries.values()].reduce((sum, entry) => sum + entry.bytes, 0);
  }

  reserve(owner: object, memory: FrameMemory): AllocationReservation {
    let released = false;
    const reservation: AllocationReservation = {
      reconcile: (next) => {
        if (released) {
          throw new Error('reservation-released');
        }
        const values = Object.values(next);
        if (values.some((value) => !Number.isSafeInteger(value) || value < 0)) {
          throw new Error('invalid-frame-memory');
        }
        const bytes = values.reduce((sum, value) => sum + value, 0);
        // A pending capture must fit steady state after its CPU pixels are released.
        if (next.managedBytes + next.outputBytes > 48_000_000) {
          throw new EffectError('target-budget');
        }
        let targetBytes = bytes;
        let documentBytes = bytes;
        for (const [other, entry] of this.entries) {
          if (other !== reservation) {
            documentBytes += entry.bytes;
            if (entry.owner === owner) {
              targetBytes += entry.bytes;
            }
          }
        }
        if (targetBytes > 88_000_000) {
          throw new EffectError('target-budget');
        }
        if (documentBytes > 144_000_000) {
          throw new EffectError('aggregate-budget');
        }
        this.entries.set(reservation, { owner, bytes });
      },
      release: () => {
        if (!released) {
          released = true;
          this.entries.delete(reservation);
        }
      },
    };
    reservation.reconcile(memory);
    return reservation;
  }
}

const ledgers = new WeakMap<Document, AllocationLedger>();

export function memoryFor(document: Document): AllocationLedger {
  let ledger = ledgers.get(document);
  if (!ledger) {
    ledger = new AllocationLedger();
    ledgers.set(document, ledger);
  }
  return ledger;
}
