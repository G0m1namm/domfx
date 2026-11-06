import {
  createControlBox,
  type ControlBox,
  type ControlBoxStatus,
  type ControlBoxTargetKind,
} from '@domfx/site/control-box';
import { controlBoxMessages } from '@domfx/site/control-box-messages';
import {
  marketingEffectSearch,
  parseMarketingEffectSearch,
  withoutMarketingEffectSearch,
  type EffectSettings,
} from '@domfx/site/effect-settings';
import type { EffectSlot } from '@domfx/site/effect-slot';
import { createEffectEnvironment, createEffectSlot } from '@domfx/site/effect-slot';
import type { Effect } from '@domfx/site/effects';
import { findEffect, patternEffects } from '@domfx/site/effects';
import { localeFromPath, localePath } from '@domfx/site/locale';
import { initializePage } from '@domfx/site/page-lifetime';
import { initializePreviewZoom } from '@domfx/site/preview-zoom';
import { glideSelection } from '@domfx/site/selection-glide';

import { marketingMessages } from '../content/marketing-copy';
import { initializeSiteSearch } from './site-search';

const savedPattern = { index: 0, elapsed: 0, time: 3.2, paused: false, needsResume: false };

function initializeMarketing() {
  const locale = localeFromPath(location.pathname);
  const m = marketingMessages[locale];
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
    openEffect: (result) => openCardPreview(result),
  });
  const previewFrame = required<HTMLElement>('.dialog-frame', dialog);
  const previewScene = required<HTMLElement>('.dialog-scene', dialog);
  const previewHost = required<HTMLElement>('.dialog-stage', dialog);
  const previewStatus = required<HTMLElement>('[data-preview-status]', dialog);
  const zoomTools = required<HTMLElement>('[data-zoom-tools]', dialog);
  let filter =
    document.querySelector<HTMLElement>('[data-filter][aria-pressed="true"]')?.dataset.filter ??
    'All';
  // One box per open dialog: each effect's markup differs, and closing releases its output.
  let preview: { box: ControlBox; root: HTMLElement; lifetime: AbortController } | undefined;
  let previewTarget: HTMLElement | undefined;
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

  function updatePatternPlayback() {
    const paused = patternsPaused || reducedMotion.matches;
    for (const button of document.querySelectorAll<HTMLButtonElement>('[data-closing-pause]')) {
      button.disabled = reducedMotion.matches || !hasGpu;
      button.setAttribute('aria-pressed', String(paused));
      let label: string;
      if (!hasGpu) {
        label = m.effectsUnavailable;
      } else if (reducedMotion.matches) {
        label = m.reducedMotion;
      } else {
        label = paused ? m.resumeAutomatic : m.pauseAutomatic;
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
      patternEnvironment.update();
    }
    updatePatternPlayback();
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
    delete document.documentElement.dataset.initialAudience;
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
        const label = count >= 50 ? m.stars : m.star;
        required('[data-star-label]', cta).textContent = label;
        const badge = required<HTMLElement>('[data-star-count]', cta);
        badge.hidden = count < 50;
        badge.textContent = new Intl.NumberFormat(locale, {
          notation: 'compact',
          maximumFractionDigits: 1,
        }).format(count);
        const visibleLabel = count >= 50 ? `${label} ${badge.textContent}` : label;
        cta.setAttribute(
          'aria-label',
          `${visibleLabel}: ${count.toLocaleString(locale)} ${m.githubStars}`,
        );
        cta.title = `${count.toLocaleString(locale)} ${m.githubStars}`;
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
      glideSelection(required('.audience-tabs', main), {
        items: '[data-audience]',
        selected: '[aria-selected="true"]',
        variant: 'line',
        signal: lifetime.signal,
      });
    } else {
      glideSelection(required('.filters', main), {
        items: '[data-filter]',
        selected: '[aria-pressed="true"]',
        variant: 'fill',
        signal: lifetime.signal,
      });
    }
    observeCards();
    void showHeaderEffect();
    for (const control of document.querySelectorAll<HTMLElement>('[data-js-control]')) {
      control.hidden = false;
    }
  }

  async function copy(text: string) {
    const toast = required<HTMLElement>('.toast');
    try {
      await navigator.clipboard.writeText(text);
      if (disposed) {
        return;
      }
      toast.textContent = m.copied;
    } catch {
      if (disposed) {
        return;
      }
      toast.textContent = `${m.copyManually} ${text}`;
    }
    toast.hidden = false;
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      toast.hidden = true;
    }, 4500);
  }

  function previewStatusMessage(status: ControlBoxStatus) {
    if (status.lifecycle === 'active') {
      if (status.paused) {
        return m.statusPaused;
      }
      return status.held ? m.statusHeld : m.statusActive;
    }
    if (status.reason === 'no-webgpu') {
      return m.statusNoGpu;
    }
    if (status.reason === 'reduced-motion') {
      return status.reducedMotion ? m.statusReducedMotion : m.statusRestart;
    }
    if (status.lifecycle === 'initializing' || !status.reason) {
      return m.statusPreparing;
    }
    if (status.lifecycle === 'suspended') {
      return m.statusStatic;
    }
    return locale === 'en' ? `${m.statusStatic} · ${status.reason}` : m.statusUnavailable;
  }

  /** The target kind that preserves the selected card's subject. */
  function subjectKind(subject: Element | undefined) {
    if (subject instanceof HTMLImageElement) {
      return 'image';
    }
    return subject instanceof SVGElement ? 'svg' : 'text';
  }

  function createPreviewTarget(kind: ControlBoxTargetKind, subject: Element | undefined) {
    const target = document.createElement('span');
    target.className = 'dialog-target';
    target.dataset.dialogTarget = '';
    target.dataset.kind = kind;
    if (kind === 'text') {
      target.textContent = subject?.matches('span') ? subject.textContent : m.previewWord;
      return target;
    }
    const selector = kind === 'image' ? 'img' : 'svg';
    const template = required<HTMLTemplateElement>(`[data-preview-${kind}]`, dialog);
    const source = subject?.matches(selector) ? subject : required(selector, template.content);
    const content = source.cloneNode(true);
    if (content instanceof Element) {
      content.removeAttribute('class');
      content.removeAttribute('style');
      content.removeAttribute('data-preview');
    }
    target.append(content);
    return target;
  }

  function showPreviewTarget(kind: ControlBoxTargetKind, subject: Element | undefined) {
    const target = createPreviewTarget(kind, subject);
    previewHost.replaceChildren(target);
    previewTarget = target;
    return target;
  }

  function releasePreview() {
    if (!preview) {
      return;
    }
    const { box, root, lifetime: zoomLifetime } = preview;
    preview = undefined;
    zoomLifetime.abort();
    box.dispose();
    root.remove();
    previewHost.replaceChildren();
    previewTarget = undefined;
  }

  // The output and controls stay through the dialog's exit, so nothing pops or hitches mid-fade.
  async function releasePreviewAfterExit() {
    const closing = preview;
    await Promise.allSettled(dialog.getAnimations().map((animation) => animation.finished));
    if (closing && closing === preview && !dialog.open) {
      releasePreview();
      observeCards();
    }
  }

  // Only Copy link writes settings to the URL, and a link names an open dialog. Closing it drops
  // that name, so a reload does not reopen what the viewer dismissed. Other params stay.
  function forgetPreviewLink() {
    const url = new URL(location.href);
    const search = withoutMarketingEffectSearch(url.search);
    if (search !== url.search) {
      url.search = search;
      history.replaceState(history.state, '', url);
    }
  }

  function openPreview(effect: Effect, returnFocus: HTMLElement, settings?: EffectSettings) {
    releasePreview();
    clearCards();
    previewReturnFocus = returnFocus;
    const subject =
      document.querySelector(`[data-card][data-id="${effect.id}"] [data-preview]`) ?? undefined;
    const kind = subjectKind(subject);
    const template = required<HTMLTemplateElement>(`[data-box-template="${effect.id}"]`, dialog);
    const root = required<HTMLElement>('[data-control-box]', template.content).cloneNode(true);
    if (!(root instanceof HTMLElement)) {
      throw new Error(`Missing control box for ${effect.id}`);
    }
    required<HTMLInputElement>(`[data-box-radio="target"][value="${kind}"]`, root).checked = true;
    required('#dialog-title', dialog).textContent = effect.name;
    required<HTMLAnchorElement>('[data-effect-reference]', dialog).href = localePath(
      { kind: 'effect-reference', effect: effect.id },
      locale,
    );
    previewScene.dataset.effect = effect.id;
    previewScene.dataset.category = effect.category;
    showPreviewTarget(kind, subject);
    previewFrame.append(root);
    dialog.showModal();
    dialog.scrollTop = 0;
    const zoomLifetime = new AbortController();
    const target = () => previewTarget ?? previewHost;
    const zoom = initializePreviewZoom({
      viewport: previewScene,
      camera: previewHost,
      tools: zoomTools,
      target,
      signal: zoomLifetime.signal,
      reducedMotion,
    });
    const box = createControlBox({
      root,
      effect,
      locale,
      messages: controlBoxMessages(locale),
      surface: {
        frame: dialog,
        stage: previewScene,
        host: previewHost,
        zoomTools,
        target,
        selectTarget: (next) => showPreviewTarget(next, subject),
      },
      ...(settings ? { initial: { settings } } : {}),
      status: { element: previewStatus, message: previewStatusMessage },
      linkSearch: marketingEffectSearch,
      onTargetChange: zoom.reset,
    });
    preview = { box, root, lifetime: zoomLifetime };
  }

  function openCardPreview(trigger: HTMLElement) {
    const effect = findEffect(trigger.dataset.id);
    if (!effect) {
      throw new Error(`Unknown effect: ${trigger.dataset.id}`);
    }
    openPreview(effect, trigger);
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
      required<HTMLElement>('.effect-grid', main).dataset.filterReveal = 'true';
      applyFilters();
    } else if (element.hasAttribute('data-card')) {
      openCardPreview(element);
    } else if (element.hasAttribute('data-close')) {
      dialog.close();
    } else if (element.dataset.copy) {
      void copy(element.dataset.copy);
    }
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
    forgetPreviewLink();
    void releasePreviewAfterExit();
    const returnTo = previewReturnFocus?.closest('dialog') ? searchTrigger : previewReturnFocus;
    returnTo?.focus({ preventScroll: true });
  });
  let lastPatternTime = 0;
  document.addEventListener(
    'visibilitychange',
    () => {
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
    if (!disposed) {
      frame = requestAnimationFrame(tick);
    }
  }
  frame = requestAnimationFrame(tick);
  initializeContent();
  // A settings link names its dialog; an unknown effect or bad value opens or changes nothing.
  const link = parseMarketingEffectSearch(location.search);
  if (link) {
    const card = main.querySelector<HTMLElement>(`[data-card][data-id="${link.effect.id}"]`);
    openPreview(link.effect, card ?? searchTrigger, link.settings);
  }
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
    releasePreview();
    headerSlot.dispose();
    dialog.close();
    searchDialog.close();
  };
}

initializePage(initializeMarketing);
