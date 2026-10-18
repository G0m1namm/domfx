function initializeHomepage() {
  const events = new AbortController();
  const { signal } = events;
  const copy = document.querySelector<HTMLButtonElement>('.copy-install');
  const command = document.querySelector<HTMLElement>('#install-command');
  const feedback = document.querySelector<HTMLElement>('.copy-status');
  if (copy && command && feedback) {
    copy.hidden = false;
    copy.addEventListener(
      'click',
      async () => {
        try {
          await navigator.clipboard.writeText(command.textContent?.trim() ?? '');
          if (!signal.aborted) {
            copy.setAttribute('data-copied', '');
            feedback.textContent = 'Install command copied.';
          }
        } catch {
          if (!signal.aborted) {
            copy.removeAttribute('data-copied');
            feedback.textContent = 'Select the command and copy it manually.';
          }
        }
      },
      { signal },
    );
  }

  const artwork = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const scale = Math.min(entry.contentRect.width / 256, entry.contentRect.height / 192) * 0.92;
      entry.target
        .querySelector<HTMLElement>('.capture-host')
        ?.style.setProperty('--art-scale', String(scale));
    }
  });
  document.querySelectorAll('.sample-display').forEach((frame) => artwork.observe(frame));

  const disposals: (() => void)[] = [];
  const loadWhenVisible = new IntersectionObserver(
    async (entries) => {
      for (const entry of entries) {
        if (
          !entry.isIntersecting ||
          entry.intersectionRatio === 0 ||
          !(entry.target instanceof HTMLElement)
        ) {
          continue;
        }
        loadWhenVisible.unobserve(entry.target);
        if (entry.target.matches('.timeline-player')) {
          try {
            const { createTimelinePlayer } = await import('./timeline-player');
            if (!signal.aborted) {
              disposals.push(createTimelinePlayer(entry.target));
            }
          } catch {
            const note = entry.target.querySelector('.player-note');
            if (note && !signal.aborted) {
              note.textContent = 'The player could not load. Refresh to try again.';
            }
          }
        } else {
          try {
            const { createPrismBackground } = await import('./prism-background');
            if (!signal.aborted) {
              disposals.push(createPrismBackground(entry.target));
            }
          } catch {
            // The authored still background remains visible if the optional module cannot load.
          }
        }
      }
    },
    { threshold: 0.01 },
  );
  document
    .querySelectorAll('.timeline-player, .shader-section')
    .forEach((element) => loadWhenVisible.observe(element));

  return () => {
    events.abort();
    artwork.disconnect();
    loadWhenVisible.disconnect();
    disposals.forEach((dispose) => dispose());
  };
}

let cleanup = initializeHomepage();
const hide = () => cleanup();
const show = (event: PageTransitionEvent) => {
  if (event.persisted) {
    cleanup = initializeHomepage();
  }
};
window.addEventListener('pagehide', hide);
window.addEventListener('pageshow', show);
import.meta.hot?.dispose(() => {
  cleanup();
  window.removeEventListener('pagehide', hide);
  window.removeEventListener('pageshow', show);
});
