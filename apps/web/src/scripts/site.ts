import { createAgentPrompt } from './agent-prompt';
import { createEffectTargetSession } from './effect-targets';

function required<T extends Element>(selector: string) {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Missing homepage element: ${selector}`);
  }
  return element;
}

type Preferences = {
  effect: 'none' | 'fire' | 'electricity' | 'frost' | 'kinetic' | 'slime';
  paused: boolean;
  reduced: boolean;
  needsResume: boolean;
};

// Keep preferences in memory too, for storage-disabled navigation restoration.
let preferences: Preferences = {
  effect: 'fire',
  paused: false,
  reduced: false,
  needsResume: false,
};
try {
  const saved: unknown = JSON.parse(sessionStorage.getItem('domfx-showcase') ?? 'null');
  if (saved && typeof saved === 'object' && 'effect' in saved) {
    preferences = {
      effect:
        saved.effect === 'none' ||
        saved.effect === 'electricity' ||
        saved.effect === 'frost' ||
        saved.effect === 'kinetic' ||
        saved.effect === 'slime'
          ? saved.effect
          : 'fire',
      paused: 'paused' in saved && saved.paused === true,
      reduced: 'reduced' in saved && saved.reduced === true,
      needsResume: 'needsResume' in saved && saved.needsResume === true,
    };
  } else {
    const legacy = sessionStorage.getItem('domfx-playback');
    preferences.effect = legacy === 'off' ? 'none' : 'fire';
    preferences.paused = legacy === 'paused';
  }
} catch {
  // In-memory preferences remain available when session storage is blocked.
}

let motionSpeed = 1;
let motionLoop = false;
let rangeStart = 0;
let rangeEnd = 10;
let maximumIntensity = 0.7;
let flameHeight = 32;
const mountEffects = createEffectTargetSession();

function initializePage() {
  const events = new AbortController();
  const { signal } = events;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const hasGpu = 'gpu' in navigator && navigator.gpu !== undefined;
  const dock = required<HTMLElement>('#playground');
  const bar = required<HTMLElement>('.collapsed-bar');
  const play = required<HTMLButtonElement>('#effect-play');
  const status = required<HTMLElement>('#effect-status');
  const effectChoice = required<HTMLSelectElement>('#hero-effect');
  const intensityValue = required<HTMLOutputElement>('#hero-intensity-value');
  const intensity = required<HTMLInputElement>('#effect-intensity');
  const intensityNumber = required<HTMLInputElement>('#intensity-number');
  const height = required<HTMLInputElement>('#flame-height');
  const heightNumber = required<HTMLInputElement>('#height-number');
  const heightRow = required<HTMLElement>('#flame-height-row');
  const speed = required<HTMLInputElement>('#motion-speed');
  const speedNumber = required<HTMLInputElement>('#speed-number');
  const loop = required<HTMLInputElement>('#motion-loop');
  const start = required<HTMLInputElement>('#range-start');
  const end = required<HTMLInputElement>('#range-end');
  const startSlider = required<HTMLInputElement>('#range-start-slider');
  const endSlider = required<HTMLInputElement>('#range-end-slider');
  const rangeTrack = required<HTMLElement>('.range-track');
  const reduction = required<HTMLInputElement>('#reduce-motion');
  const panelTriggers = [
    required<HTMLButtonElement>('#effect-settings'),
    required<HTMLButtonElement>('#motion-settings'),
    required<HTMLButtonElement>('#view-prompt'),
  ];
  const panels = panelTriggers.map((trigger) =>
    required<HTMLElement>(`#${trigger.getAttribute('aria-controls')}`),
  );
  const targets = [...document.querySelectorAll<HTMLElement | SVGElement>('[data-effect-target]')];
  const promptTarget = required<HTMLInputElement>('#prompt-target');
  const promptContent = required<HTMLElement>('#prompt-content');
  const promptFeedback = required<HTMLElement>('#prompt-feedback');
  const copyPrompt = required<HTMLButtonElement>('#copy-prompt');
  let activePanel = -1;
  let promptDirty = true;
  let frame = 0;
  let layoutDirty = true;
  const effects = mountEffects(targets, effectSettings(), schedule);

  function reduced() {
    return preferences.reduced || motion.matches;
  }

  function remember() {
    try {
      sessionStorage.setItem('domfx-showcase', JSON.stringify(preferences));
    } catch {
      // The shared in-memory object retains the choice for this document.
    }
  }

  function effectSettings() {
    return {
      effect: preferences.effect,
      paused: preferences.paused,
      reduced: reduced(),
      needsResume: preferences.needsResume,
      hasGpu,
      hidden: document.hidden,
      intensity: maximumIntensity,
      flameHeight,
      speed: motionSpeed,
      loop: motionLoop,
      rangeStart,
      rangeEnd,
    };
  }

  function syncEffects() {
    effects.configure(effectSettings());
  }

  function updatePrompt() {
    if (!promptDirty) {
      return;
    }
    promptDirty = false;
    const paused = preferences.paused || preferences.needsResume || reduced();
    required<HTMLElement>('#prompt-summary').textContent =
      preferences.effect === 'none'
        ? 'None · Keep your HTML undecorated'
        : `${preferences.effect === 'fire' ? 'Fire' : preferences.effect === 'electricity' ? 'Electricity' : preferences.effect === 'frost' ? 'Frost' : preferences.effect === 'kinetic' ? 'Kinetic bloom' : 'Slime'} · ${Math.round(maximumIntensity * 100)}% · ${preferences.effect === 'fire' ? `${flameHeight}px · ` : ''}${motionSpeed}× · ${motionLoop ? `${rangeStart}–${rangeEnd}s loop` : 'Continuous'} · ${paused ? 'Paused' : 'Animate'}`;
    promptContent.textContent = createAgentPrompt({
      target: promptTarget.value.trim() || 'the main hero heading',
      effect: preferences.effect,
      intensity: maximumIntensity,
      flameHeight,
      time: rangeStart,
      speed: motionSpeed,
      loop: motionLoop,
      end: rangeEnd,
      paused,
    });
    promptFeedback.textContent = '';
    copyPrompt.textContent = 'Copy prompt';
  }

  promptTarget.addEventListener(
    'input',
    () => {
      promptDirty = true;
      updatePrompt();
    },
    { signal },
  );
  copyPrompt.addEventListener(
    'click',
    async () => {
      const draft = promptContent.textContent ?? '';
      try {
        await navigator.clipboard.writeText(draft);
        if (signal.aborted || promptContent.textContent !== draft) {
          return;
        }
        copyPrompt.textContent = 'Copied';
        promptFeedback.textContent = 'Prompt copied. Paste it into your coding agent.';
      } catch {
        if (!signal.aborted && promptContent.textContent === draft) {
          promptFeedback.textContent =
            'Clipboard unavailable. Select the prompt above and copy it manually.';
        }
      }
    },
    { signal },
  );

  function updateControls() {
    play.disabled = preferences.effect === 'none' || reduced() || !hasGpu;
    const paused = preferences.paused || preferences.needsResume;
    const playbackLabel = required<HTMLElement>('#playback-label');
    const playbackText = paused ? 'Resume' : 'Pause';
    if (playbackLabel.textContent !== playbackText) {
      playbackLabel.textContent = playbackText;
    }
    play.setAttribute('aria-pressed', String(paused));
    play.setAttribute('aria-label', paused ? 'Resume' : 'Pause');
    play.title = paused ? 'Resume' : 'Pause';
    const effectLabel =
      preferences.effect === 'fire'
        ? 'Fire'
        : preferences.effect === 'electricity'
          ? 'Electricity'
          : preferences.effect === 'frost'
            ? 'Frost'
            : preferences.effect === 'kinetic'
              ? 'Kinetic bloom'
              : preferences.effect === 'slime'
                ? 'Slime'
                : 'None';
    panelTriggers[0].setAttribute('aria-label', `Effect settings: ${effectLabel}`);
    effectChoice.value = preferences.effect;
    const percent = `${Math.round(maximumIntensity * 100)}%`;
    if (intensityValue.value !== percent) {
      intensityValue.value = percent;
    }
    for (const input of [intensity, intensityNumber, speed, speedNumber, loop]) {
      input.disabled = preferences.effect === 'none';
    }
    heightRow.hidden = preferences.effect !== 'fire';
    height.disabled = heightNumber.disabled = preferences.effect !== 'fire';
    for (const input of [start, end, startSlider, endSlider]) {
      input.disabled = preferences.effect === 'none' || !motionLoop;
    }
    reduction.checked = preferences.reduced;
    document.documentElement.toggleAttribute('data-reduced-motion', reduced());
    const systemMotion = required<HTMLElement>('#system-motion');
    const systemMotionText = motion.matches
      ? 'System reduced motion is on. Effects stay off.'
      : 'System reduced motion is off.';
    if (systemMotion.textContent !== systemMotionText) {
      systemMotion.textContent = systemMotionText;
    }
    const { failed, loading } = effects.status();
    const statusText =
      preferences.effect === 'none'
        ? ''
        : reduced()
          ? 'Reduced motion is on. Effects stay off.'
          : !hasGpu
            ? 'WebGPU is unavailable. Your HTML still works.'
            : preferences.needsResume
              ? `Select Resume to show ${effectLabel}.`
              : failed
                ? 'Some effects are unavailable. The original elements still work.'
                : loading
                  ? `Preparing ${effectLabel}…`
                  : '';
    status.hidden = statusText === '';
    if (status.textContent !== statusText) {
      status.textContent = statusText;
    }
    if (activePanel === 2) {
      updatePrompt();
    }
  }

  function schedule() {
    if (!frame && !signal.aborted) {
      frame = requestAnimationFrame(tick);
    }
  }

  function tick(now: number) {
    frame = 0;
    if (signal.aborted) {
      return;
    }
    if (layoutDirty) {
      layoutDirty = false;
      effects.refreshLayout();
    }
    const running = effects.tick(now);
    updateControls();
    if (running) {
      schedule();
    }
  }

  function invalidateLayout() {
    layoutDirty = true;
    schedule();
  }

  function closePanel(restoreFocus = false) {
    if (activePanel < 0) {
      return;
    }
    const trigger = panelTriggers[activePanel];
    panels[activePanel].inert = true;
    panels[activePanel].hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    activePanel = -1;
    if (restoreFocus) {
      trigger.focus();
    }
  }

  panelTriggers.forEach((trigger, index) => {
    trigger.addEventListener(
      'click',
      () => {
        const closing = activePanel === index;
        closePanel();
        if (!closing) {
          activePanel = index;
          promptDirty = true;
          panels[index].hidden = false;
          panels[index].inert = false;
          trigger.setAttribute('aria-expanded', 'true');
          updateControls();
          panels[index].querySelector<HTMLElement>('input:not([disabled]), pre[tabindex]')?.focus();
        }
      },
      { signal },
    );
  });
  document.addEventListener(
    'keydown',
    (event) => {
      if (event.key === 'Escape' && activePanel >= 0) {
        event.preventDefault();
        closePanel(true);
      }
    },
    { signal },
  );
  document.addEventListener(
    'click',
    (event) => {
      if (event.target instanceof Node && !dock.contains(event.target)) {
        closePanel();
      }
    },
    { signal },
  );

  function bindNumber(
    range: HTMLInputElement,
    number: HTMLInputElement,
    change: (value: number) => void,
  ) {
    function commit(input: HTMLInputElement) {
      if (input.value === '' || !Number.isFinite(input.valueAsNumber)) {
        return;
      }
      const min = Number(range.min);
      const max = Number(range.max);
      const step = Number(range.step);
      const value = Number(
        Math.min(
          max,
          Math.max(min, Math.round((input.valueAsNumber - min) / step) * step + min),
        ).toFixed(2),
      );
      range.value = String(value);
      if (input !== number) {
        number.value = String(value);
      }
      change(value);
      syncEffects();
      promptDirty = true;
      updateControls();
      schedule();
    }
    range.addEventListener('input', () => commit(range), { signal });
    number.addEventListener('input', () => commit(number), { signal });
    number.addEventListener(
      'change',
      () => {
        number.value = range.value;
      },
      { signal },
    );
  }
  intensity.value = intensityNumber.value = String(maximumIntensity * 100);
  height.value = heightNumber.value = String(flameHeight);
  speed.value = speedNumber.value = String(motionSpeed);
  loop.checked = motionLoop;
  syncRangeFields();
  bindNumber(intensity, intensityNumber, (value) => {
    maximumIntensity = value / 100;
  });
  bindNumber(height, heightNumber, (value) => {
    flameHeight = value;
  });
  bindNumber(speed, speedNumber, (value) => {
    motionSpeed = value;
  });
  function syncRangeFields() {
    const extent = Math.max(10, Math.ceil(rangeEnd / 10) * 10);
    startSlider.max = endSlider.max = String(extent);
    start.value = startSlider.value = String(rangeStart);
    end.value = endSlider.value = String(rangeEnd);
    start.max = String(rangeEnd - 0.05);
    end.min = String(rangeStart + 0.05);
    rangeTrack.style.setProperty('--range-start', `${(rangeStart / extent) * 100}%`);
    rangeTrack.style.setProperty('--range-end', `${(rangeEnd / extent) * 100}%`);
  }
  function updateRange() {
    motionLoop = loop.checked;
    syncEffects();
    syncRangeFields();
    promptDirty = true;
    updateControls();
    schedule();
  }
  loop.addEventListener('change', updateRange, { signal });
  for (const input of [start, end, startSlider, endSlider]) {
    input.addEventListener(
      input.type === 'range' ? 'input' : 'change',
      () => {
        const isStart = input === start || input === startSlider;
        if (!Number.isFinite(input.valueAsNumber)) {
          input.value = String(isStart ? rangeStart : rangeEnd);
          return;
        }
        const value = Math.round(input.valueAsNumber / 0.05) * 0.05;
        if (isStart) {
          rangeStart = Number(Math.max(0, Math.min(rangeEnd - 0.05, value)).toFixed(2));
        } else {
          rangeEnd = Number(Math.max(rangeStart + 0.05, Math.min(120, value)).toFixed(2));
        }
        updateRange();
      },
      { signal },
    );
  }
  const effectPresets = required<HTMLFieldSetElement>('#effect-presets');
  function changeEffect(value: string) {
    preferences.effect =
      value === 'fire' ||
      value === 'electricity' ||
      value === 'frost' ||
      value === 'kinetic' ||
      value === 'slime'
        ? value
        : 'none';
    required<HTMLInputElement>(`input[name="effect"][value="${preferences.effect}"]`).checked =
      true;
    syncEffects();
    promptDirty = true;
    remember();
    schedule();
    updateControls();
  }
  effectPresets.addEventListener(
    'change',
    () => changeEffect(required<HTMLInputElement>('input[name="effect"]:checked').value),
    { signal },
  );
  effectChoice.addEventListener('change', () => changeEffect(effectChoice.value), { signal });
  play.addEventListener(
    'click',
    () => {
      preferences.paused = !(preferences.paused || preferences.needsResume);
      preferences.needsResume = false;
      promptDirty = true;
      syncEffects();
      effects.retry();
      remember();
      schedule();
      updateControls();
    },
    { signal },
  );

  function updateMotion() {
    promptDirty = true;
    if (reduced()) {
      preferences.paused = true;
      preferences.needsResume = true;
    }
    syncEffects();
    remember();
    updateControls();
    schedule();
  }
  reduction.addEventListener(
    'change',
    () => {
      preferences.reduced = reduction.checked;
      updateMotion();
    },
    { signal },
  );
  motion.addEventListener('change', updateMotion, { signal });
  window.addEventListener('scroll', invalidateLayout, { passive: true, signal });
  window.addEventListener('resize', invalidateLayout, { signal });
  document.addEventListener(
    'visibilitychange',
    () => {
      syncEffects(); // Release immediately; hidden pages may not receive another frame.
      invalidateLayout();
    },
    { signal },
  );
  const visibilityObserver = new IntersectionObserver(invalidateLayout);
  const sizeObserver = new ResizeObserver(invalidateLayout);
  for (const element of targets) {
    visibilityObserver.observe(element);
    sizeObserver.observe(element);
  }
  const dockObserver = new ResizeObserver(() => {
    document.documentElement.style.setProperty(
      '--dock-space',
      `${Math.ceil(bar.getBoundingClientRect().height + Math.max(16, parseFloat(getComputedStyle(dock).bottom)) + 16)}px`,
    );
  });
  dockObserver.observe(bar);
  dock.hidden = false;
  required<HTMLElement>('#toolbar-instruction').hidden = false;
  required<HTMLInputElement>(`input[name="effect"][value="${preferences.effect}"]`).checked = true;
  updateMotion();
  invalidateLayout();
  return () => {
    remember();
    events.abort();
    cancelAnimationFrame(frame);
    visibilityObserver.disconnect();
    sizeObserver.disconnect();
    dockObserver.disconnect();
    closePanel();
    effects.dispose();
  };
}

let cleanup = initializePage();
function onPageHide() {
  cleanup();
}
function onPageShow(event: PageTransitionEvent) {
  if (event.persisted) {
    cleanup = initializePage();
  }
}
window.addEventListener('pagehide', onPageHide);
window.addEventListener('pageshow', onPageShow);
import.meta.hot?.dispose(() => {
  cleanup();
  window.removeEventListener('pagehide', onPageHide);
  window.removeEventListener('pageshow', onPageShow);
});
