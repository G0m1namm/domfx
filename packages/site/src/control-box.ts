import { renderCodeTokens } from './code-tokens.ts';
import type { ControlBoxMessages } from './control-box-messages.ts';
import {
  effectColorField,
  effectCreationFields,
  effectSettingApiValue,
  effectSettingDisplayValue,
  effectSettingValueText,
  effectWritableFields,
  intensityField,
  isEffectCreationName,
  isEffectWritableName,
  type EffectOptionName,
  type EffectSetting,
} from './effect-extent.ts';
import {
  defaultEffectSettings,
  effectAttachmentOptions,
  effectSettingsDiffer,
  effectSettingsSearch,
  effectSnippet,
  effectTimeField,
  snapEffectSliderValue,
  switchFireColorMode,
  type EffectClock,
  type EffectColorSettings,
  type EffectMotion,
  type EffectSettings,
  type FireColorMode,
} from './effect-settings.ts';
import {
  createEffectEnvironment,
  createEffectSlot,
  setEffectColors,
  setEffectWritableControl,
  type EffectStatus,
} from './effect-slot.ts';
import type { Effect } from './effects.ts';
import type { Locale } from './locale.ts';
import { readMotionTokens } from './motion-tokens.ts';
import { glideSelection } from './selection-glide.ts';
import { startTopLayerTooltips } from './top-layer-tooltips.ts';

export type ControlBoxTargetKind = 'text' | 'svg' | 'image';
type Tab = 'shape' | 'color' | 'time' | 'code';
type ColorName = 'color' | 'rootColor' | 'tipColor';

const TOAST_MS = 2400;
const LIFT_CLEARANCE_PX = 8;
const TARGET_CLEARANCE_PX = 40;
const VIEW_EXIT_MS = 120;
const VIEW_ENTER_DELAY_MS = 50;
const SHUFFLE_RANGE = 10_000;

/** The preview the box floats over. Everything the box does not own is reached through here. */
export interface ControlBoxSurface {
  /** Receives `data-status`, `data-reason`, `data-paused` and `data-status-visible`. */
  frame: HTMLElement;
  /** The preview region the dock and panels cover. */
  stage: HTMLElement;
  /** The effect host. It moves with `translate`, so its effect layer follows without recapture. */
  host: HTMLElement;
  /** The zoom chip in the preview's corner; panels stay clear of it as it grows. */
  zoomTools?: HTMLElement;
  /** The target element showing now. */
  target(): Element;
  /** Shows another target element. Subject, zoom and pan stay outside the settings. */
  selectTarget(kind: ControlBoxTargetKind): void;
}

/** What a site needs to word its status. Screen readers receive every change. */
export interface ControlBoxStatus extends EffectStatus {
  readonly paused: boolean;
  /** External control or Static is holding one frame. */
  readonly held: boolean;
  readonly reducedMotion: boolean;
}

export interface ControlBoxSnapshot {
  readonly settings: EffectSettings;
  readonly paused: boolean;
  readonly needsResume: boolean;
}

export interface ControlBoxOptions {
  /** The rendered `components/control-box.astro`. */
  root: HTMLElement;
  effect: Effect;
  locale: Locale;
  messages: ControlBoxMessages;
  surface: ControlBoxSurface;
  /** Read from a settings link, or restored from `snapshot()`. Defaults to the effect's defaults. */
  initial?: Partial<ControlBoxSnapshot> & Pick<ControlBoxSnapshot, 'settings'>;
  status: {
    /** A live region; the site styles it from the frame's `data-status-visible`. */
    element: HTMLElement;
    message(status: ControlBoxStatus): string;
  };
  /** Builds the Copy link query. Marketing passes `marketingEffectSearch`. */
  linkSearch?: typeof effectSettingsSearch;
  /** Called after the Target element changes, for example to return zoom to Fit. */
  onTargetChange?(): void;
}

