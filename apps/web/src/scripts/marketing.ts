import type * as BrowserEffects from '@domfx/browser';
import type { EffectHandle } from '@domfx/browser';

import type { effects } from '../content/effects';
import { findEffect, patternEffects } from '../content/effects';

const savedPattern = { index: 0, elapsed: 0, time: 3.2, paused: false };

function initializeMarketing() {
  const lifetime = new AbortController();
  let disposed = false;
  let frame = 0;
  let toastTimer = 0;
  const hasGpu = 'gpu' in navigator && Boolean(navigator.gpu);
  const on = <K extends keyof WindowEventMap>(
    target: EventTarget,
    type: K,
    callback: (event: WindowEventMap[K]) => void,
  ) => {
    target.addEventListener(type, callback as EventListener, { signal: lifetime.signal });
  };
  function required<T extends Element>(selector: string, root: ParentNode = document): T {
    const element = root.querySelector<T>(selector);
    if (!element) {
      throw new Error(`Missing marketing element: ${selector}`);
    }
    return element;
  }

  const main = required<HTMLElement>('main');
  const isLibrary = document.body.dataset.surface === 'library';
  const dialog = required<HTMLDialogElement>('.effect-dialog');
  const searchDialog = required<HTMLDialogElement>('#site-search');
  const searchInput = required<HTMLInputElement>('[data-global-search]', searchDialog);
  const searchTrigger = required<HTMLButtonElement>('[data-search-open]');
  const intensity = required<HTMLInputElement>('#effect-intensity');
  const dialogScene = required<HTMLElement>('.dialog-scene', dialog);
  const dialogStage = required<HTMLElement>('.dialog-stage', dialog);
  const zoomOut = required<HTMLButtonElement>('[data-zoom-out]', dialog);
  const zoomIn = required<HTMLButtonElement>('[data-zoom-in]', dialog);
  const zoomLabel = required<HTMLElement>('[data-zoom-label]', dialog);
  const canHover = matchMedia('(hover: hover) and (pointer: fine)');
  let previewZoom = 1;
  let hoverZoom = false;
  let panX = 0;
  let panY = 0;
  let previewDrag: { id: number; x: number; y: number } | undefined;
  let filter =
    document.querySelector<HTMLElement>('[data-filter][aria-pressed="true"]')?.dataset.filter ??
    'All';
  let previewRevision = 0;
  let selectedId = 'electricity';
  let selectedName = 'Electricity';
  let selectedCategory = 'Energy';
  let targetKind = 'text';
  let paused = false;
  let previewTime = 2.4;
  let previewNeedsResume = false;
  let dialogHandle: EffectHandle | undefined;
  let previewReturnFocus: HTMLElement | undefined;
  const cardHandles = new Map<HTMLElement | SVGElement, EffectHandle>();
  const pending = new Map<Element, number>();
  let nextCardRequest = 0;
  let browserModule: Promise<typeof BrowserEffects> | undefined;
  async function loadEffect(effect: (typeof effects)[number]) {
    browserModule ??= import('@domfx/browser');
    const module = await browserModule;
    return module[effect.exportName];
  }

  // Reflect only this decorative output canvas; captured geometry stays axis-aligned.
  const headerHost = required<HTMLElement>('.header-effect-host');
  const headerLine = required<HTMLElement>('.header-effect-line', headerHost);
  const headerPlayback = required<HTMLButtonElement>('[data-header-pause]');
  // The header and closing wordmark share one cycle, with independent attachments.
  const patternRamp = 1.2;
  const patternHold = 6;
  const patternPeak = 0.85;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let headerHandle: EffectHandle | undefined;
  let headerRevision = 0;
  let headerPending = false;
  let patternIndex = savedPattern.index;
  let patternElapsed = savedPattern.elapsed;
  let patternTime = savedPattern.time;
  let patternsPaused = savedPattern.paused || reducedMotion.matches;
  let motionNeedsResume = reducedMotion.matches;

  function updatePatternPlayback() {
    const paused = patternsPaused || reducedMotion.matches;
    for (const button of document.querySelectorAll<HTMLButtonElement>(
      '[data-header-pause], [data-closing-pause]',
    )) {
      button.disabled = reducedMotion.matches || !hasGpu;
      button.setAttribute('aria-pressed', String(paused));
      button.setAttribute(
        'aria-label',
        reducedMotion.matches
          ? 'Effects paused for reduced motion'
          : `${paused ? 'Resume' : 'Pause'} header and wordmark effects`,
      );
      const label = !hasGpu
        ? 'Effects unavailable'
        : reducedMotion.matches
          ? 'Reduced motion'
          : paused
            ? 'Resume effects'
            : 'Pause effects';
      button.innerHTML = `<svg class="ui-icon" viewBox="0 0 256 256" aria-hidden="true"><use href="#ph-${paused ? 'play' : 'pause'}"/></svg>${button.hasAttribute('data-closing-pause') ? `<span>${label}</span>` : ''}`;
    }
  }

  function patternIntensity() {
    const fadeOutStart = patternRamp + patternHold;
    const ramp = Math.max(
      0,
      Math.min(
        1,
        patternElapsed < patternRamp
          ? patternElapsed / patternRamp
          : 1 - (patternElapsed - fadeOutStart) / patternRamp,
      ),
    );
    return patternPeak * ramp * ramp * (3 - 2 * ramp);
  }

  function syncPatternEffects() {
    const intensity = patternIntensity();
    if (headerHandle) {
      headerHandle.time = patternTime;
      headerHandle.intensity = intensity;
    }
    for (const handle of closingHandles) {
      handle.time = patternTime;
      handle.intensity = intensity;
    }
    for (const host of [headerHost, closingHost]) {
      if (!host) {
        continue;
      }
      host.dataset.effect = patternEffects[patternIndex].id;
      host.dataset.time = patternTime.toFixed(3);
      host.dataset.intensity = intensity.toFixed(3);
      host.dataset.phase =
        patternElapsed < patternRamp
          ? 'rising'
          : patternElapsed < patternRamp + patternHold
            ? 'holding'
            : 'falling';
    }
  }

  async function showHeaderEffect() {
    const revision = ++headerRevision;
    headerHandle?.dispose();
    headerHandle = undefined;
    if (!hasGpu || reducedMotion.matches || motionNeedsResume || disposed || document.hidden) {
      return;
    }
    headerPending = true;
    try {
      const factory = await loadEffect(patternEffects[patternIndex]);
      if (revision !== headerRevision || disposed) {
        return;
      }
      const handle = factory(headerLine, {
        host: headerHost,
        clock: 'manual',
        intensity: patternIntensity(),
        time: patternTime,
        seed: 182,
      });
      headerHandle = handle;
      await handle.ready;
      if (revision !== headerRevision || disposed) {
        handle.dispose();
        return;
      }
      headerHost.dataset.status = handle.lifecycle;
      syncPatternEffects();
    } catch {
      if (revision === headerRevision) {
        headerHost.dataset.status = 'unavailable';
      }
    } finally {
      if (revision === headerRevision) {
        headerPending = false;
      }
    }
  }

  function togglePatterns() {
    patternsPaused = !patternsPaused;
    if (!patternsPaused && motionNeedsResume) {
      motionNeedsResume = false;
      void showHeaderEffect();
      if (closingVisible) {
        void attachClosingEffects();
      }
      observeCards();
    }
    updatePatternPlayback();
  }
  headerPlayback.addEventListener('click', togglePatterns, { signal: lifetime.signal });
  on(reducedMotion, 'change', () => {
    if (reducedMotion.matches) {
      patternsPaused = true;
      motionNeedsResume = true;
      headerRevision += 1;
      headerHandle?.dispose();
      headerHandle = undefined;
      headerPending = false;
      clearClosingEffects();
      clearCards();
      paused = true;
      previewNeedsResume = true;
      if (dialog.open) {
        void showDialogEffect();
      }
    }
    updatePatternPlayback();
    updatePreviewPlayback();
  });
  updatePatternPlayback();

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const target = entry.target;
        if (!(target instanceof HTMLElement) && !(target instanceof SVGElement)) {
          continue;
        }
        if (entry.isIntersecting && !dialog.open && !searchDialog.open) {
          void attachCard(target);
        } else {
          pending.delete(target);
          cardHandles.get(target)?.dispose();
          cardHandles.delete(target);
        }
      }
    },
    { threshold: 0.08 },
  );

  async function attachCard(target: HTMLElement | SVGElement) {
    if (
      disposed ||
      document.hidden ||
      !hasGpu ||
      reducedMotion.matches ||
      motionNeedsResume ||
      cardHandles.has(target) ||
      pending.has(target)
    ) {
      return;
    }
    const request = ++nextCardRequest;
    pending.set(target, request);
    try {
      const effect = findEffect(target.dataset.preview);
      const host = target.closest<HTMLElement>('[data-effect-host]');
      if (!effect || !host) {
        return;
      }
      const [factory] = await Promise.all([loadEffect(effect), document.fonts.ready]);
      if (target instanceof HTMLImageElement) {
        await target.decode();
      }
      if (
        disposed ||
        pending.get(target) !== request ||
        !target.isConnected ||
        dialog.open ||
        searchDialog.open
      ) {
        return;
      }
      const handle = factory(target, {
        host,
        clock: 'ambient',
        intensity: 0.7,
        time: 2.4,
        seed: 314,
      });
      cardHandles.set(target, handle);
      await handle.ready;
      if (disposed || cardHandles.get(target) !== handle) {
        handle.dispose();
        return;
      }
      target.dataset.status = handle.lifecycle;
    } catch {
      if (pending.get(target) === request) {
        target.dataset.status = 'unavailable';
      }
    } finally {
      if (pending.get(target) === request) {
        pending.delete(target);
      }
    }
  }

  function clearCards() {
    observer.disconnect();
    pending.clear();
    for (const handle of cardHandles.values()) {
      handle.dispose();
    }
    cardHandles.clear();
  }

  function observeCards() {
    for (const target of main.querySelectorAll<HTMLElement | SVGElement>('[data-preview]')) {
      if (!target.closest<HTMLElement>('[data-card]')?.hidden) {
        observer.observe(target);
      }
    }
  }

  function applyFilters() {
    let count = 0;
    clearCards();
    for (const card of main.querySelectorAll<HTMLElement>('.effect-grid [data-card]')) {
      const matches = filter === 'All' || card.dataset.category === filter;
      card.hidden = !matches;
      if (matches) {
        count += 1;
      }
    }
    for (const button of main.querySelectorAll<HTMLElement>('[data-filter]')) {
      button.setAttribute('aria-pressed', String(button.dataset.filter === filter));
    }
    for (const element of main.querySelectorAll('[data-count]')) {
      element.textContent = String(count);
    }
    const grid = main.querySelector<HTMLElement>('.effect-grid');
    if (grid) {
      grid.dataset.filtered = String(filter !== 'All');
    }
    const empty = main.querySelector<HTMLElement>('.empty');
    if (empty) {
      empty.hidden = count !== 0;
    }
    observeCards();
  }

  // Search includes every effect, including those outside the homepage selection.
  const searchItems = Array.from(searchDialog.querySelectorAll<HTMLElement>('[data-search-item]'));
  function updateSearchResults() {
    const query = searchInput.value.trim().toLowerCase();
    const terms = query.split(/\s+/).filter(Boolean);
    const matches = searchItems.filter((item) =>
      query
        ? terms.every((term) => item.dataset.keywords?.includes(term))
        : item.dataset.starter === 'true',
    );
    matches.sort((a, b) => {
      const rank = (item: HTMLElement) =>
        item.dataset.title === query
          ? 3
          : item.dataset.title?.startsWith(query)
            ? 2
            : item.dataset.title?.includes(query)
              ? 1
              : 0;
      return query ? rank(b) - rank(a) : 0;
    });
    const visible = matches.slice(0, 10);
    for (const item of searchItems) {
      item.hidden = !visible.includes(item);
    }
    for (const group of searchDialog.querySelectorAll<HTMLElement>('[data-search-group]')) {
      const items = visible.filter((item) => item.dataset.searchKind === group.dataset.searchGroup);
      group.hidden = items.length === 0;
      const list = required('ul', group);
      for (const item of items) {
        list.append(item);
      }
    }
    required<HTMLElement>('.site-search-empty', searchDialog).hidden = visible.length > 0;
    required<HTMLElement>('.site-search-status', searchDialog).textContent = query
      ? `${matches.length} result${matches.length === 1 ? '' : 's'}${matches.length > 10 ? ' · showing the first 10' : ''}`
      : 'Effects and documentation';
  }
  function openSearch() {
    if (dialog.open) {
      return;
    }
    clearCards();
    searchInput.value = '';
    updateSearchResults();
    searchDialog.showModal();
    searchInput.focus();
  }
  on(searchTrigger, 'click', openSearch);
  on(searchInput, 'input', updateSearchResults);
  on(required('[data-search-close]', searchDialog), 'click', () => searchDialog.close());
  on(searchDialog, 'close', () => {
    if (!dialog.open && !searchDialog.open) {
      searchTrigger.focus();
      observeCards();
    }
  });
  on(searchDialog, 'click', (event) => {
    if (!(event.target instanceof Element)) {
      return;
    }
    const effect = event.target.closest<HTMLElement>('[data-search-effect]');
    if (effect) {
      searchDialog.close();
      openPreview(effect);
    } else if (event.target.closest('a')) {
      searchDialog.close();
    }
  });
  on(searchDialog, 'keydown', (event) => {
    const results = Array.from(
      searchDialog.querySelectorAll<HTMLElement>('li:not([hidden]) > a, li:not([hidden]) > button'),
    );
    if (event.key === 'Escape') {
      event.preventDefault();
      searchDialog.close();
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const current = results.findIndex((result) => result === document.activeElement);
      const next =
        current === -1
          ? event.key === 'ArrowDown'
            ? 0
            : results.length - 1
          : (current + (event.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length;
      results[next]?.focus();
    } else if (event.key === 'Enter' && event.target === searchInput) {
      event.preventDefault();
      results[0]?.click();
    }
  });
  on(document, 'keydown', (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      if (searchDialog.open) {
        searchDialog.close();
      } else {
        openSearch();
      }
    }
  });

  function selectAudience(audience: 'humans' | 'agents') {
    for (const tab of main.querySelectorAll<HTMLElement>('[data-audience]')) {
      const selected = tab.dataset.audience === audience;
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
    }
    required<HTMLElement>('#humans-panel', main).hidden = audience !== 'humans';
    required<HTMLElement>('#agents-panel', main).hidden = audience !== 'agents';
    const url = new URL(location.href);
    if (audience === 'agents') {
      url.searchParams.set('audience', audience);
    } else {
      url.searchParams.delete('audience');
    }
    history.replaceState(null, '', url);
  }
  on(main, 'click', (event) => {
    if (!(event.target instanceof Element)) {
      return;
    }
    const tab = event.target.closest<HTMLElement>('[data-audience]');
    if (!tab) {
      return;
    }
    event.preventDefault();
    selectAudience(tab.dataset.audience === 'agents' ? 'agents' : 'humans');
  });
  on(main, 'keydown', (event) => {
    if (!(event.target instanceof HTMLElement) || !event.target.matches('[data-audience]')) {
      return;
    }
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
      return;
    }
    event.preventDefault();
    const audience =
      event.key === 'Home'
        ? 'humans'
        : event.key === 'End'
          ? 'agents'
          : event.target.dataset.audience === 'humans'
            ? 'agents'
            : 'humans';
    selectAudience(audience);
    required<HTMLElement>(`[data-audience="${audience}"]`, main).focus();
  });

  async function loadRepositoryStars() {
    try {
      const response = await fetch('https://api.github.com/repos/G0m1namm/domfx', {
        headers: { Accept: 'application/vnd.github+json' },
        signal: AbortSignal.any([lifetime.signal, AbortSignal.timeout(5000)]),
      });
      if (!response.ok || disposed) {
        return;
      }
      const data: unknown = await response.json();
      if (
        !data ||
        typeof data !== 'object' ||
        !('stargazers_count' in data) ||
        typeof data.stargazers_count !== 'number' ||
        !Number.isSafeInteger(data.stargazers_count) ||
        data.stargazers_count < 0
      ) {
        return;
      }
      const count = data.stargazers_count;
      const cta = required<HTMLAnchorElement>('[data-repo-stars]');
      required('[data-star-label]', cta).textContent = count >= 50 ? 'Stars' : 'Star on GitHub';
      const badge = required<HTMLElement>('[data-star-count]', cta);
      badge.hidden = count < 50;
      badge.textContent = new Intl.NumberFormat('en', {
        notation: 'compact',
        maximumFractionDigits: 1,
      }).format(count);
      cta.setAttribute(
        'aria-label',
        `${count.toLocaleString('en')} GitHub stars. Star domfx on GitHub`,
      );
      cta.title = `${count.toLocaleString('en')} GitHub stars`;
    } catch {
      /* The native GitHub link remains usable when public stats are unavailable. */
    }
  }
  void loadRepositoryStars();

  // Release the wordmark offscreen; rejoining never resets the shared cycle.
  let closingHandles: EffectHandle[] = [];
  let closingHost: HTMLElement | undefined;
  let closingRevision = 0;
  let closingVisible = false;
  let closingPending = false;

  function clearClosingEffects() {
    closingRevision += 1;
    for (const handle of closingHandles) {
      handle.dispose();
    }
    closingHandles = [];
    closingPending = false;
  }

  async function attachClosingEffects() {
    clearClosingEffects();
    if (!hasGpu || reducedMotion.matches || motionNeedsResume || disposed || document.hidden) {
      return;
    }
    closingPending = true;
    const revision = closingRevision;
    try {
      const effect = patternEffects[patternIndex];
      const [factory] = await Promise.all([loadEffect(effect), document.fonts.ready]);
      if (revision !== closingRevision || !closingVisible || disposed) {
        return;
      }
      const target = required<HTMLElement>('[data-closing-target]', closingHost);
      target.dataset.effect = effect.id;
      const handle = factory(target, {
        host: required<HTMLElement>('[data-closing-host]', closingHost),
        clock: 'manual',
        intensity: patternIntensity(),
        time: patternTime,
        seed: 182,
      });
      closingHandles = [handle];
      await handle.ready;
      if (revision !== closingRevision || disposed) {
        handle.dispose();
        return;
      }
      if (closingHost) {
        closingHost.dataset.status = handle.lifecycle;
      }
      syncPatternEffects();
    } catch {
      if (revision === closingRevision && closingHost) {
        closingHost.dataset.status = 'unavailable';
      }
    } finally {
      if (revision === closingRevision) {
        closingPending = false;
      }
    }
  }

  const closingObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.target !== document.querySelector('#closing-content [data-closing-target]')) {
          continue;
        }
        closingVisible = entry.isIntersecting;
        if (closingVisible) {
          void attachClosingEffects();
        } else {
          clearClosingEffects();
        }
      }
    },
    { threshold: 0.08 },
  );

  function initializeContent() {
    closingHost = required<HTMLElement>('#closing-content');
    updatePatternPlayback();
    closingObserver.observe(required('[data-closing-target]', closingHost));
    if (!isLibrary) {
      required('.audience-tabs', main).setAttribute('role', 'tablist');
      for (const panel of main.querySelectorAll('#humans-panel, #agents-panel')) {
        panel.setAttribute('role', 'tabpanel');
      }
      selectAudience(
        new URL(location.href).searchParams.get('audience') === 'agents' ? 'agents' : 'humans',
      );
    }
    observeCards();
    void showHeaderEffect();
    for (const control of document.querySelectorAll<HTMLElement>('[data-js-control]')) {
      control.hidden = false;
    }
  }

  async function copy(text: string, inPreview = false) {
    const toast = required<HTMLElement>(inPreview ? '[data-copy-status]' : '.toast');
    try {
      await navigator.clipboard.writeText(text);
      if (disposed) {
        return;
      }
      toast.textContent = 'Copied to clipboard';
    } catch {
      if (disposed) {
        return;
      }
      toast.textContent = inPreview
        ? 'Clipboard unavailable. Select and copy the attachment code above.'
        : `Copy it manually: ${text}`;
    }
    toast.hidden = false;
    if (inPreview) {
      return;
    }
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      toast.hidden = true;
    }, 4500);
  }

  function attachmentCode() {
    const effect = findEffect(selectedId);
    return `import { ${effect?.exportName} } from '@domfx/browser';\n\nconst effect = ${effect?.exportName}(element, { host, clock: 'ambient', intensity: ${(Number(intensity.value) / 100).toFixed(2)} });\n\n// On unmount: effect.dispose();`;
  }

  // Scale the source and its attached canvas together; zoom never changes intensity.
  function updatePreviewZoom() {
    const scale = hoverZoom ? Math.max(2, previewZoom) : previewZoom;
    const target = dialogStage.querySelector<HTMLElement>('[data-dialog-target]');
    const limitX = Math.max(
      0,
      (((target?.offsetWidth ?? 0) + 96) * scale) / 2 - dialogScene.clientWidth / 2,
    );
    const limitY = Math.max(
      0,
      (((target?.offsetHeight ?? 0) + 96) * scale) / 2 - dialogScene.clientHeight / 2,
    );
    panX = Math.max(-limitX, Math.min(limitX, panX));
    panY = Math.max(-limitY, Math.min(limitY, panY));
    dialogStage.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
    dialogScene.dataset.zoomed = String(scale > 1);
    const label = `${Math.round(scale * 100)}%`;
    if (zoomLabel.textContent !== label) {
      zoomLabel.textContent = label;
    }
    zoomOut.disabled = previewZoom <= 1;
    zoomIn.disabled = previewZoom >= 3;
  }

  function setPreviewZoom(value: number) {
    previewZoom = Math.max(1, Math.min(3, value));
    hoverZoom = false;
    panX = 0;
    panY = 0;
    updatePreviewZoom();
  }

  on(zoomOut, 'click', () => setPreviewZoom(previewZoom - 0.5));
  on(zoomIn, 'click', () => setPreviewZoom(previewZoom + 0.5));
  on(required('[data-zoom-reset]', dialog), 'click', () => setPreviewZoom(1));
  on(dialogScene, 'pointermove', (event) => {
    if (previewDrag?.id === event.pointerId) {
      panX += event.clientX - previewDrag.x;
      panY += event.clientY - previewDrag.y;
      previewDrag.x = event.clientX;
      previewDrag.y = event.clientY;
    } else if (event.pointerType === 'mouse' && canHover.matches && !reducedMotion.matches) {
      hoverZoom = true;
      const bounds = dialogScene.getBoundingClientRect();
      const scale = Math.max(2, previewZoom);
      panX = (bounds.width / 2 - (event.clientX - bounds.left)) * (scale - 1);
      panY = (bounds.height / 2 - (event.clientY - bounds.top)) * (scale - 1);
    } else {
      return;
    }
    updatePreviewZoom();
  });
  on(dialogScene, 'pointerleave', () => {
    if (previewDrag) {
      return;
    }
    hoverZoom = false;
    panX = 0;
    panY = 0;
    updatePreviewZoom();
  });
  on(dialogScene, 'pointerdown', (event) => {
    if (event.pointerType === 'mouse' || previewZoom <= 1) {
      return;
    }
    previewDrag = { id: event.pointerId, x: event.clientX, y: event.clientY };
    dialogScene.setPointerCapture(event.pointerId);
  });
  on(dialogScene, 'pointerup', () => {
    previewDrag = undefined;
  });
  on(dialogScene, 'pointercancel', () => {
    previewDrag = undefined;
  });
  on(dialogScene, 'keydown', (event) => {
    if (['+', '=', '-', '0'].includes(event.key)) {
      event.preventDefault();
      setPreviewZoom(event.key === '0' ? 1 : previewZoom + (event.key === '-' ? -0.5 : 0.5));
    } else if (
      previewZoom > 1 &&
      ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)
    ) {
      event.preventDefault();
      hoverZoom = false;
      panX += event.key === 'ArrowLeft' ? 32 : event.key === 'ArrowRight' ? -32 : 0;
      panY += event.key === 'ArrowUp' ? 32 : event.key === 'ArrowDown' ? -32 : 0;
      updatePreviewZoom();
    }
  });
  on(window, 'resize', () => {
    if (dialog.open) {
      setPreviewZoom(previewZoom);
    }
  });
  on(reducedMotion, 'change', () => {
    if (reducedMotion.matches) {
      setPreviewZoom(previewZoom);
    }
  });

  async function showDialogEffect() {
    const revision = ++previewRevision;
    dialogHandle?.dispose();
    dialogHandle = undefined;
    dialogStage.innerHTML =
      targetKind === 'text'
        ? '<span class="dialog-target" data-dialog-target>edge.</span>'
        : '<span class="dialog-target" data-dialog-target><svg width="170" height="170" viewBox="0 0 160 160" aria-hidden="true"><path fill="#C2C5DB" d="M64 8H96V45L122 19L145 42L119 68H156V100H119L145 126L122 149L96 123V160H64V123L38 149L15 126L41 100H4V68H41L15 42L38 19L64 45Z"/></svg></span>';
    required('#dialog-title', dialog).textContent = selectedName;
    required('[data-dialog-category]', dialog).textContent = selectedCategory;
    required('[data-code]', dialog).textContent = attachmentCode();
    required('[data-preview-status]', dialog).textContent = 'Preparing the live preview…';
    for (const button of dialog.querySelectorAll<HTMLElement>('[data-target]')) {
      button.setAttribute('aria-pressed', String(button.dataset.target === targetKind));
    }
    const effect = findEffect(selectedId);
    if (!effect || disposed || document.hidden) {
      return;
    }
    updatePreviewPlayback();
    if (!hasGpu || reducedMotion.matches || previewNeedsResume) {
      required('[data-preview-status]', dialog).textContent =
        reducedMotion.matches || previewNeedsResume
          ? 'Animation paused for reduced motion.'
          : 'WebGPU is unavailable. Your HTML stays visible.';
      return;
    }
    try {
      const [factory] = await Promise.all([loadEffect(effect), document.fonts.ready]);
      if (!dialog.open || revision !== previewRevision || disposed) {
        return;
      }
      setPreviewZoom(previewZoom);
      const target = required<HTMLElement>('[data-dialog-target]', dialog);
      const handle = factory(target, {
        host: dialogStage,
        clock: 'manual',
        seed: 314,
        intensity: Number(intensity.value) / 100,
        time: previewTime,
      });
      dialogHandle = handle;
      await handle.ready;
      if (!dialog.open || revision !== previewRevision) {
        handle.dispose();
        return;
      }
      required('[data-preview-status]', dialog).textContent =
        handle.lifecycle === 'active'
          ? 'Live preview · WebGPU'
          : `Static content · ${handle.reason ?? 'effect unavailable'}`;
    } catch {
      if (revision === previewRevision && !disposed) {
        required('[data-preview-status]', dialog).textContent =
          'Effect unavailable. Your HTML stays visible.';
      }
    }
  }

  function updatePreviewPlayback() {
    const button = required<HTMLButtonElement>('[data-pause]', dialog);
    button.disabled = reducedMotion.matches || !hasGpu;
    button.innerHTML = playbackLabel();
  }

  function playbackLabel() {
    return `<svg class="ui-icon" viewBox="0 0 256 256" aria-hidden="true"><use href="#ph-${paused ? 'play' : 'pause'}"/></svg><span>${paused ? 'Resume animation' : 'Pause animation'}</span>`;
  }

  function openPreview(trigger: HTMLElement) {
    selectedId = trigger.dataset.id ?? 'electricity';
    selectedName = trigger.dataset.name ?? 'Electricity';
    selectedCategory = trigger.dataset.category ?? 'Energy';
    clearCards();
    paused = reducedMotion.matches;
    previewNeedsResume = reducedMotion.matches;
    previewTime = 2.4;
    required('[data-copy-status]', dialog).textContent = '';
    previewReturnFocus = trigger;
    intensity.value = '70';
    required('output', dialog).textContent = '70%';
    required('[data-pause]', dialog).innerHTML = playbackLabel();
    dialog.showModal();
    setPreviewZoom(1);
    void showDialogEffect();
  }

  on(document, 'click', (event) => {
    if (!(event.target instanceof Element)) {
      return;
    }
    const element = event.target.closest<HTMLElement>('button');
    if (!element) {
      return;
    }
    if (element.hasAttribute('data-closing-pause')) {
      togglePatterns();
    } else if (element.dataset.filter) {
      filter = element.dataset.filter;
      applyFilters();
    } else if (element.hasAttribute('data-card')) {
      openPreview(element);
    } else if (element.hasAttribute('data-close')) {
      dialog.close();
    } else if (element.dataset.target) {
      targetKind = element.dataset.target;
      void showDialogEffect();
    } else if (element.hasAttribute('data-pause')) {
      paused = !paused;
      if (!paused) {
        previewNeedsResume = false;
      }
      updatePreviewPlayback();
      if (!paused && !dialogHandle) {
        void showDialogEffect();
      }
    } else if (element.dataset.copy) {
      void copy(element.dataset.copy);
    } else if (element.hasAttribute('data-copy-code')) {
      void copy(attachmentCode(), true);
    }
  });

  on(intensity, 'input', () => {
    required('output', dialog).textContent = `${intensity.value}%`;
    if (dialogHandle) {
      dialogHandle.intensity = Number(intensity.value) / 100;
    }
    required('[data-code]', dialog).textContent = attachmentCode();
  });
  on(dialog, 'close', () => {
    previewRevision += 1;
    dialogHandle?.dispose();
    dialogHandle = undefined;
    previewDrag = undefined;
    setPreviewZoom(1);
    observeCards();
    const returnTo = previewReturnFocus?.closest('dialog') ? searchTrigger : previewReturnFocus;
    returnTo?.focus({ preventScroll: true });
  });
  let lastTime = 0;
  let lastPatternTime = 0;
  document.addEventListener(
    'visibilitychange',
    () => {
      lastTime = 0;
      lastPatternTime = 0;
      if (document.hidden) {
        // Invalidated captures cannot become active again; replace them on return.
        headerRevision += 1;
        headerHandle?.dispose();
        headerHandle = undefined;
        headerPending = false;
        clearClosingEffects();
        clearCards();
        previewRevision += 1;
        previewTime = dialogHandle?.time ?? previewTime;
        dialogHandle?.dispose();
        dialogHandle = undefined;
      } else {
        void showHeaderEffect();
        if (closingVisible) {
          void attachClosingEffects();
        }
        if (dialog.open) {
          void showDialogEffect();
        } else if (!searchDialog.open) {
          observeCards();
        }
      }
    },
    { signal: lifetime.signal },
  );
  function tick(now: number) {
    const patternsActive =
      headerHandle?.lifecycle === 'active' ||
      closingHandles.some((handle) => handle.lifecycle === 'active');
    if (
      patternsActive &&
      !headerPending &&
      !closingPending &&
      !patternsPaused &&
      !dialog.open &&
      !searchDialog.open &&
      !document.hidden &&
      !reducedMotion.matches
    ) {
      const delta = lastPatternTime ? Math.min((now - lastPatternTime) / 1000, 0.05) : 0;
      lastPatternTime = now;
      patternTime += delta;
      patternElapsed += delta;
      syncPatternEffects();
      if (patternElapsed >= patternRamp * 2 + patternHold) {
        patternElapsed = 0;
        patternTime = 3.2;
        patternIndex = (patternIndex + 1) % patternEffects.length;
        void showHeaderEffect();
        if (closingVisible) {
          void attachClosingEffects();
        }
        syncPatternEffects();
      }
    } else {
      lastPatternTime = 0;
    }
    if (
      dialogHandle?.lifecycle === 'active' &&
      !paused &&
      !document.hidden &&
      !reducedMotion.matches
    ) {
      if (lastTime) {
        dialogHandle.time += Math.min((now - lastTime) / 1000, 0.05);
      }
      lastTime = now;
    } else {
      lastTime = 0;
    }
    if (!disposed) {
      frame = requestAnimationFrame(tick);
    }
  }
  frame = requestAnimationFrame(tick);
  initializeContent();
  return () => {
    disposed = true;
    lifetime.abort();
    Object.assign(savedPattern, {
      index: patternIndex,
      elapsed: patternElapsed,
      time: patternTime,
      paused: patternsPaused,
    });
    cancelAnimationFrame(frame);
    window.clearTimeout(toastTimer);
    closingObserver.disconnect();
    clearClosingEffects();
    clearCards();
    previewRevision += 1;
    dialogHandle?.dispose();
    headerRevision += 1;
    headerHandle?.dispose();
    dialog.close();
    searchDialog.close();
  };
}

let disposeMarketing = initializeMarketing();
window.addEventListener('pagehide', () => disposeMarketing());
window.addEventListener('pageshow', (event) => {
  if (event.persisted) {
    disposeMarketing = initializeMarketing();
  }
});
