import { effectExtentReference, type ExtentField } from '@domfx/site/effect-extent';
import type { EffectStatus } from '@domfx/site/effect-slot';
import { createEffectEnvironment, createEffectSlot } from '@domfx/site/effect-slot';
import { findEffect, type Effect } from '@domfx/site/effects';
import { localeFromPath } from '@domfx/site/locale';
import { initializePage } from '@domfx/site/page-lifetime';

import { docsMessages } from '../content/docs-messages';

const SEED = 314;
const COPY_RESET_MS = 2000;

const savedPlayback = new WeakMap<HTMLElement, { paused: boolean; needsResume: boolean }>();

function initializeLabs() {
  const hasGpu = 'gpu' in navigator && Boolean(navigator.gpu);
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const cleanups: (() => void)[] = [];
  for (const lab of document.querySelectorAll<HTMLElement>('[data-docs-lab]')) {
    const effect = findEffect(lab.dataset.effect);
    if (!effect) {
      throw new Error(`Unknown docs lab effect: ${lab.dataset.effect}`);
    }
    cleanups.push(initializeLab(lab, effect, hasGpu, reducedMotion));
  }
  return () => cleanups.forEach((cleanup) => cleanup());
}

function initializeLab(
  lab: HTMLElement,
  effect: Effect,
  hasGpu: boolean,
  reducedMotion: MediaQueryList,
) {
  const messages = docsMessages(localeFromPath(location.pathname)).lab;
  const host = required<HTMLElement>('[data-docs-lab-host]', lab);
  const targets = Array.from(
    lab.querySelectorAll<HTMLElement | SVGElement>('[data-docs-lab-target]'),
  );
  const subjects = Array.from(lab.querySelectorAll<HTMLInputElement>('[data-docs-lab-subject]'));
  const controls = required<HTMLFieldSetElement>('[data-docs-lab-controls]', lab);
  const intensityInput = required<HTMLInputElement>('[data-docs-lab-intensity]', lab);
  const intensityOutput = required<HTMLOutputElement>('[data-docs-lab-intensity-output]', lab);
  const intensityCode = required<HTMLOutputElement>('[data-docs-lab-intensity-code]', lab);
  const extentInputs = (effectExtentReference(effect)?.fields ?? []).map((field) => ({
    name: field.name,
    input: required<HTMLInputElement>(`[data-docs-lab-extent="${field.name}"]`, lab),
    output: required<HTMLOutputElement>(`[data-docs-lab-extent-output="${field.name}"]`, lab),
    code: required<HTMLOutputElement>(`[data-docs-lab-extent-code="${field.name}"]`, lab),
  }));
  const status = required<HTMLElement>('[data-docs-lab-status]', lab);
  const toggle = required<HTMLButtonElement>('[data-docs-lab-toggle]', lab);
  const toggleIcon = required<SVGUseElement>('use', toggle);
  const copy = required<HTMLButtonElement>('[data-docs-lab-copy]', lab);
  const copyLabel = required<HTMLElement>('[data-docs-lab-copy-label]', copy);
  const code = required<HTMLElement>('[data-docs-lab-code]', lab);
  const lifetime = new AbortController();
  const { signal } = lifetime;
  let visible = false;
  let paused = savedPlayback.get(lab)?.paused ?? false;
  let needsResume = reducedMotion.matches || (savedPlayback.get(lab)?.needsResume ?? false);
  let copyTimer = 0;
  const environment = createEffectEnvironment({
    document: lab.ownerDocument,
    reducedMotion,
    needsResume: () => needsResume,
  });
  const slot = createEffectSlot({ host, environment, onChange: updateStatus });

  const intensity = () => Number(intensityInput.value) / 100;
  const currentTarget = () =>
    targets.find((target) => !target.hasAttribute('hidden')) ?? targets[0];

  function updateValues() {
    intensityOutput.value = `${intensityInput.value}%`;
    intensityCode.value = String(intensity());
    setFill(intensityInput);
    for (const { input, output, code } of extentInputs) {
      output.value = `${input.value}%`;
      code.value = String(Number(input.value) / 100);
      setFill(input);
    }
  }

  function updateStatus(next: EffectStatus) {
    lab.dataset.status = next.lifecycle;
    lab.dataset.paused = String(paused);
    if (next.reason) {
      lab.dataset.reason = next.reason;
    } else {
      delete lab.dataset.reason;
    }
    if (next.lifecycle === 'active') {
      if (paused) {
        slot.handle?.pause();
      }
      if (slot.handle) {
        slot.handle.intensity = intensity();
      }
      status.textContent = paused ? messages.paused : messages.live;
    } else if (next.reason === 'no-webgpu') {
      status.textContent = messages.noGpu;
    } else if (next.reason === 'reduced-motion') {
      status.textContent = reducedMotion.matches ? messages.reducedMotion : messages.restart;
    } else if (next.lifecycle === 'initializing') {
      status.textContent = messages.preparing;
    } else if (next.lifecycle === 'suspended') {
      status.textContent = messages.waiting;
    } else {
      status.textContent = messages.unavailable;
    }
    updateToggle();
  }

  function updateToggle() {
    const handle = slot.handle;
    const unavailable = !hasGpu || reducedMotion.matches;
    controls.disabled = unavailable;
    toggle.disabled = unavailable;
    toggle.setAttribute('aria-pressed', String(paused));
    let label: string;
    if (!hasGpu) {
      label = messages.effectsUnavailable;
    } else if (reducedMotion.matches) {
      label = messages.reducedMotionLabel;
    } else if (!handle || handle.lifecycle !== 'active') {
      label = messages.start;
    } else {
      label = paused ? messages.resume : messages.pause;
    }
    toggle.setAttribute('aria-label', label);
    toggle.title = label;
    const playing = handle?.lifecycle === 'active' && !paused;
    toggleIcon.setAttribute('href', playing ? '#ph-pause' : '#ph-play');
  }

  function attach() {
    if (!visible) {
      return;
    }
    const extents: Partial<Record<ExtentField['name'], number>> = {};
    for (const { name, input } of extentInputs) {
      extents[name] = Number(input.value) / 100;
    }
    return slot.show(currentTarget(), effect, () => ({
      clock: 'auto',
      motion: 'respect',
      intensity: intensity(),
      seed: SEED,
      ...extents,
    }));
  }

  function selectSubject(value: string) {
    paused = false;
    for (const target of targets) {
      target.toggleAttribute('hidden', target.dataset.docsLabTarget !== value);
    }
    void attach();
  }

  async function copySettings() {
    window.clearTimeout(copyTimer);
    try {
      await navigator.clipboard.writeText(code.textContent ?? '');
      copyLabel.textContent = messages.copied;
    } catch {
      getSelection()?.selectAllChildren(code);
      copyLabel.textContent = messages.copyManually;
    }
    copyTimer = window.setTimeout(() => {
      copyLabel.textContent = messages.copy;
    }, COPY_RESET_MS);
  }

  function dispose() {
    savedPlayback.set(lab, { paused, needsResume });
    window.clearTimeout(copyTimer);
    lifetime.abort();
    observer.disconnect();
    slot.dispose();
  }

  const observer = new IntersectionObserver(
    ([entry]) => {
      visible = entry.isIntersecting && entry.intersectionRatio > 0;
      if (!visible) {
        return;
      }
      if (
        slot.status.lifecycle !== 'initializing' &&
        (!slot.handle || slot.handle.reason === 'stale-raster')
      ) {
        void attach();
      }
    },
    { threshold: Number.EPSILON },
  );

  updateValues();
  updateToggle();
  status.textContent = hasGpu ? messages.waiting : messages.noGpu;
  lab.dataset.paused = String(paused);
  observer.observe(host);

  intensityInput.addEventListener(
    'input',
    () => {
      updateValues();
      if (slot.handle?.lifecycle === 'active') {
        slot.handle.intensity = intensity();
      }
    },
    { signal },
  );
  for (const { input } of extentInputs) {
    input.addEventListener('input', updateValues, { signal });
    input.addEventListener('change', () => void attach(), { signal });
  }
  for (const subject of subjects) {
    subject.addEventListener('change', () => selectSubject(subject.value), { signal });
  }
  copy.addEventListener('click', () => void copySettings(), { signal });
  toggle.addEventListener(
    'click',
    () => {
      const handle = slot.handle;
      if (!handle || handle.lifecycle !== 'active') {
        needsResume = false;
        environment.update();
        if (slot.status.lifecycle !== 'initializing') {
          void attach();
        }
        return;
      }
      paused = !paused;
      if (paused) {
        handle.pause();
      } else {
        handle.resume();
      }
      updateStatus(slot.status);
    },
    { signal },
  );
  reducedMotion.addEventListener(
    'change',
    () => {
      if (reducedMotion.matches) {
        paused = false;
        needsResume = true;
      }
      environment.update();
      updateStatus(slot.status);
    },
    { signal },
  );
  return dispose;
}

function setFill(input: HTMLInputElement) {
  const min = Number(input.min);
  const max = Number(input.max);
  input.style.setProperty('--fill', `${((Number(input.value) - min) / (max - min)) * 100}%`);
}

function required<T extends Element>(selector: string, root: ParentNode): T {
  const element = root.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Missing docs lab element: ${selector}`);
  }
  return element;
}

initializePage(initializeLabs);
