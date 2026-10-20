// Reveal the current page in the sidebar without scrolling the document itself.
function revealCurrentPage() {
  const sidebar = document.querySelector<HTMLElement>('.docs-sidebar');
  const current = sidebar?.querySelector<HTMLElement>('[aria-current="page"]');
  if (!sidebar || !current) {
    return;
  }
  const bounds = sidebar.getBoundingClientRect();
  const link = current.getBoundingClientRect();
  if (link.top < bounds.top || link.bottom > bounds.bottom) {
    sidebar.scrollTop += link.top - bounds.top - sidebar.clientHeight / 3;
  }
}

revealCurrentPage();
