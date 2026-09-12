type FrameCommit = (timestamp: number) => boolean;

/** One frame request per document; a commit returns whether it needs another frame. */
function createScheduler(view: Window) {
  const pending = new Set<FrameCommit>();
  let request: number | undefined;

  function schedule(commit: FrameCommit) {
    pending.add(commit);
    request ??= view.requestAnimationFrame(flush);
  }

  function flush(timestamp: number) {
    request = undefined;
    const batch = [...pending];

    for (const commit of batch) {
      if (!pending.delete(commit)) {
        continue;
      }
      if (commit(timestamp)) {
        schedule(commit);
      }
    }
  }

  function cancel(commit: FrameCommit) {
    pending.delete(commit);
    if (pending.size === 0 && request !== undefined) {
      view.cancelAnimationFrame(request);
      request = undefined;
    }
  }

  return { schedule, cancel };
}

const schedulers = new WeakMap<Document, ReturnType<typeof createScheduler>>();

export function schedulerFor(document: Document, view: Window) {
  let scheduler = schedulers.get(document);

  if (!scheduler) {
    scheduler = createScheduler(view);
    schedulers.set(document, scheduler);
  }

  return scheduler;
}
