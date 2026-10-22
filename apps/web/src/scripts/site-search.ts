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

interface DocsSearchResult {
  url: string;
  excerpt: string;
  plain_excerpt?: string;
  meta: { title?: string };
}

interface DocsSearchIndex {
  search(query: string): Promise<{ results: { data(): Promise<DocsSearchResult> }[] }>;
}

const resultLimit = 10;
const searchMessages = {
  en: {
    browse: 'Effects and documentation',
    documentation: 'Documentation',
    loading: 'Searching documentation…',
    result: 'result',
    results: 'results',
    showing: 'showing the first',
    unavailable: 'Documentation search is unavailable. You can still search effects.',
    fallback: 'Open Docs.',
  },
  es: {
    browse: 'Efectos y documentación',
    documentation: 'Documentación',
    loading: 'Buscando documentación…',
    result: 'resultado',
    results: 'resultados',
    showing: 'se muestran los primeros',
    unavailable: 'La búsqueda de documentación no está disponible. Puedes seguir buscando efectos.',
    fallback: 'Abrir la documentación.',
  },
} as const;

function normalize(value: string) {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

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
  const docsIndexPath = dialog.dataset.docsPagefind;
  const docsFallback = dialog.dataset.docsFallback;
  const docsGroup = required<HTMLElement>('[data-search-group="documentation"]', dialog);
  const docsList = required<HTMLUListElement>('ul', docsGroup);
  const messages = searchMessages[document.documentElement.lang === 'es' ? 'es' : 'en'];
  let docsIndex: Promise<DocsSearchIndex> | undefined;
  let queryRevision = 0;
  const on = <K extends keyof HTMLElementEventMap>(
    target: EventTarget,
    type: K,
    callback: (event: HTMLElementEventMap[K]) => void,
  ) => {
    target.addEventListener(type, callback as EventListener, { signal });
  };

  function resultCount(count: number) {
    const label = count === 1 ? messages.result : messages.results;
    const overflow = count > resultLimit ? ` · ${messages.showing} ${resultLimit}` : '';
    return `${count} ${label}${overflow}`;
  }

  function docsResult(result: DocsSearchResult) {
    const item = document.createElement('li');
    const link = document.createElement('a');
    const label = document.createElement('span');
    const title = document.createElement('strong');
    const excerpt = document.createElement('small');
    link.href = result.url;
    title.textContent = result.meta.title ?? messages.documentation;
    excerpt.textContent = new DOMParser().parseFromString(
      result.plain_excerpt ?? result.excerpt,
      'text/html',
    ).body.textContent;
    label.append(title, excerpt);
    link.append(label);
    item.append(link);
    return item;
  }

  async function updateDocs(
    indexPath: string,
    query: string,
    revision: number,
    effectCount: number,
  ) {
    const isCurrent = () => !signal.aborted && dialog.open && revision === queryRevision;
    try {
      docsIndex ??= import(/* @vite-ignore */ indexPath);
      const index = await docsIndex;
      if (!isCurrent()) {
        return;
      }
      const search = await index.search(query);
      if (!isCurrent()) {
        return;
      }
      const results = await Promise.all(
        search.results.slice(0, resultLimit - effectCount).map((result) => result.data()),
      );
      if (!isCurrent()) {
        return;
      }
      docsList.replaceChildren(...results.map(docsResult));
      docsGroup.hidden = results.length === 0;
      empty.hidden = effectCount + results.length > 0;
      status.textContent = resultCount(effectCount + search.results.length);
    } catch {
      if (isCurrent()) {
        empty.hidden = effectCount > 0;
        status.textContent = messages.unavailable;
        if (docsFallback) {
          const link = document.createElement('a');
          link.href = docsFallback;
          link.textContent = messages.fallback;
          link.style.textDecoration = 'underline';
          status.append(' ', link);
        }
      }
    }
  }

  function updateResults() {
    const revision = ++queryRevision;
    if (docsIndexPath) {
      docsList.replaceChildren();
      docsGroup.hidden = true;
    }
    const query = input.value.trim().toLowerCase();
    const terms = normalize(query).split(/\s+/).filter(Boolean);
    const matches = items.filter((item) =>
      query
        ? terms.every((term) => normalize(item.dataset.keywords ?? '').includes(term))
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
    status.textContent = query ? resultCount(matches.length) : messages.browse;
    if (docsIndexPath && query) {
      empty.hidden = true;
      status.textContent = messages.loading;
      void updateDocs(docsIndexPath, query, revision, visible.length);
    }
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
    queryRevision++;
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
  signal.addEventListener(
    'abort',
    () => {
      queryRevision++;
    },
    { once: true },
  );
  trigger.hidden = false;
  return { dialog, trigger };
}
