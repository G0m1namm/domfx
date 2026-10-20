import { initializeSiteSearch } from './site-search';

// Documentation renders effect results as reference links, so no preview handler is needed.
function initializeDocsSearch() {
  const lifetime = new AbortController();
  const { dialog } = initializeSiteSearch({ signal: lifetime.signal });
  return () => {
    lifetime.abort();
    dialog.close();
  };
}

let disposeDocsSearch = initializeDocsSearch();
window.addEventListener('pagehide', () => disposeDocsSearch());
window.addEventListener('pageshow', (event) => {
  if (event.persisted) {
    disposeDocsSearch = initializeDocsSearch();
  }
});