function required<T extends Element>(selector: string, root: ParentNode): T {
  const element = root.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Missing control box element: ${selector}`);
  }
  return element;
}

function setFill(input: HTMLInputElement) {
  const min = Number(input.min);
  const max = Number(input.max);
  input.style.setProperty('--fill', `${((Number(input.value) - min) / (max - min)) * 100}%`);
}

function setValue(input: HTMLInputElement | HTMLSelectElement, value: string) {
  if (input.value !== value) {
    input.value = value;
  }
}

/** A setting's API value in its control's units, without float noise such as 56.00000000000001. */
function sliderValue(field: EffectSetting, value: number) {
  return String(Math.round(value * field.scale * 1e6) / 1e6);
}

/** The time slider's value nearest a running instance's time. */
function sliderTime(value: number) {
  return Math.max(effectTimeField.min, Math.min(effectTimeField.max, Number(value.toFixed(1))));
}

/** Options that cannot be written to a live instance. */
function replacementKey(effect: Effect, settings: EffectSettings) {
  const options = effectCreationFields(effect).map(({ name }) =>
    isEffectCreationName(name) ? settings.options[name] : undefined,
  );
  return JSON.stringify([settings.clock, settings.motion, settings.seed, options]);
}

function colorValue(color: EffectColorSettings, name: ColorName) {
  if (name === 'color') {
    return color.mode === 'single' ? color.color : undefined;
  }
  return color.mode === 'root-and-tip' ? color[name] : undefined;
}

function withColor(
  color: EffectColorSettings,
  name: ColorName,
  value: string | undefined,
): EffectColorSettings {
  if (name === 'color') {
    return { mode: 'single', ...(value === undefined ? {} : { color: value }) };
  }
  const current = color.mode === 'root-and-tip' ? color : undefined;
  const rootColor = name === 'rootColor' ? value : current?.rootColor;
  const tipColor = name === 'tipColor' ? value : current?.tipColor;
  return {
    mode: 'root-and-tip',
    ...(rootColor === undefined ? {} : { rootColor }),
    ...(tipColor === undefined ? {} : { tipColor }),
  };
}

/**
 * Owns one preview's settings, effect slot and box UI. Controls stay in the DOM and update in
 * place, so a native color picker survives every change. Create it once per rendered box.
 */
export function createControlBox({
  root,
  effect,
  locale,
  messages,
  surface,
  initial,
  status,
  linkSearch = effectSettingsSearch,
  onTargetChange,
}: ControlBoxOptions) {
  const document = root.ownerDocument;
  const view = document.defaultView;
  if (!view) {
    throw new Error('The control box needs a window');
  }
  const lifetime = new AbortController();
  const { signal } = lifetime;
  const hasGpu = 'gpu' in view.navigator && Boolean(view.navigator.gpu);
  const reducedMotion = view.matchMedia('(prefers-reduced-motion: reduce)');
  const hasColor = Boolean(effectColorField(effect));
  const isFire = effect.id === 'fire';
  const defaults = defaultEffectSettings(effect);

  const anchor = required<HTMLElement>('[data-box-anchor]', root);
  const dock = required<HTMLElement>('[data-box-dock]', root);
  const panel = required<HTMLElement>('[data-box-panel]', root);
  const toast = required<HTMLElement>('[data-box-toast]', root);
  const code = required<HTMLElement>('[data-box-code]', root);
  const seedInput = required<HTMLInputElement>('[data-box-seed]', root);
  const timeInput = required<HTMLInputElement>('[data-box-time]', root);
  const timeRow = required<HTMLElement>('[data-box-time-row]', root);
  const timeOutput = required<HTMLOutputElement>('output', timeRow);
  const staticNote = required<HTMLElement>('[data-box-static-note]', root);
  const pauseButton = required<HTMLButtonElement>('[data-box-pause]', root);
  const pauseIcon = required<SVGUseElement>('use', pauseButton);
  const resetButton = required<HTMLButtonElement>('[data-box-reset]', root);
  const tabs = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-box-tab]'));
  const views = Array.from(root.querySelectorAll<HTMLElement>('[data-box-view]'));
  const settingFields = [
    intensityField,
    ...effectCreationFields(effect),
    ...effectWritableFields(effect),
  ].map((field) => ({
    field,
    input: required<HTMLInputElement | HTMLSelectElement>(
      `[data-box-setting="${field.name}"]`,
      root,
    ),
    output: root.querySelector<HTMLOutputElement>(`[data-effect-setting-output="${field.name}"]`),
  }));
  const colorRows = (['color', 'rootColor', 'tipColor'] as const).flatMap((name) => {
    const row = root.querySelector<HTMLElement>(`[data-box-color="${name}"]`);
    return row
      ? [
          {
            name,
            row,
            input: required<HTMLInputElement>('input', row),
            unset: required<HTMLButtonElement>('button', row),
            output: required<HTMLOutputElement>('output', row),
          },
        ]
      : [];
  });

  let settings = initial?.settings ?? defaults;
  let paused = initial?.paused ?? false;
  let needsResume = reducedMotion.matches || (initial?.needsResume ?? false);
  let visible = false;
  let openTab: Tab | undefined;
  let appliedKey: string | undefined;
  let resumeTime: number | undefined;
  let draggedSlider: HTMLInputElement | undefined;
  let toastTimer = 0;
  let lift: number | undefined;
  let panelHeight = 0;
  let closingPanel = false;
  let panelMotion: Animation[] = [];
  let leavingView: HTMLElement | undefined;

  const environment = createEffectEnvironment({
    document,
    reducedMotion,
    needsResume: () => needsResume,
    ignoresReducedMotion: () => settings.motion === 'static',
  });
  const slot = createEffectSlot({ host: surface.host, environment, onChange: onSlotChange });

  const isHeld = () => settings.clock === 'manual' || settings.motion === 'static';
  const outputAllowed = () => hasGpu && (!reducedMotion.matches || settings.motion === 'static');

  // --- Status and playback

  function publishStatus(next: EffectStatus) {
    const { frame } = surface;
    frame.dataset.status = next.lifecycle;
    frame.dataset.paused = String(paused);
    // A suspension without a reason is only the moment before a target enters view.
    frame.dataset.statusVisible = String(
      next.lifecycle === 'unavailable' || (next.lifecycle === 'suspended' && Boolean(next.reason)),
    );
    if (next.reason) {
      frame.dataset.reason = next.reason;
    } else {
      delete frame.dataset.reason;
    }
    status.element.textContent = status.message({
      ...next,
      paused,
      held: isHeld(),
      reducedMotion: reducedMotion.matches,
    });
  }

  function onSlotChange(next: EffectStatus) {
    const handle = slot.handle;
    if (next.lifecycle === 'active' && handle) {
      applyLiveSettings();
      // A released instance leaves its time behind, so a held or hidden preview keeps its frame.
      const time = resumeTime ?? slot.lastTime;
      if (time !== undefined && !isHeld()) {
        handle.time = time;
      }
      resumeTime = undefined;
      if (paused && !isHeld()) {
        handle.pause();
      }
    }
    publishStatus(next);
    updateAvailability();
  }

  function updateAvailability() {
    const settingsEnabled = outputAllowed();
    for (const fieldset of root.querySelectorAll<HTMLFieldSetElement>('[data-box-fieldset]')) {
      fieldset.disabled = fieldset.dataset.boxFieldset === 'motion' ? !hasGpu : !settingsEnabled;
    }
    timeInput.disabled = settings.motion === 'static';

    const handle = slot.handle;
    const running = handle?.lifecycle === 'active';
    let label: string;
    let disabled = false;
    if (!hasGpu) {
      label = messages.effectsUnavailable;
      disabled = true;
    } else if (!outputAllowed()) {
      label = messages.reducedMotion;
      disabled = true;
    } else if (!running) {
      label = messages.start;
    } else {
      label = paused ? messages.resume : messages.pause;
      // Pause stays for Automatic only: anything else already holds one frame.
      disabled = isHeld();
    }
    pauseButton.disabled = disabled;
    pauseButton.setAttribute('aria-label', label);
    pauseButton.setAttribute('aria-pressed', String(paused));
    pauseIcon.setAttribute('href', running && !paused ? '#ph-pause' : '#ph-play');
  }

  function attach() {
    if (!visible) {
      return undefined;
    }
    return slot.show(surface.target(), effect, () => {
      appliedKey = replacementKey(effect, settings);
      return effectAttachmentOptions(effect, settings);
    });
  }

  /** Replaces the instance when an option it cannot write has changed, or starts a missing one. */
  function replaceIfNeeded() {
    const current =
      replacementKey(effect, settings) === appliedKey &&
      (slot.handle || slot.status.lifecycle === 'initializing');
    if (current) {
      return;
    }
    void attach();
  }

  function applyColors() {
    const handle = slot.handle;
    if (handle && hasColor) {
      const { color, rootColor, tipColor } = effectAttachmentOptions(effect, settings);
      setEffectColors(effect, handle, { color, rootColor, tipColor });
    }
  }

  function applyField(field: EffectSetting) {
    const handle = slot.handle;
    if (!handle) {
      return;
    }
    if (field === intensityField) {
      handle.intensity = settings.intensity;
    } else if (isEffectWritableName(field.name)) {
      const value = settings.options[field.name];
      if (value !== undefined) {
        setEffectWritableControl(effect, handle, field, value);
      }
    }
  }

  /** Replays everything a live instance accepts, including changes made while it was loading. */
  function applyLiveSettings() {
    const handle = slot.handle;
    if (!handle) {
      return;
    }
    applyField(intensityField);
    for (const field of effectWritableFields(effect)) {
      applyField(field);
    }
    applyColors();
    if (settings.clock === 'manual') {
      handle.time = settings.time;
    }
  }

  // --- Rendering state into the existing controls

  function renderRadios(group: string, value: string) {
    for (const radio of root.querySelectorAll<HTMLInputElement>(`[data-box-radio="${group}"]`)) {
      const checked = radio.value === value;
      if (radio.checked !== checked) {
        radio.checked = checked;
        // Assigning `checked` fires no event; only selection-glide listens at the group.
        radio.closest('[data-box-segments]')?.dispatchEvent(new Event('change'));
      }
    }
  }

  function renderSlider(
    input: HTMLInputElement | HTMLSelectElement,
    output: HTMLOutputElement | null,
    field: EffectSetting,
  ) {
    if (!(input instanceof HTMLInputElement)) {
      return;
    }
    setFill(input);
    input.setAttribute('aria-valuetext', effectSettingValueText(field, input.value, locale));
    if (output) {
      output.textContent = effectSettingDisplayValue(field, input.value);
    }
  }

  function renderColors() {
    for (const { name, row, input, unset, output } of colorRows) {
      const value = colorValue(settings.color, name);
      if (isFire) {
        const shown =
          name === 'color'
            ? settings.color.mode === 'single'
            : settings.color.mode === 'root-and-tip';
        row.hidden = !shown;
      }
      setValue(input, value ?? input.dataset.fallback ?? input.value);
      row.dataset.unset = String(value === undefined);
      unset.disabled = value === undefined;
      output.textContent = value ?? output.dataset.fallbackLabel ?? '';
    }
  }

  function render() {
    for (const { field, input, output } of settingFields) {
      const value = field === intensityField ? settings.intensity : optionValue(field.name);
      setValue(input, sliderValue(field, value));
      renderSlider(input, output, field);
    }
    setValue(seedInput, String(settings.seed));
    renderRadios('clock', settings.clock);
    renderRadios('motion', settings.motion);
    if (isFire) {
      renderRadios('color-mode', settings.color.mode);
    }
    renderColors();
    setValue(timeInput, settings.time.toFixed(1));
    setFill(timeInput);
    timeInput.setAttribute('aria-valuetext', `${settings.time.toFixed(1)} ${messages.seconds}`);
    timeOutput.textContent = `${settings.time.toFixed(1)} s`;
    timeRow.hidden = settings.clock !== 'manual';
    staticNote.hidden = settings.motion !== 'static';
    const snippet = effectSnippet(effect, settings, locale);
    if (code.textContent !== snippet) {
      renderCodeTokens(code, snippet);
    }
    updateReset();
    updateAvailability();
  }

  function optionValue(name: string) {
    const option = name as EffectOptionName;
    return settings.options[option] ?? defaults.options[option] ?? 0;
  }

  function updateReset() {
    const differs = effectSettingsDiffer(effect, settings);
    if (!differs && document.activeElement === resetButton) {
      // Disabling the focused button would drop keyboard users back to the page.
      tabs[0]?.focus();
    }
    resetButton.disabled = !differs;
  }

  /** Keeps panel size and lift in step when a change adds or removes a row. */
  function changeRows(change: () => void) {
    if (panel.hidden || closingPanel) {
      change();
      return;
    }
    const from = panel.getBoundingClientRect().height;
    clearPanelMotion();
    change();
    const to = panel.getBoundingClientRect().height;
    panelHeight = to;
    const { duration, easing } = readMotionTokens(panel).enter;
    if (duration && Math.abs(from - to) >= 0.5) {
      panel.dataset.animating = 'true';
      const grow = panel.animate(
        { blockSize: [`${from}px`, `${to}px`], maxBlockSize: ['none', 'none'] },
        { duration, easing },
      );
      grow.onfinish = () => delete panel.dataset.animating;
      panelMotion.push(grow);
    }
    fit();
  }

  // --- Panels

  function clearPanelMotion() {
    for (const animation of panelMotion) {
      animation.cancel();
    }
    panelMotion = [];
    delete panel.dataset.animating;
    if (leavingView) {
      leavingView.hidden = true;
      leavingView.inert = false;
      delete leavingView.dataset.leaving;
      leavingView.style.removeProperty('inline-size');
      leavingView = undefined;
    }
    for (const view of views) {
      view.style.removeProperty('inline-size');
    }
  }

  /** One surface: its size springs between views while old and new content crossfade. */
  function showPanel(tab: Tab) {
    const from = panel.hidden ? undefined : panel.getBoundingClientRect();
    const previous = views.find((item) => !item.hidden && item !== leavingView);
    clearPanelMotion();
    closingPanel = false;
    panel.inert = false;
    panel.hidden = false;
    panel.dataset.tab = tab;
    for (const item of views) {
      item.hidden = item.dataset.boxView !== tab;
    }
    const current = views.find((item) => !item.hidden);
    if (!current) {
      return;
    }
    const to = panel.getBoundingClientRect();
    panelHeight = to.height;
    const { enter, swapOut, swapIn } = readMotionTokens(panel);
    if (!enter.duration) {
      return;
    }
    const switching = previous !== undefined && previous !== current;
    panel.dataset.animating = 'true';
    current.style.inlineSize = `${to.width}px`;
    if (switching && from) {
      previous.hidden = false;
      previous.inert = true;
      previous.dataset.leaving = 'true';
      previous.style.inlineSize = `${from.width}px`;
      leavingView = previous;
      const fade = previous.animate(
        { opacity: [1, 0] },
        { duration: swapOut, easing: 'ease-out', fill: 'forwards' },
      );
      panelMotion.push(fade);
    }
    if (switching) {
      panelMotion.push(
        current.animate(
          { opacity: [0, 1] },
          { duration: swapIn, delay: VIEW_ENTER_DELAY_MS, easing: 'ease-out', fill: 'backwards' },
        ),
      );
    }
    const grow = panel.animate(
      {
        blockSize: [`${from?.height ?? 0}px`, `${to.height}px`],
        inlineSize: [`${from?.width ?? to.width}px`, `${to.width}px`],
        maxBlockSize: ['none', 'none'],
      },
      enter,
    );
    grow.onfinish = clearPanelMotion;
    panelMotion.push(grow);
  }

  function hidePanel() {
    const from = panel.getBoundingClientRect();
    const current = views.find((item) => !item.hidden && item !== leavingView);
    clearPanelMotion();
    panelHeight = 0;
    const done = () => {
      clearPanelMotion();
      closingPanel = false;
      panel.hidden = true;
      panel.inert = false;
      delete panel.dataset.tab;
    };
    const { exit } = readMotionTokens(panel);
    if (!exit.duration) {
      done();
      return;
    }
    closingPanel = true;
    panel.inert = true;
    panel.dataset.animating = 'true';
    if (current) {
      panelMotion.push(
        current.animate(
          { opacity: [1, 0] },
          { duration: VIEW_EXIT_MS, easing: 'ease-out', fill: 'forwards' },
        ),
      );
    }
    const shrink = panel.animate(
      { blockSize: [`${from.height}px`, '0px'], maxBlockSize: ['none', 'none'] },
      { ...exit, fill: 'both' },
    );
    shrink.onfinish = done;
    panelMotion.push(shrink);
  }

  /** Leaves the markup as rendered, so a restored page can start a new box on it. */
  function closePanelNow() {
    openTab = undefined;
    panelHeight = 0;
    panel.hidden = true;
    panel.inert = false;
    delete panel.dataset.tab;
    delete anchor.dataset.open;
    for (const tab of tabs) {
      tab.setAttribute('aria-expanded', 'false');
    }
    for (const item of views) {
      item.hidden = true;
    }
  }

  function setOpenTab(next: Tab | undefined) {
    openTab = next;
    for (const tab of tabs) {
      tab.setAttribute('aria-expanded', String(tab.dataset.boxTab === next));
    }
    if (next) {
      anchor.dataset.open = next;
      showPanel(next);
    } else {
      delete anchor.dataset.open;
      hidePanel();
    }
    fit();
  }

  /** Lifts the subject into the space above the dock and panel, without moving the page. */
  function fit() {
    const stageBox = surface.stage.getBoundingClientRect();
    const dockSpace = stageBox.bottom - dock.getBoundingClientRect().top;
    // A panel scrolls rather than reach the zoom chip, which only happens with very large text.
    const chipSpace = surface.zoomTools?.offsetHeight ?? 0;
    anchor.style.setProperty(
      '--control-box-panel-limit',
      `${surface.stage.clientHeight - dockSpace - chipSpace}px`,
    );
    if (openTab && panelMotion.length === 0) {
      panelHeight = panel.getBoundingClientRect().height;
    }
    const cover = dockSpace + panelHeight;
    const room = surface.stage.clientHeight - surface.target().clientHeight - TARGET_CLEARANCE_PX;
    const next = -Math.min(cover + LIFT_CLEARANCE_PX, Math.max(0, room)) / 2;
    if (next === lift) {
      return;
    }
    const { host } = surface;
    if (lift === undefined) {
      host.style.transition = 'none';
    }
    host.dataset.lift = lift !== undefined && next > lift ? 'settle' : 'rise';
    host.style.translate = `0 ${next}px`;
    if (lift === undefined) {
      void host.offsetWidth;
      host.style.removeProperty('transition');
    }
    lift = next;
  }

  // --- Actions

  function say(message: string) {
    view?.clearTimeout(toastTimer);
    toast.textContent = message;
    anchor.style.setProperty('--control-box-panel-height', `${panelHeight}px`);
    toastTimer =
      view?.setTimeout(() => {
        toast.textContent = '';
      }, TOAST_MS) ?? 0;
  }

  async function copyCode() {
    try {
      await view?.navigator.clipboard.writeText(effectSnippet(effect, settings, locale));
      say(messages.codeCopied);
    } catch {
      setOpenTab('code');
      view?.getSelection()?.selectAllChildren(code);
      say(messages.copyManually);
    }
  }

  async function copyLink() {
    if (!view) {
      return;
    }
    const url = new URL(view.location.href);
    url.search = linkSearch(url.search, effect, settings);
    // Written only here: reload keeps nothing the viewer has not shared.
    view.history.replaceState(view.history.state, '', url);
    try {
      await view.navigator.clipboard.writeText(url.href);
      say(messages.linkCopied);
    } catch {
      say(messages.linkInAddressBar);
    }
  }

  function setClock(next: EffectClock) {
    let time = settings.time;
    if (next === 'manual') {
      // Holds the current frame; the slider's range and step decide the exact value.
      const running = slot.handle?.time;
      time = running === undefined ? time : sliderTime(running);
      paused = false;
    } else {
      resumeTime = time;
    }
    settings = { ...settings, clock: next, time };
    changeRows(render);
    replaceIfNeeded();
  }

  function setMotion(next: EffectMotion) {
    settings = { ...settings, motion: next };
    changeRows(render);
    replaceIfNeeded();
  }

  function setColorMode(mode: FireColorMode) {
    settings = switchFireColorMode(settings, mode);
    changeRows(render);
    applyColors();
  }

  function commitSeed() {
    const value = seedInput.valueAsNumber;
    if (!Number.isFinite(value) || !Number.isFinite(Math.fround(value))) {
      seedInput.value = String(settings.seed);
      return;
    }
    settings = { ...settings, seed: value };
    render();
    replaceIfNeeded();
  }

  function shuffleSeed() {
    let seed = settings.seed;
    while (seed === settings.seed) {
      seed = Math.floor(Math.random() * SHUFFLE_RANGE);
    }
    settings = { ...settings, seed };
    render();
    replaceIfNeeded();
  }

  function resetAll() {
    resumeTime = defaults.time;
    settings = defaults;
    changeRows(render);
    applyLiveSettings();
    if (replacementKey(effect, settings) === appliedKey) {
      resumeTime = undefined;
    } else {
      void attach();
    }
  }

  function selectTarget(kind: ControlBoxTargetKind) {
    paused = false;
    visible = false;
    slot.clear();
    surface.selectTarget(kind);
    observer.disconnect();
    observer.observe(surface.target());
    onTargetChange?.();
    fit();
  }

  function togglePlayback() {
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
    publishStatus(slot.status);
    updateAvailability();
  }

  // --- Events

  function onInput(event: Event) {
    const input = event.target;
    if (input instanceof HTMLInputElement && input.dataset.boxTime !== undefined) {
      settings = { ...settings, time: Number(input.value) };
      render();
      if (settings.clock === 'manual' && slot.handle) {
        slot.handle.time = settings.time;
      }
      return;
    }
    if (input instanceof HTMLInputElement && input.dataset.boxColorInput) {
      const name = input.dataset.boxColorInput as ColorName;
      settings = { ...settings, color: withColor(settings.color, name, input.value) };
      render();
      applyColors();
      return;
    }
    if (!(input instanceof HTMLInputElement || input instanceof HTMLSelectElement)) {
      return;
    }
    const entry = settingFields.find((item) => item.input === input);
    if (!entry) {
      return;
    }
    const { field } = entry;
    if (input === draggedSlider) {
      setValue(input, String(snapEffectSliderValue(field, Number(input.value))));
    }
    const value = effectSettingApiValue(field, input.value);
    settings =
      field === intensityField
        ? { ...settings, intensity: value }
        : { ...settings, options: { ...settings.options, [field.name]: value } };
    render();
    // Creation options wait for `change`; each one replaces the instance.
    applyField(field);
  }

  function onChange(event: Event) {
    const input = event.target;
    if (!(input instanceof HTMLInputElement || input instanceof HTMLSelectElement)) {
      return;
    }
    if (input === seedInput) {
      commitSeed();
      return;
    }
    if (input.dataset.boxSetting) {
      replaceIfNeeded();
      return;
    }
    switch (input.dataset.boxRadio) {
      case 'target':
        selectTarget(input.value as ControlBoxTargetKind);
        break;
      case 'clock':
        setClock(input.value as EffectClock);
        break;
      case 'motion':
        setMotion(input.value as EffectMotion);
        break;
      case 'color-mode':
        setColorMode(input.value as FireColorMode);
        break;
    }
  }

  function onClick(event: Event) {
    if (!(event.target instanceof Element)) {
      return;
    }
    const button = event.target.closest<HTMLButtonElement>('button');
    if (!button) {
      return;
    }
    const { boxTab, boxUnset } = button.dataset;
    if (boxTab) {
      setOpenTab(boxTab === openTab ? undefined : (boxTab as Tab));
    } else if (boxUnset) {
      const name = boxUnset as ColorName;
      settings = {
        ...settings,
        color: isFire ? withColor(settings.color, name, undefined) : { mode: 'authored' },
      };
      render();
      applyColors();
      colorRows.find((row) => row.name === name)?.input.focus();
    } else if (button === pauseButton) {
      togglePlayback();
    } else if (button === resetButton) {
      resetAll();
    } else if (button.dataset.boxShuffle !== undefined) {
      shuffleSeed();
    } else if (button.dataset.boxLink !== undefined) {
      void copyLink();
    } else if (button.dataset.boxCopy !== undefined) {
      void copyCode();
    }
  }

  function isSelectOpen() {
    return (
      view?.CSS.supports('selector(:open)') === true && root.querySelector('select:open') !== null
    );
  }

  root.addEventListener('input', onInput, { signal });
  root.addEventListener('change', onChange, { signal });
  root.addEventListener('click', onClick, { signal });
  root.addEventListener(
    'pointerdown',
    (event) => {
      if (event.target instanceof HTMLInputElement && event.target.type === 'range') {
        draggedSlider = event.target;
      }
    },
    { signal },
  );
  view.addEventListener('pointerup', () => (draggedSlider = undefined), { signal });
  view.addEventListener('pointercancel', () => (draggedSlider = undefined), { signal });
  root.addEventListener(
    'keydown',
    (event) => {
      if (event.key === 'Escape' && openTab && !isSelectOpen()) {
        event.preventDefault();
        event.stopPropagation();
        const back = tabs.find((tab) => tab.dataset.boxTab === openTab);
        setOpenTab(undefined);
        back?.focus();
      }
    },
    { signal },
  );

  const observer = new view.IntersectionObserver(
    ([entry]) => {
      visible = entry.isIntersecting && entry.intersectionRatio > 0;
      if (
        visible &&
        slot.status.lifecycle !== 'initializing' &&
        (!slot.handle || slot.handle.reason === 'stale-raster')
      ) {
        void attach();
      }
    },
    { threshold: Number.EPSILON },
  );
  const stageSize = new view.ResizeObserver(fit);
  stageSize.observe(surface.stage);
  if (surface.zoomTools) {
    stageSize.observe(surface.zoomTools);
  }
  reducedMotion.addEventListener(
    'change',
    () => {
      if (reducedMotion.matches) {
        paused = false;
        needsResume = true;
      }
      environment.update();
      publishStatus(slot.status);
      updateAvailability();
    },
    { signal },
  );

  for (const group of root.querySelectorAll<HTMLElement>('[data-box-segments]')) {
    glideSelection(group, {
      items: 'label',
      selected: 'label:has(input:checked)',
      variant: 'fill',
      signal,
    });
  }
  glideSelection(required<HTMLElement>('[data-box-tabs]', root), {
    items: '[data-box-tab]',
    selected: '[aria-expanded="true"]',
    variant: 'line',
    signal,
  });
  startTopLayerTooltips(surface.frame, signal);

  for (const button of root.querySelectorAll<HTMLButtonElement>(
    '[data-box-tab], [data-box-link], [data-box-copy]',
  )) {
    button.disabled = false;
  }
  render();
  // No-WebGPU and reduced motion are known now, without waiting for the target to enter view.
  const blocked = environment.blockedReason();
  publishStatus(
    blocked === 'no-webgpu' || blocked === 'reduced-motion'
      ? { lifecycle: 'unavailable', reason: blocked }
      : slot.status,
  );
  fit();
  observer.observe(surface.target());

  return {
    get settings() {
      return settings;
    },
    /** State to pass back as `initial` when the page is restored from the back/forward cache. */
    snapshot(): ControlBoxSnapshot {
      return { settings, paused, needsResume };
    },
    dispose() {
      lifetime.abort();
      observer.disconnect();
      stageSize.disconnect();
      view?.clearTimeout(toastTimer);
      clearPanelMotion();
      closePanelNow();
      slot.dispose();
      surface.host.style.removeProperty('translate');
      delete surface.host.dataset.lift;
    },
  };
}

export type ControlBox = ReturnType<typeof createControlBox>;
