import type { EffectSlot, EffectStatus } from '@domfx/site/effect-slot';
import { createEffectEnvironment, createEffectSlot } from '@domfx/site/effect-slot';
import type { Effect } from '@domfx/site/effects';
import { effects, findEffect, patternEffects } from '@domfx/site/effects';
import { initializePage } from '@domfx/site/page-lifetime';

import { initializeSiteSearch } from './site-search';

const savedPattern = { index: 0, elapsed: 0, time: 3.2, paused: false, needsResume: false };

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
  // Search includes every effect, including those outside the homepage selection.
  const { dialog: searchDialog, trigger: searchTrigger } = initializeSiteSearch({
    signal: lifetime.signal,
    isBlocked: () => dialog.open,
    onOpen: () => clearCards(),
    onClose: () => observeCards(),
    openEffect: (result) => openPreview(result),
  });
  const intensity = required<HTMLInputElement>('#effect-intensity');
  const dialogScene = required<HTMLElement>('.dialog-scene', dialog);
  const dialogStage = required<HTMLElement>('.dialog-stage', dialog);
  const zoomOut = required<HTMLButtonElement>('[data-zoom-out]', dialog);
  const zoomIn = required<HTMLButtonElement>('[data-zoom-in]', dialog);
  const zoomLabel = required<HTMLElement>('[data-zoom-label]', dialog);
  const panControls = required<HTMLElement>('.preview-pan-controls', dialog);
  const canHover = matchMedia('(hover: hover) and (pointer: fine)');
  let previewZoom = 1;
  let hoverZoom = false;
  let panX = 0;
  let panY = 0;
  let previewDrag: { id: number; x: number; y: number } | undefined;
  let filter =
    document.querySelector<HTMLElement>('[data-filter][aria-pressed="true"]')?.dataset.filter ??
    'All';
  let selectedEffect: Effect = effects[0];
  let targetKind: 'text' | 'svg' | 'image' = 'text';
  let previewSubject: Element | undefined;
  let paused = false;
  let previewTime = 2.4;
  let previewNeedsResume = false;
  let previewReturnFocus: HTMLElement | undefined;
  const cardSlots = new Map<HTMLElement | SVGElement, EffectSlot>();

  // Reflect only this decorative output canvas; captured geometry stays axis-aligned.
  const headerHost = required<HTMLElement>('.header-effect-host');
  const headerLine = required<HTMLElement>('.header-effect-line', headerHost);
  // The header and closing artwork share one cycle, with independent attachments.
  const patternRamp = 1.2;
  const patternHold = 6;
  const patternPeak = 0.85;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let patternIndex = savedPattern.index;
  let patternElapsed = savedPattern.elapsed;
  let patternTime = savedPattern.time;
  let lastReducedMotion = reducedMotion.matches;
  let patternsPaused = savedPattern.paused || lastReducedMotion;
  let motionNeedsResume = savedPattern.needsResume || lastReducedMotion;
  const patternEnvironment = createEffectEnvironment({
    document,
    reducedMotion,
    needsResume: () => motionNeedsResume,
  });
  const previewEnvironment = createEffectEnvironment({
    document,
    reducedMotion,
    needsResume: () => previewNeedsResume,
  });
  const headerSlot = createEffectSlot({
    host: headerHost,
    environment: patternEnvironment,
    onChange: () => syncPatternEffects(),
  });
  const closingHost = required<HTMLElement>('#closing-content');
  const closingSlot = createEffectSlot({
    host: required<HTMLElement>('[data-closing-host]', closingHost),
    environment: patternEnvironment,
    onChange: () => syncPatternEffects(),
  });
  const dialogSlot = createEffectSlot({
    host: dialogStage,
    environment: previewEnvironment,
    onChange: updatePreviewStatus,
  });

  function updatePatternPlayback() {
    const paused = patternsPaused || reducedMotion.matches;
    for (const button of document.querySelectorAll<HTMLButtonElement>('[data-closing-pause]')) {
      button.disabled = reducedMotion.matches || !hasGpu;
      button.setAttribute('aria-pressed', String(paused));
      let label: string;
      if (!hasGpu) {
        label = 'Effects unavailable';
      } else if (reducedMotion.matches) {
        label = 'Reduced motion';
      } else {
        label = paused ? 'Resume automatic effects' : 'Pause automatic effects';
      }
      button.setAttribute('aria-label', label);
      button.innerHTML = `<svg class="ui-icon" viewBox="0 0 256 256" aria-hidden="true"><use href="#ph-${paused ? 'play' : 'pause'}"/></svg><span>${label}</span>`;
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

  function closingIntensity() {
    return Math.min(1, patternIntensity() * 1.6);
  }

  function syncPatternEffects() {
    const intensity = patternIntensity();
    const headerHandle = headerSlot.handle;
    if (headerHandle) {
      headerHandle.time = patternTime;
      headerHandle.intensity = intensity;
    }
    const closingHandle = closingSlot.handle;
    if (closingHandle) {
      closingHandle.time = patternTime;
      closingHandle.intensity = closingIntensity();
    }
    for (const host of [headerHost, closingHost]) {
      host.dataset.effect = patternEffects[patternIndex].id;
      host.dataset.time = patternTime.toFixed(3);
      host.dataset.intensity = (host === closingHost ? closingIntensity() : intensity).toFixed(3);
      host.dataset.phase =
        patternElapsed < patternRamp
          ? 'rising'
          : patternElapsed < patternRamp + patternHold
            ? 'holding'
            : 'falling';
    }
  }

  function showHeaderEffect() {
    return headerSlot.show(headerLine, patternEffects[patternIndex], () => ({
      clock: 'manual',
      intensity: patternIntensity(),
      time: patternTime,
      seed: 182,
    }));
  }

  function togglePatterns() {
    patternsPaused = !patternsPaused;
    if (!patternsPaused && motionNeedsResume) {
      motionNeedsResume = false;
      patternEnvironment.update();
      observeCards();
    }
    for (const slot of cardSlots.values()) {
      if (patternsPaused) {
        slot.handle?.pause();
      } else {
        slot.handle?.resume();
      }
    }
    updatePatternPlayback();
  }

  function syncMotionPreference() {
    lastReducedMotion = reducedMotion.matches;
    if (lastReducedMotion) {
      patternsPaused = true;
      motionNeedsResume = true;
      paused = true;
      previewNeedsResume = true;
      patternEnvironment.update();
      previewEnvironment.update();
    }
    updatePatternPlayback();
    updatePreviewPlayback();
  }

  on(reducedMotion, 'change', syncMotionPreference);
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
          cardSlots.get(target)?.dispose();
          cardSlots.delete(target);
        }
      }
    },
    { threshold: 0.08 },
  );

  function attachCard(target: HTMLElement | SVGElement) {
    if (disposed || cardSlots.has(target)) {
      return;
    }
    const effect = findEffect(target.dataset.preview);
    const host = target.closest<HTMLElement>('[data-effect-host]');
    if (!effect || !host) {
      return;
    }
    const slot = createEffectSlot({
      host,
      environment: patternEnvironment,
      onChange: () => {
        if (patternsPaused) {
          slot.handle?.pause();
        }
      },
    });
    cardSlots.set(target, slot);
    return slot.show(target, effect, () => ({
      clock: 'ambient',
      intensity: 0.7,
      time: 2.4,
      seed: 314,
    }));
  }

  function clearCards() {
    observer.disconnect();
    for (const slot of cardSlots.values()) {
      slot.dispose();
    }
    cardSlots.clear();
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
      for (const cta of document.querySelectorAll<HTMLAnchorElement>('[data-repo-stars]')) {
        const label = count >= 50 ? 'Stars' : 'Star on GitHub';
        required('[data-star-label]', cta).textContent = label;
        const badge = required<HTMLElement>('[data-star-count]', cta);
        badge.hidden = count < 50;
        badge.textContent = new Intl.NumberFormat('en', {
          notation: 'compact',
          maximumFractionDigits: 1,
        }).format(count);
        const visibleLabel = count >= 50 ? `${label} ${badge.textContent}` : label;
        cta.setAttribute(
          'aria-label',
          `${visibleLabel}: ${count.toLocaleString('en')} GitHub stars`,
        );
        cta.title = `${count.toLocaleString('en')} GitHub stars`;
      }
    } catch {
      /* The native GitHub link remains usable when public stats are unavailable. */
    }
  }
  void loadRepositoryStars();

  // Release the closing artwork offscreen; rejoining never resets the shared cycle.
  let closingVisible = false;

  function attachClosingEffects() {
    if (closingVisible) {
      const effect = patternEffects[patternIndex];
      const target = required<HTMLImageElement>('[data-closing-target]', closingHost);
      target.dataset.effect = effect.id;
      return closingSlot.show(target, effect, () => ({
        clock: 'manual',
        intensity: closingIntensity(),
        time: patternTime,
        seed: 182,
      }));
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
          closingSlot.clear();
        }
      }
    },
    { threshold: 0.08 },
  );

  function initializeContent() {
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
    const effect = selectedEffect;
    return `import { ${effect.exportName} } from '@domfx/browser';\n\nconst effect = ${effect.exportName}(element, { host, clock: 'ambient', intensity: ${(Number(intensity.value) / 100).toFixed(2)} });\n\n// On unmount: effect.dispose();`;
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
    panControls.hidden = previewZoom <= 1;
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

  function panPreview(direction: string) {
    hoverZoom = false;
    switch (direction) {
      case 'left':
        panX += 32;
        break;
      case 'right':
        panX -= 32;
        break;
      case 'up':
        panY += 32;
        break;
      case 'down':
        panY -= 32;
        break;
    }
    updatePreviewZoom();
  }

  on(dialogScene, 'keydown', (event) => {
    if (['+', '=', '-', '0'].includes(event.key)) {
      event.preventDefault();
      setPreviewZoom(event.key === '0' ? 1 : previewZoom + (event.key === '-' ? -0.5 : 0.5));
    } else if (
      previewZoom > 1 &&
      ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)
    ) {
      event.preventDefault();
      panPreview(event.key.slice(5).toLowerCase());
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

  function updatePreviewStatus(status: EffectStatus) {
    if (dialogSlot.handle) {
      dialogSlot.handle.intensity = Number(intensity.value) / 100;
    }
    required('[data-preview-status]', dialog).textContent =
      status.reason === 'reduced-motion'
        ? 'Animation paused for reduced motion.'
        : status.reason === 'no-webgpu'
          ? 'WebGPU is unavailable. Your HTML stays visible.'
          : status.lifecycle === 'initializing'
            ? 'Preparing the live preview…'
            : status.lifecycle === 'active'
              ? 'Live preview · WebGPU'
              : status.reason
                ? `Static content · ${status.reason}`
                : 'Effect unavailable. Your HTML stays visible.';
  }

  function showDialogEffect() {
    const target = document.createElement('span');
    target.className = 'dialog-target';
    target.dataset.dialogTarget = '';
    target.dataset.kind = targetKind;
    if (targetKind === 'text') {
      target.textContent = previewSubject?.matches('span') ? previewSubject.textContent : 'edge.';
    } else {
      const selector = targetKind === 'image' ? 'img' : 'svg';
      const template = required<HTMLTemplateElement>(`[data-preview-${targetKind}]`, dialog);
      const source = previewSubject?.matches(selector)
        ? previewSubject
        : required(selector, template.content);
      const content = source.cloneNode(true);
      if (content instanceof Element) {
        content.removeAttribute('class');
        content.removeAttribute('style');
        content.removeAttribute('data-preview');
      }
      target.append(content);
    }
    dialogStage.replaceChildren(target);
    required('#dialog-title', dialog).textContent = selectedEffect.name;
    required<HTMLAnchorElement>('[data-effect-reference]', dialog).href =
      `/docs/api/effects/${selectedEffect.id}/`;
    required('[data-dialog-category]', dialog).textContent = selectedEffect.category;
    dialogScene.dataset.effect = selectedEffect.id;
    dialogScene.dataset.category = selectedEffect.category;
    required('[data-code]', dialog).textContent = attachmentCode();
    required('[data-preview-status]', dialog).textContent = 'Preparing the live preview…';
    for (const button of dialog.querySelectorAll<HTMLElement>('[data-target]')) {
      button.setAttribute('aria-pressed', String(button.dataset.target === targetKind));
    }
    const effect = selectedEffect;
    if (disposed) {
      return;
    }
    updatePreviewPlayback();
    return dialogSlot.show(target, effect, () => {
      setPreviewZoom(previewZoom);
      return {
        clock: 'manual',
        seed: 314,
        intensity: Number(intensity.value) / 100,
        time: previewTime,
      };
    });
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
    const effect = findEffect(trigger.dataset.id);
    if (!effect) {
      throw new Error(`Unknown effect: ${trigger.dataset.id}`);
    }
    selectedEffect = effect;
    clearCards();
    previewSubject =
      document.querySelector(`[data-card][data-id="${effect.id}"] [data-preview]`) ?? undefined;
    targetKind =
      previewSubject instanceof HTMLImageElement
        ? 'image'
        : previewSubject instanceof SVGElement
          ? 'svg'
          : 'text';
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
    } else if (element.dataset.pan) {
      panPreview(element.dataset.pan);
    } else if (
      element.dataset.target === 'text' ||
      element.dataset.target === 'svg' ||
      element.dataset.target === 'image'
    ) {
      targetKind = element.dataset.target;
      void showDialogEffect();
    } else if (element.hasAttribute('data-pause')) {
      paused = !paused;
      if (!paused) {
        previewNeedsResume = false;
        previewEnvironment.update();
      }
      updatePreviewPlayback();
      if (!paused && !dialogSlot.handle && dialogSlot.status.lifecycle !== 'initializing') {
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
    if (dialogSlot.handle) {
      dialogSlot.handle.intensity = Number(intensity.value) / 100;
    }
    required('[data-code]', dialog).textContent = attachmentCode();
  });

  let backdropPointer: number | undefined;
  function isBackdrop(event: PointerEvent) {
    const bounds = dialog.getBoundingClientRect();
    return (
      event.target === dialog &&
      (event.clientX < bounds.left ||
        event.clientX > bounds.right ||
        event.clientY < bounds.top ||
        event.clientY > bounds.bottom)
    );
  }

  on(dialog, 'pointerdown', (event) => {
    backdropPointer = event.button === 0 && isBackdrop(event) ? event.pointerId : undefined;
  });
  on(dialog, 'pointerup', (event) => {
    const dismiss = backdropPointer === event.pointerId && isBackdrop(event);
    backdropPointer = undefined;
    if (dismiss) {
      dialog.close();
    }
  });
  on(dialog, 'pointercancel', () => {
    backdropPointer = undefined;
  });
  on(dialog, 'close', () => {
    backdropPointer = undefined;
    dialogSlot.clear();
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
    },
    { signal: lifetime.signal },
  );
  function tick(now: number) {
    // Reconcile an early matches read even if Chromium omits the change event.
    if (reducedMotion.matches !== lastReducedMotion) {
      syncMotionPreference();
    }
    const headerHandle = headerSlot.handle;
    const closingHandle = closingSlot.handle;
    const dialogHandle = dialogSlot.handle;
    const patternsActive =
      headerHandle?.lifecycle === 'active' || closingHandle?.lifecycle === 'active';
    if (
      patternsActive &&
      headerSlot.status.lifecycle !== 'initializing' &&
      closingSlot.status.lifecycle !== 'initializing' &&
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
        previewTime += Math.min((now - lastTime) / 1000, 0.05);
      }
      dialogHandle.time = previewTime;
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
      needsResume: motionNeedsResume,
    });
    cancelAnimationFrame(frame);
    window.clearTimeout(toastTimer);
    closingObserver.disconnect();
    closingSlot.dispose();
    clearCards();
    dialogSlot.dispose();
    headerSlot.dispose();
    dialog.close();
    searchDialog.close();
  };
}

initializePage(initializeMarketing);
