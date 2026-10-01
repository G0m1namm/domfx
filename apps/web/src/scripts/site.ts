import type { EffectHandle } from '@domfx/browser';

import { createAgentPrompt } from './agent-prompt';
import { createScrollStory } from './scroll-story';

function required<T extends Element>(selector: string) {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Missing homepage element: ${selector}`);
  }
  return element;
}

type Preferences = {
  effect: 'none' | 'fire';
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
      effect: saved.effect === 'none' ? 'none' : 'fire',
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

let timelineTime = 0;
let motionSpeed = 1;
let motionLoop = false;
let rangeStart = 0;
let rangeEnd = 10;
let maximumIntensity = 0.7;
let flameHeight = 32;

function initializePage() {
  const events = new AbortController();
  const { signal } = events;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const hasGpu = 'gpu' in navigator && navigator.gpu !== undefined;
  const dock = required<HTMLElement>('#playground');
  const bar = required<HTMLElement>('.collapsed-bar');
  const play = required<HTMLButtonElement>('#effect-play');
  const status = required<HTMLElement>('#effect-status');
  const intensity = required<HTMLInputElement>('#effect-intensity');
  const intensityNumber = required<HTMLInputElement>('#intensity-number');
  const height = required<HTMLInputElement>('#flame-height');
  const heightNumber = required<HTMLInputElement>('#height-number');
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
  const targets = [
    ...document.querySelectorAll<HTMLElement | SVGElement>('[data-effect-target]'),
  ].map((element) => {
    return {
      element,
      host: element.closest<HTMLElement>('[data-effect-host]'),
      visible: false,
      factor: 1,
      revision: 0,
      loading: false,
      failure: '',
      attachment: undefined as EffectHandle | undefined,
    };
  });
  type Target = (typeof targets)[number];
  const promptTarget = required<HTMLInputElement>('#prompt-target');
  const promptContent = required<HTMLElement>('#prompt-content');
  const promptFeedback = required<HTMLElement>('#prompt-feedback');
  const copyPrompt = required<HTMLButtonElement>('#copy-prompt');
  let activePanel = -1;
  let promptDirty = true;
  let frame = 0;
  let layoutDirty = true;
  let lastTick = 0;
  const story = createScrollStory(invalidateLayout, () => {
    // Pin refreshes reparent the scene. Removal is terminal for a public handle.
    for (const target of targets) {
      release(target);
      target.failure = '';
    }
  });

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

  function renderingPermitted() {
    return (
      preferences.effect === 'fire' &&
      hasGpu &&
      !reduced() &&
      !preferences.needsResume &&
      !document.hidden &&
      !signal.aborted
    );
  }

  function release(target: Target) {
    target.revision += 1;
    target.attachment?.dispose();
    target.attachment = undefined;
    target.loading = false;
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
        : `Fire · ${Math.round(maximumIntensity * 100)}% · ${flameHeight}px · ${motionSpeed}× · ${motionLoop ? `${rangeStart}–${rangeEnd}s loop` : 'Continuous'} · ${paused ? 'Paused' : 'Animate'}`;
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
    required<HTMLElement>('#playback-label').textContent = paused ? 'Resume' : 'Pause';
    play.setAttribute('aria-pressed', String(paused));
    play.setAttribute('aria-label', paused ? 'Resume' : 'Pause');
    play.title = paused ? 'Resume' : 'Pause';
    const effectLabel = preferences.effect === 'fire' ? 'Fire' : 'None';
    panelTriggers[0].setAttribute('aria-label', `Effect: ${effectLabel}`);
    for (const input of [
      intensity,
      intensityNumber,
      height,
      heightNumber,
      speed,
      speedNumber,
      loop,
    ]) {
      input.disabled = preferences.effect === 'none';
    }
    for (const input of [start, end, startSlider, endSlider]) {
      input.disabled = preferences.effect === 'none' || !motionLoop;
    }
    reduction.checked = preferences.reduced;
    document.documentElement.toggleAttribute('data-reduced-motion', reduced());
    story.setReduced(reduced() || preferences.needsResume);
    required<HTMLElement>('#system-motion').textContent = motion.matches
      ? 'System reduced motion is on. Effects stay off.'
      : 'System reduced motion is off.';
    const failures = targets.filter((target) => target.failure);
    const statusText =
      preferences.effect === 'none'
        ? ''
        : reduced()
          ? 'Reduced motion is on. Effects stay off.'
          : !hasGpu
            ? 'WebGPU is unavailable. Your HTML still works.'
            : preferences.needsResume
              ? 'Select Resume to show Fire.'
              : failures.length
                ? 'Some effects are unavailable. The original elements still work.'
                : targets.some((target) => target.loading)
                  ? 'Preparing Fire…'
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

  async function attach(target: Target) {
    const request = ++target.revision;
    target.loading = true;
    try {
      const images =
        target.element instanceof HTMLImageElement
          ? [target.element]
          : [...target.element.querySelectorAll('img')];
      const [{ attachFire }] = await Promise.all([
        import('@domfx/browser'),
        document.fonts.ready,
        ...images.map((image) => image.decode()),
      ]);
      if (request !== target.revision || !renderingPermitted() || !target.visible || !target.host) {
        return;
      }
      const attachment = attachFire(target.element, {
        host: target.host,
        clock: 'manual',
        seed: 314,
        time: timelineTime,
        intensity: maximumIntensity * target.factor,
        flameHeight,
      });
      target.attachment = attachment;
      await attachment.ready;
      if (request !== target.revision || signal.aborted) {
        attachment.dispose();
        return;
      }
      if (attachment.lifecycle !== 'active' && attachment.reason !== 'stale-raster') {
        target.failure = attachment.reason ?? attachment.lifecycle;
        console.warn(
          `domfx showcase unavailable on ${target.element.id}: ${target.failure}`,
          attachment.reasonDetail,
        );
        release(target);
      } else {
        attachment.time = timelineTime;
        attachment.intensity = maximumIntensity * target.factor;
      }
    } catch (error) {
      if (request === target.revision && !signal.aborted) {
        target.failure = 'load or capture failed';
        release(target);
        console.error(`domfx showcase failed on ${target.element.id}:`, error);
      }
    } finally {
      if (request === target.revision && !signal.aborted) {
        target.loading = false;
      }
      if (!signal.aborted) {
        schedule();
      }
    }
  }

  function syncTargets() {
    for (const target of targets) {
      if (!renderingPermitted() || !target.visible) {
        if (target.attachment || target.loading) {
          release(target);
        }
      } else if (!target.attachment && !target.loading && !target.failure) {
        void attach(target);
      }
    }
  }

  function tick(now: number) {
    frame = 0;
    if (signal.aborted) {
      return;
    }
    if (layoutDirty) {
      layoutDirty = false;
      for (const target of targets) {
        const rect = target.element.getBoundingClientRect();
        const style = getComputedStyle(target.element);
        const visible =
          rect.width > 0 &&
          rect.height > 0 &&
          rect.bottom > 0 &&
          rect.top < innerHeight &&
          rect.right > 0 &&
          rect.left < innerWidth &&
          style.visibility !== 'hidden';
        if (visible !== target.visible) {
          target.failure = '';
        }
        target.visible = visible;
        target.factor =
          target.element.id === 'scroll-target'
            ? Math.max(
                0,
                Math.min(
                  1,
                  1 -
                    Math.abs(rect.top + rect.height / 2 - innerHeight / 2) /
                      ((innerHeight + rect.height) / 2),
                ),
              )
            : 1;
      }
    }
    syncTargets();
    const active = targets.some((target) => target.attachment?.lifecycle === 'active');
    const running = active && renderingPermitted() && !preferences.paused;
    if (running && lastTick) {
      timelineTime += ((now - lastTick) / 1000) * motionSpeed;
      if (motionLoop && timelineTime >= rangeEnd) {
        timelineTime = rangeStart + ((timelineTime - rangeStart) % (rangeEnd - rangeStart));
      }
    }
    lastTick = running ? now : 0;
    for (const target of targets) {
      const attachment = target.attachment;
      if (!attachment) {
        continue;
      }
      if (attachment.lifecycle === 'active' || attachment.reason === 'stale-raster') {
        attachment.time = timelineTime;
        const value = maximumIntensity * target.factor;
        if (attachment.intensity !== value) {
          attachment.intensity = value;
        }
      } else if (!target.loading) {
        target.failure = attachment.reason ?? attachment.lifecycle;
        release(target);
      }
    }
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
    if (flameHeight !== value) {
      flameHeight = value;
      for (const target of targets) {
        release(target);
        target.failure = '';
      }
    }
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
    if (motionLoop) {
      timelineTime = rangeStart;
    }
    syncRangeFields();
    promptDirty = true;
    lastTick = 0;
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
  required<HTMLFieldSetElement>('#effect-presets').addEventListener(
    'change',
    () => {
      preferences.effect =
        required<HTMLInputElement>('input[name="effect"]:checked').value === 'fire'
          ? 'fire'
          : 'none';
      for (const target of targets) {
        release(target);
        target.failure = '';
      }
      lastTick = 0;
      promptDirty = true;
      remember();
      schedule();
      updateControls();
    },
    { signal },
  );
  play.addEventListener(
    'click',
    () => {
      preferences.paused = !(preferences.paused || preferences.needsResume);
      preferences.needsResume = false;
      promptDirty = true;
      lastTick = 0;
      for (const target of targets) {
        target.failure = '';
      }
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
      for (const target of targets) {
        release(target);
      }
    }
    lastTick = 0;
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
      lastTick = 0;
      syncTargets(); // Release immediately; hidden pages may not receive another frame.
      invalidateLayout();
    },
    { signal },
  );
  const visibilityObserver = new IntersectionObserver(invalidateLayout);
  const sizeObserver = new ResizeObserver(invalidateLayout);
  for (const { element } of targets) {
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
    story.dispose();
    cancelAnimationFrame(frame);
    visibilityObserver.disconnect();
    sizeObserver.disconnect();
    dockObserver.disconnect();
    closePanel();
    for (const target of targets) {
      release(target);
    }
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
