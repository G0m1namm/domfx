// Progressive enhancements for docs navigation. Every control works as plain
// HTML (anchors and native popovers); this only adds feedback and focus care.

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

// Reveal the current page in a scrolling navigation panel without scrolling the
// document itself.
function revealCurrentPage(panel: HTMLElement | null) {
  const current = panel?.querySelector<HTMLElement>('[aria-current="page"]');
  if (!panel || !current) {
    return;
  }
  const bounds = panel.getBoundingClientRect();
  const link = current.getBoundingClientRect();
  if (link.top < bounds.top || link.bottom > bounds.bottom) {
    panel.scrollTop += link.top - bounds.top - panel.clientHeight / 3;
  }
}

function revealCurrentPageInDrawer() {
  const drawer = document.querySelector<HTMLElement>('.docs-drawer');
  drawer?.addEventListener('toggle', () => {
    if (drawer.matches(':popover-open')) {
      revealCurrentPage(drawer);
    }
  });
}

// Mark the section whose heading most recently passed below the sticky chrome.
function trackActiveSection() {
  const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('[data-toc-link]'));
  const ids = [...new Set(links.map((link) => link.dataset.tocLink ?? ''))];
  const headings = ids
    .map((id) => document.getElementById(id))
    .filter((heading): heading is HTMLElement => heading !== null);
  if (!headings.length) {
    return;
  }
  let frame = 0;
  let active = '';
  const update = () => {
    frame = 0;
    const offset = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
    const atEnd = innerHeight + scrollY >= document.documentElement.scrollHeight - 2;
    const passed = headings.filter((heading) => heading.getBoundingClientRect().top <= offset + 8);
    const next = atEnd ? headings.at(-1)?.id : passed.at(-1)?.id;
    if (next === active) {
      return;
    }
    active = next ?? '';
    for (const link of links) {
      link.toggleAttribute('data-active', link.dataset.tocLink === active);
    }
  };
  addEventListener(
    'scroll',
    () => {
      frame ||= requestAnimationFrame(update);
    },
    { passive: true },
  );
  update();
}

// Popovers stay open after in-page links; close them once a section is chosen.
function closePopoversOnNavigate() {
  for (const popover of document.querySelectorAll<HTMLElement>('.docs-toc-popover, .docs-drawer')) {
    popover.addEventListener('click', (event) => {
      if (event.target instanceof Element && event.target.closest('a[href]')) {
        popover.hidePopover();
      }
    });
  }
}

function enhanceBackToTop() {
  const button = document.querySelector<HTMLAnchorElement>('[data-back-to-top]');
  const main = document.querySelector<HTMLElement>('#main');
  if (!button || !main) {
    return;
  }
  button.dataset.enhanced = '';
  let frame = 0;
  const update = () => {
    frame = 0;
    button.toggleAttribute('data-visible', scrollY > innerHeight);
  };
  addEventListener(
    'scroll',
    () => {
      frame ||= requestAnimationFrame(update);
    },
    { passive: true },
  );
  button.addEventListener('click', (event) => {
    event.preventDefault();
    scrollTo({ top: 0, behavior: reducedMotion.matches ? 'auto' : 'smooth' });
    main.focus({ preventScroll: true });
  });
  update();
}

revealCurrentPage(document.querySelector<HTMLElement>('.docs-sidebar'));
revealCurrentPageInDrawer();
trackActiveSection();
closePopoversOnNavigate();
enhanceBackToTop();
