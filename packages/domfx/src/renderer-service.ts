import { GpuExperiment } from './gpu.js';

export type AttachmentRenderer = Pick<GpuExperiment, 'device' | 'prepare' | 'destroy'>;

interface ServiceEntry {
  owners: number;
  readonly ready: Promise<GpuExperiment>;
  renderer?: GpuExperiment;
}

const services = new WeakMap<Document, ServiceEntry>();

/** Each acquisition owns one reference, including while initialization is pending. */
export async function acquireRenderer(document: Document): Promise<AttachmentRenderer> {
  let entry = services.get(document);
  if (!entry) {
    entry = {
      owners: 0,
      ready: GpuExperiment.create(document.defaultView?.navigator.gpu ?? null),
    };
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
      services.delete(document);
      shared.renderer?.destroy();
    }
  }

  try {
    const renderer = await shared.ready;
    shared.renderer = renderer;
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
