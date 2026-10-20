export interface SiteSearchOptions {
  /** Removes every search listener when aborted. */
  signal: AbortSignal;
  /** Reports whether another modal currently owns the page. */
  isBlocked?: () => boolean;
  /** Runs before the dialog opens. */
  onOpen?: () => void;
  /** Runs after the dialog closes and focus returns to the trigger. */
  onClose?: () => void;
  /** Opens an effect result rendered as a button; linked results navigate natively. */
  openEffect?: (result: HTMLElement) => void;
}

export interface SiteSearch {
  dialog: HTMLDialogElement;
  trigger: HTMLButtonElement;
}

const resultLimit = 10;

function required<T extends Element>(selector: string, root: ParentNode = document): T {
  const element = root.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Missing search element: ${selector}`);
  }
  return element;
}

function rank(item: HTMLElement, query: string) {
  const title = item.dataset.title ?? '';
  return title === query ? 3 : title.startsWith(query) ? 2 : title.includes(query) ? 1 : 0;
}

export function initializeSiteSearch(options: SiteSearchOptions): SiteSearch {
  const { signal, isBlocked = () => false } = options;
  const dialog = required<HTMLDialogElement>('#site-search');
  const input = required<HTMLInputElement>('[data-global-search]', dialog);
  const trigger = required<HTMLButtonElement>('[data-search-open]');
  const empty = required<HTMLElement>('.site-search-empty', dialog);
  const status = required<HTMLElement>('.site-search-status', dialog);
  const groups = Array.from(dialog.querySelectorAll<HTMLElement>('[data-search-group]'));
  const items = Array.from(dialog.querySelectorAll<HTMLElement>('[data-search-item]'));
  const on = <K extends keyof HTMLElementEventMap>(
    target: EventTarget,
    type: K,
    callback: (event: HTMLElementEventMap[K]) => void,
  ) => {
    target.addEventListener(type, callback as EventListener, { signal });
  };

  function updateResults() {
    const query = input.value.trim().toLowerCase();
    const terms = query.split(/\s+/).filter(Boolean);
    const matches = items.filter((item) =>
      query
        ? terms.every((term) => item.dataset.keywords?.includes(term))
        : item.dataset.starter === 'true',
    );
    const ranked = query ? [...matches].sort((a, b) => rank(b, query) - rank(a, query)) : matches;
    const visible = ranked.slice(0, resultLimit);
    for (const item of items) {
      item.hidden = !visible.includes(item);
    }
    for (const group of groups) {
      const groupItems = visible.filter(
        (item) => item.dataset.searchKind === group.dataset.searchGroup,
      );
      group.hidden = groupItems.length === 0;
      required('ul', group).append(...groupItems);
    }
    empty.hidden = visible.length > 0;
    status.textContent = query
      ? `${matches.length} result${matches.length === 1 ? '' : 's'}${matches.length > resultLimit ? ` · showing the first ${resultLimit}` : ''}`
      : 'Effects and documentation';
  }

  function open() {
    if (isBlocked()) {
      return;
    }
    options.onOpen?.();
    input.value = '';
    updateResults();
    dialog.showModal();
    input.focus();
  }

  on(trigger, 'click', open);
  on(input, 'input', updateResults);
  on(required('[data-search-close]', dialog), 'click', () => dialog.close());
  on(dialog, 'close', () => {
    if (!dialog.open && !isBlocked()) {
      trigger.focus();
      options.onClose?.();
    }
  });
  on(dialog, 'click', (event) => {
    if (!(event.target instanceof Element)) {
      return;
    }
    const effect = event.target.closest<HTMLElement>('[data-search-effect]');
    if (effect && options.openEffect) {
      dialog.close();
      options.openEffect(effect);
    } else if (event.target.closest('a')) {
      dialog.close();
    }
  });
  on(dialog, 'keydown', (event) => {
    const results = Array.from(
      dialog.querySelectorAll<HTMLElement>('li:not([hidden]) > a, li:not([hidden]) > button'),
    );
    if (event.key === 'Escape') {
      event.preventDefault();
      dialog.close();
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      const current = results.findIndex((result) => result === document.activeElement);
      const next =
        current === -1
          ? step === 1
            ? 0
            : results.length - 1
          : (current + step + results.length) % results.length;
      results[next]?.focus();
    } else if (event.key === 'Enter' && event.target === input) {
      event.preventDefault();
      results[0]?.click();
    }
  });
  on(document, 'keydown', (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      if (dialog.open) {
        dialog.close();
      } else {
        open();
      }
    }
  });
  trigger.hidden = false;
  return { dialog, trigger };
}
