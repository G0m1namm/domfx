/** Recreate page-owned resources after a back/forward-cache restore. */
export function initializePage(initialize: () => () => void, window: Window = globalThis.window) {
  let cleanup: (() => void) | undefined = initialize();

  function release() {
    const previous = cleanup;
    cleanup = undefined;
    previous?.();
  }

  function restore(event: PageTransitionEvent) {
    if (event.persisted && !cleanup) {
      cleanup = initialize();
    }
  }

  window.addEventListener('pagehide', release);
  window.addEventListener('pageshow', restore);
  return () => {
    window.removeEventListener('pagehide', release);
    window.removeEventListener('pageshow', restore);
    release();
  };
}
