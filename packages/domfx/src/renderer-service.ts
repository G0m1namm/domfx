import { GpuExperiment } from './gpu.js';

export type AttachmentRenderer = Pick<GpuExperiment, 'device' | 'prepare' | 'destroy'>;

interface ServiceEntry {
  owners: number;
  readonly ready: Promise<GpuExperiment>;
  renderer?: GpuExperiment;
}

const services = new WeakMap<Document, ServiceEntry>();

function retire(document: Document, entry: ServiceEntry) {
  // Old reservations can drain after an explicit attachment creates a new service.
  if (services.get(document) === entry) {
    services.delete(document);
  }
  entry.renderer?.destroy();
  entry.renderer = undefined;
}

/** Each acquisition owns one reference, including while initialization is pending. */
export async function acquireRenderer(document: Document): Promise<AttachmentRenderer> {
  let entry = services.get(document);
  if (!entry) {
    const created: ServiceEntry = {
      owners: 0,
      ready: GpuExperiment.create(document.defaultView?.navigator.gpu ?? null).then((renderer) => {
        created.renderer = renderer;
        // Retire immediately, even when a lease still owns non-cancellable work.
        void renderer.device.lost.then(() => retire(document, created));
        return renderer;
      }),
    };
    entry = created;
    services.set(document, entry);
  }
  const shared = entry;
  shared.owners += 1;
  let released = false;

  function release() {
    if (released) {
      return;
    }
    released = true;
    shared.owners -= 1;
    if (shared.owners === 0) {
      retire(document, shared);
    }
  }

  try {
    const renderer = await shared.ready;
    return {
      device: renderer.device,
      prepare: (frame) => renderer.prepare(frame),
      destroy: release,
    };
  } catch (error) {
    release();
    throw error;
  }
}
