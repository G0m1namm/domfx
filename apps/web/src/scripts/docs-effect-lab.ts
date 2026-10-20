import type * as BrowserEffects from '@domfx/browser';
import type { AttachmentOptions, EffectHandle } from '@domfx/browser';

import { findEffect, type Effect } from '../content/effects';

type Factory = (target: Element, options: AttachmentOptions) => EffectHandle;

const SEED = 314;
const COPY_RESET_MS = 2000;

let browserModule: Promise<typeof BrowserEffects> | undefined;
function loadBrowser() {
  browserModule ??= import('@domfx/browser');
  return browserModule;
}

function initializeLabs() {
  const hasGpu = 'gpu' in navigator && Boolean(navigator.gpu);
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  for (const lab of document.querySelectorAll<HTMLElement>('[data-docs-lab]')) {
    const effect = findEffect(lab.dataset.effect);
    if (!effect) {
      throw new Error(`Unknown docs lab effect: ${lab.dataset.effect}`);
    }
    initializeLab(lab, effect, hasGpu, reducedMotion);
  }
}

function initializeLab(
  lab: HTMLElement,
  effect: Effect,
  hasGpu: boolean,
  reducedMotion: MediaQueryList,
) {
  const host = required<HTMLElement>('[data-docs-lab-host]', lab);
  const targets = Array.from(
    lab.querySelectorAll<HTMLElement | SVGElement>('[data-docs-lab-target]'),
  );
  const subjects = Array.from(lab.querySelectorAll<HTMLInputElement>('[data-docs-lab-subject]'));
  const controls = required<HTMLFieldSetElement>('[data-docs-lab-controls]', lab);
  const intensityInput = required<HTMLInputElement>('[data-docs-lab-intensity]', lab);
  const intensityOutput = required<HTMLOutputElement>('[data-docs-lab-intensity-output]', lab);
  const intensityCode = required<HTMLOutputElement>('[data-docs-lab-intensity-code]', lab);
  const heightInput = lab.querySelector<HTMLInputElement>('[data-docs-lab-height]');
  const heightOutput = lab.querySelector<HTMLOutputElement>('[data-docs-lab-height-output]');
  const heightCode = lab.querySelector<HTMLOutputElement>('[data-docs-lab-height-code]');
  const status = required<HTMLElement>('[data-docs-lab-status]', lab);
  const toggle = required<HTMLButtonElement>('[data-docs-lab-toggle]', lab);
  const toggleIcon = required<SVGUseElement>('use', toggle);
  const copy = required<HTMLButtonElement>('[data-docs-lab-copy]', lab);
  const copyLabel = required<HTMLElement>('[data-docs-lab-copy-label]', copy);
  const code = required<HTMLElement>('[data-docs-lab-code]', lab);
  const lifetime = new AbortController();
  const { signal } = lifetime;
  let visible = false;
  let paused = false;
  let disposed = false;
  let revision = 0;
  let attachFrame = 0;
  let copyTimer = 0;
  let staleRetries = 0;
  let handle: EffectHandle | undefined;

  const intensity = () => Number(intensityInput.value) / 100;
  const currentTarget = () =>
    targets.find((target) => !target.hasAttribute('hidden')) ?? targets[0];

  function updateValues() {
    intensityOutput.value = `${intensityInput.value}%`;
    intensityCode.value = String(intensity());
    setFill(intensityInput);
    if (heightInput && heightOutput && heightCode) {
      heightOutput.value = `${heightInput.value}px`;
      heightCode.value = heightInput.value;
      setFill(heightInput);
    }
  }

  function setStatus(message: string, state: string) {
    status.textContent = message;
    lab.dataset.status = state;
  }

  function updateToggle() {
    const unavailable = !hasGpu || reducedMotion.matches;
    controls.disabled = unavailable;
    toggle.disabled = unavailable;
    toggle.setAttribute('aria-pressed', String(paused));
    const label = !hasGpu
      ? 'Effects unavailable'
      : reducedMotion.matches
        ? 'Reduced motion'
        : !handle || handle.lifecycle !== 'active'
          ? 'Start effect'
          : paused
            ? 'Resume effect'
            : 'Pause effect';
    toggle.setAttribute('aria-label', label);
    toggle.title = label;
    const playing = handle?.lifecycle === 'active' && !paused;
    toggleIcon.setAttribute('href', playing ? '#ph-pause' : '#ph-play');
  }

  async function createHandle(target: HTMLElement | SVGElement): Promise<EffectHandle> {
    const module = await loadBrowser();
    const options: AttachmentOptions = {
      host,
      clock: 'auto',
      motion: 'respect',
      intensity: intensity(),
      seed: SEED,
    };
    if (effect.id === 'fire') {
      return module.attachFire(target, { ...options, flameHeight: Number(heightInput?.value) });
    }
    return (module[effect.exportName] as Factory)(target, options);
  }

  async function attach() {
    const currentRevision = ++revision;
    handle?.dispose();
    handle = undefined;
    paused = false;
    updateToggle();

    if (disposed || !visible) {
      return;
    }
    if (!hasGpu) {
      setStatus(
        'Effects are unavailable in this browser. The original content stays visible.',
        'unavailable',
      );
      return;
    }
    if (reducedMotion.matches) {
      setStatus('Reduced motion keeps this preview still.', 'reduced-motion');
      return;
    }

    setStatus('Preparing the live preview…', 'initializing');
    try {
      const target = currentTarget();
      await document.fonts.ready;
      if (target instanceof HTMLImageElement) {
        await target.decode();
      }
      const nextHandle = await createHandle(target);
      if (disposed || currentRevision !== revision) {
        nextHandle.dispose();
        return;
      }
      handle = nextHandle;
      await nextHandle.ready;
      if (disposed || currentRevision !== revision) {
        nextHandle.dispose();
        return;
      }
      if (nextHandle.lifecycle === 'active') {
        staleRetries = 0;
        delete lab.dataset.reason;
        setStatus('Live', 'active');
      } else if (nextHandle.reason === 'stale-raster' && visible && staleRetries < 1) {
        staleRetries += 1;
        nextHandle.dispose();
        handle = undefined;
        scheduleAttach();
        return;
      } else {
        lab.dataset.reason = nextHandle.reason ?? 'unavailable';
        setStatus(
          'Preview unavailable. The original content stays visible.',
          nextHandle.reason ?? 'unavailable',
        );
      }
      updateToggle();
    } catch (error) {
      if (!disposed && currentRevision === revision) {
        lab.dataset.reason = error instanceof Error ? error.message : String(error);
        setStatus('Preview unavailable. The original content stays visible.', 'unavailable');
        updateToggle();
      }
    }
  }

  function scheduleAttach() {
    cancelAnimationFrame(attachFrame);
    attachFrame = requestAnimationFrame(() => {
      attachFrame = requestAnimationFrame(() => {
        attachFrame = 0;
        if (visible && !handle) {
          void attach();
        }
      });
    });
  }

  function selectSubject(value: string) {
    for (const target of targets) {
      target.toggleAttribute('hidden', target.dataset.docsLabTarget !== value);
    }
    void attach();
  }

  async function copySettings() {
    window.clearTimeout(copyTimer);
    try {
      await navigator.clipboard.writeText(code.textContent ?? '');
      copyLabel.textContent = 'Copied';
    } catch {
      getSelection()?.selectAllChildren(code);
      copyLabel.textContent = 'Press ⌘/Ctrl+C';
    }
    copyTimer = window.setTimeout(() => {
      copyLabel.textContent = 'Copy';
    }, COPY_RESET_MS);
  }

  function dispose() {
    disposed = true;
    revision += 1;
    cancelAnimationFrame(attachFrame);
    window.clearTimeout(copyTimer);
    lifetime.abort();
    observer.disconnect();
    handle?.dispose();
    handle = undefined;
  }

  const observer = new IntersectionObserver(
    ([entry]) => {
      visible = entry.isIntersecting && entry.intersectionRatio > 0;
      if (!visible) {
        staleRetries = 0;
        return;
      }
      if (handle?.reason === 'stale-raster') {
        handle.dispose();
        handle = undefined;
      }
      if (!handle) {
        scheduleAttach();
      }
    },
    { threshold: Number.EPSILON },
  );

  updateValues();
  updateToggle();
  setStatus(
    hasGpu
      ? 'Waiting to enter view.'
      : 'Effects are unavailable in this browser. The original content stays visible.',
    hasGpu ? 'idle' : 'unavailable',
  );
  observer.observe(host);

  intensityInput.addEventListener(
    'input',
    () => {
      updateValues();
      if (handle?.lifecycle === 'active') {
        handle.intensity = intensity();
      }
    },
    { signal },
  );
  heightInput?.addEventListener('input', updateValues, { signal });
  heightInput?.addEventListener('change', () => void attach(), { signal });
  for (const subject of subjects) {
    subject.addEventListener('change', () => selectSubject(subject.value), { signal });
  }
  copy.addEventListener('click', () => void copySettings(), { signal });
  toggle.addEventListener(
    'click',
    () => {
      if (!handle || handle.lifecycle !== 'active') {
        void attach();
        return;
      }
      paused = !paused;
      if (paused) {
        handle.pause();
        setStatus('Paused', 'paused');
      } else {
        handle.resume();
        setStatus('Live', 'active');
      }
      updateToggle();
    },
    { signal },
  );
  reducedMotion.addEventListener(
    'change',
    () => {
      if (reducedMotion.matches) {
        revision += 1;
        handle?.dispose();
        handle = undefined;
        paused = false;
        setStatus('Reduced motion keeps this preview still.', 'reduced-motion');
      } else if (visible) {
        setStatus('Choose Start effect to restart this preview.', 'ready');
      }
      updateToggle();
    },
    { signal },
  );
  window.addEventListener('pagehide', dispose, { once: true, signal });
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

initializeLabs();
