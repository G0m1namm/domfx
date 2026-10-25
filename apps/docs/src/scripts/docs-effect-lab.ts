import {
  effectCreationFields,
  effectColorField,
  effectSettingApiValue,
  effectSettingDisplayValue,
  effectSettingValueText,
  effectWritableFields,
  intensityField,
  isEffectCreationName,
  isEffectWritableName,
  type EffectCreationName,
  type EffectWritableName,
} from '@domfx/site/effect-extent';
import type { EffectStatus } from '@domfx/site/effect-slot';
import {
  createEffectEnvironment,
  createEffectSlot,
  setEffectColor,
  setEffectWritableControl,
} from '@domfx/site/effect-slot';
import { findEffect, type Effect } from '@domfx/site/effects';
import { localeFromPath } from '@domfx/site/locale';
import { initializePage } from '@domfx/site/page-lifetime';

import { docsMessages } from '../content/docs-messages';
import { initializeDocsPreview } from './docs-preview-zoom';

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
  const locale = localeFromPath(location.pathname);
  const messages = docsMessages(locale).lab;
  const host = required<HTMLElement>('[data-docs-lab-host]', lab);
  const targets = Array.from(
    lab.querySelectorAll<HTMLElement | SVGElement>('[data-docs-lab-target]'),
  );
  const subjects = Array.from(lab.querySelectorAll<HTMLInputElement>('[data-docs-lab-subject]'));
  const controls = required<HTMLFieldSetElement>('[data-docs-lab-controls]', lab);
  const intensityInput = required<HTMLInputElement>('[data-docs-lab-intensity]', lab);
  const intensityOutput = required<HTMLOutputElement>(
    '[data-effect-setting-output="intensity"]',
    lab,
  );
  const intensityCode = required<HTMLOutputElement>('[data-docs-lab-intensity-code]', lab);
  const extentInputs = effectCreationFields(effect).map((field) => ({
    name: field.name,
    field,
    input: required<HTMLInputElement | HTMLSelectElement>(
      `[data-docs-lab-extent="${field.name}"]`,
      lab,
    ),
    output: lab.querySelector<HTMLOutputElement>(`[data-effect-setting-output="${field.name}"]`),
    code: required<HTMLOutputElement>(`[data-docs-lab-extent-code="${field.name}"]`, lab),
  }));
  const writableInputs = effectWritableFields(effect).map((field) => ({
    field,
    input: required<HTMLInputElement>(`[data-docs-lab-writable="${field.name}"]`, lab),
    output: required<HTMLOutputElement>(`[data-effect-setting-output="${field.name}"]`, lab),
    code: required<HTMLOutputElement>(`[data-docs-lab-writable-code="${field.name}"]`, lab),
  }));
  const colorField = effectColorField(effect);
  const colorInput = colorField
    ? required<HTMLInputElement>('[data-docs-lab-color]', lab)
    : undefined;
  const colorOutput = colorField
    ? required<HTMLOutputElement>('[data-color-output]', lab)
    : undefined;
  const colorCode = required<HTMLElement>('[data-docs-lab-color-code]', lab);
  const status = required<HTMLElement>('[data-docs-lab-status]', lab);
  const toggle = required<HTMLButtonElement>('[data-docs-lab-toggle]', lab);
  const toggleIcon = required<SVGUseElement>('use', toggle);
  const copy = required<HTMLButtonElement>('[data-docs-lab-copy]', lab);
  const copyLabel = required<HTMLElement>('[data-docs-lab-copy-label]', copy);
  const code = required<HTMLElement>('[data-docs-lab-code]', lab);
  const lifetime = new AbortController();
  const { signal } = lifetime;
  initializeDocsPreview(lab, signal, reducedMotion);
  let visible = false;
  let paused = savedPlayback.get(lab)?.paused ?? false;
  let needsResume = reducedMotion.matches || (savedPlayback.get(lab)?.needsResume ?? false);
  let copyTimer = 0;
  let color: string | undefined;
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
    intensityInput.setAttribute(
      'aria-valuetext',
      effectSettingValueText(intensityField, intensityInput.value, locale),
    );
    intensityCode.value = String(intensity());
    setFill(intensityInput);
    for (const { field, input, output, code } of extentInputs) {
      if (input instanceof HTMLInputElement && output) {
        output.value = effectSettingDisplayValue(field, input.value);
        input.setAttribute('aria-valuetext', effectSettingValueText(field, input.value, locale));
        setFill(input);
      }
      code.value = String(effectSettingApiValue(field, input.value));
    }
    for (const { field, input, output, code } of writableInputs) {
      output.value = effectSettingDisplayValue(field, input.value);
      input.setAttribute('aria-valuetext', effectSettingValueText(field, input.value, locale));
      code.value = String(effectSettingApiValue(field, input.value));
      setFill(input);
    }
    colorCode.textContent = color ? `\n  color: ${JSON.stringify(color)},` : '';
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
        for (const { field, input } of writableInputs) {
          setEffectWritableControl(
            effect,
            slot.handle,
            field,
            effectSettingApiValue(field, input.value),
          );
        }
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
    const extents: Partial<Record<EffectCreationName, number>> = {};
    for (const { name, field, input } of extentInputs) {
      if (!isEffectCreationName(name)) {
        throw new Error(`Unknown creation control: ${name}`);
      }
      extents[name] = effectSettingApiValue(field, input.value);
    }
    const writable: Partial<Record<EffectWritableName, number>> = {};
    for (const { field, input } of writableInputs) {
      if (!isEffectWritableName(field.name)) {
        throw new Error(`Unknown writable control: ${field.name}`);
      }
      writable[field.name] = effectSettingApiValue(field, input.value);
    }
    return slot.show(currentTarget(), effect, () => ({
      clock: 'auto',
      motion: 'respect',
      intensity: intensity(),
      seed: SEED,
      ...extents,
      ...(color ? { color } : {}),
      ...writable,
    }));
  }

  function selectSubject(value: string) {
    paused = false;
    visible = false;
    slot.clear();
    for (const target of targets) {
      target.toggleAttribute('hidden', target.dataset.docsLabTarget !== value);
    }
    observer.disconnect();
    observer.observe(currentTarget());
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
  observer.observe(currentTarget());

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
  for (const { field, input } of writableInputs) {
    input.addEventListener(
      'input',
      () => {
        updateValues();
        if (slot.handle) {
          setEffectWritableControl(
            effect,
            slot.handle,
            field,
            effectSettingApiValue(field, input.value),
          );
        }
      },
      { signal },
    );
  }
  if (colorInput && colorOutput) {
    colorInput.addEventListener(
      'input',
      () => {
        color = colorInput.value;
        colorOutput.value = color;
        required<HTMLElement>('[data-color-setting]', lab).dataset.colorUnset = 'false';
        required<HTMLButtonElement>('[data-color-reset]', lab).disabled = false;
        updateValues();
        if (slot.handle) {
          setEffectColor(effect, slot.handle, color);
        }
      },
      { signal },
    );
    required<HTMLButtonElement>('[data-color-reset]', lab).addEventListener(
      'click',
      () => {
        color = undefined;
        colorOutput.value = locale === 'es' ? 'Colores originales' : 'Original colors';
        required<HTMLElement>('[data-color-setting]', lab).dataset.colorUnset = 'true';
        required<HTMLButtonElement>('[data-color-reset]', lab).disabled = true;
        updateValues();
        if (slot.handle) {
          setEffectColor(effect, slot.handle, undefined);
        }
      },
      { signal },
    );
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
