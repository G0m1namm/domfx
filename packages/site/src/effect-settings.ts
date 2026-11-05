import {
  effectColorField,
  effectCreationFields,
  effectSettingApiValue,
  effectWritableFields,
  intensityField,
  isEffectCreationName,
  isEffectWritableName,
  type EffectOptionName,
  type EffectSetting,
} from './effect-extent.ts';
import { effects, findEffect, type Effect } from './effects.ts';
import type { Locale } from './locale.ts';

export type EffectClock = 'auto' | 'manual';
export type EffectMotion = 'respect' | 'static';
export type FireColorMode = 'authored' | 'single' | 'root-and-tip';

/** Only Fire uses `root-and-tip`; an effect without a color control ignores every variant. */
export type EffectColorSettings =
  | { readonly mode: 'authored' }
  | { readonly mode: 'single'; readonly color?: string }
  | { readonly mode: 'root-and-tip'; readonly rootColor?: string; readonly tipColor?: string };

/** Every value uses its API unit. Subject, zoom and pan are outside this state. */
export interface EffectSettings {
  readonly intensity: number;
  readonly seed: number;
  readonly clock: EffectClock;
  /** Kept while `clock` is `auto` so External control can resume it; only `manual` uses it. */
  readonly time: number;
  readonly motion: EffectMotion;
  readonly options: Readonly<Partial<Record<EffectOptionName, number>>>;
  readonly color: EffectColorSettings;
}

/** The creation options behind both the preview and the copied code, without `host`. */
export interface EffectAttachmentOptions extends Readonly<
  Partial<Record<EffectOptionName, number>>
> {
  readonly clock: EffectClock;
  readonly time?: number;
  readonly motion?: 'static';
  readonly intensity: number;
  readonly seed: number;
  readonly color?: string;
  readonly rootColor?: string;
  readonly tipColor?: string;
}

/** A preview range in seconds, not an API limit. This slider has no stops. */
export const effectTimeField = { name: 'time', min: 0, max: 20, step: 0.1 } as const;

const defaultSeed = 314;
const disposeComments: Record<Locale, string> = {
  en: '// On unmount: effect.dispose();',
  es: '// Al desmontar: effect.dispose();',
};

function apiDefault(field: EffectSetting) {
  return effectSettingApiValue(field, String(field.defaultValue));
}

function optionFields(effect: Effect) {
  return [...effectCreationFields(effect), ...effectWritableFields(effect)].flatMap((field) => {
    const { name } = field;
    return isEffectCreationName(name) || isEffectWritableName(name) ? [{ name, field }] : [];
  });
}

export function defaultEffectSettings(effect: Effect): EffectSettings {
  return {
    intensity: apiDefault(intensityField),
    seed: defaultSeed,
    clock: 'auto',
    time: effectTimeField.min,
    motion: 'respect',
    options: Object.fromEntries(
      optionFields(effect).map(({ name, field }) => [name, apiDefault(field)]),
    ),
    color: { mode: 'authored' },
  };
}

function colorOptions(effect: Effect, color: EffectColorSettings) {
  if (!effectColorField(effect)) {
    return {};
  }
  switch (color.mode) {
    case 'authored':
      return {};
    case 'single':
      return color.color === undefined ? {} : { color: color.color };
    case 'root-and-tip':
      if (effect.id !== 'fire') {
        return {};
      }
      return {
        ...(color.rootColor === undefined ? {} : { rootColor: color.rootColor }),
        ...(color.tipColor === undefined ? {} : { tipColor: color.tipColor }),
      };
  }
}

/** Property order is the order of the copied code. `time` requires `manual` under #205. */
export function effectAttachmentOptions(
  effect: Effect,
  settings: EffectSettings,
): EffectAttachmentOptions {
  return {
    clock: settings.clock,
    ...(settings.clock === 'manual' ? { time: settings.time } : {}),
    ...(settings.motion === 'static' ? { motion: settings.motion } : {}),
    intensity: settings.intensity,
    seed: settings.seed,
    ...Object.fromEntries(
      optionFields(effect).map(({ name, field }) => [
        name,
        settings.options[name] ?? apiDefault(field),
      ]),
    ),
    ...colorOptions(effect, settings.color),
  };
}

/** The copied code: it reproduces the preview because both read effectAttachmentOptions. */
export function effectSnippet(effect: Effect, settings: EffectSettings, locale: Locale): string {
  const options = Object.entries(effectAttachmentOptions(effect, settings)).map(
    ([name, value]) => `  ${name}: ${typeof value === 'string' ? `'${value}'` : value},`,
  );
  return [
    `import { ${effect.exportName} } from '@domfx/browser';`,
    '',
    `const effect = ${effect.exportName}(target, {`,
    '  host,',
    ...options,
    '});',
    '',
    disposeComments[locale],
  ].join('\n');
}

/** Non-default values only, under API names, in copied-code order. */
export function encodeEffectSettings(effect: Effect, settings: EffectSettings): URLSearchParams {
  const defaults: Record<string, unknown> = {
    ...effectAttachmentOptions(effect, defaultEffectSettings(effect)),
    time: effectTimeField.min,
  };
  const params = new URLSearchParams();
  for (const [name, value] of Object.entries(effectAttachmentOptions(effect, settings))) {
    if (value !== defaults[name]) {
      params.set(name, String(value));
    }
  }
  return params;
}

/** A plain decimal; rejects forms Number() accepts, such as an empty string or `0x10`. */
function numberParam(params: URLSearchParams, name: string) {
  const source = params.get(name);
  if (source === null || !/^-?\d+(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(source)) {
    return undefined;
  }
  const value = Number(source);
  return Number.isFinite(value) ? value : undefined;
}

function rangeParam(params: URLSearchParams, name: string, min: number, max: number) {
  const value = numberParam(params, name);
  return value !== undefined && value >= min && value <= max ? value : undefined;
}

function optionParam(params: URLSearchParams, name: string, field: EffectSetting) {
  if (field.kind === 'range') {
    return rangeParam(params, name, field.min / field.scale, field.max / field.scale);
  }
  const value = numberParam(params, name);
  return field.options.some((option) => option.value / field.scale === value) ? value : undefined;
}

function seedParam(params: URLSearchParams) {
  const value = numberParam(params, 'seed');
  // The API rejects a value that overflows its float32 transport.
  return value !== undefined && Number.isFinite(Math.fround(value)) ? value : undefined;
}

/** The native color input needs lowercase #rrggbb; a subset of what the API accepts. */
function colorParam(params: URLSearchParams, name: string) {
  const source = params.get(name)?.toLowerCase();
  if (source === undefined) {
    return undefined;
  }
  if (/^#[0-9a-f]{6}$/.test(source)) {
    return source;
  }
  return /^#[0-9a-f]{3}$/.test(source) ? source.replace(/[0-9a-f]/g, '$&$&') : undefined;
}

function parseColor(effect: Effect, params: URLSearchParams): EffectColorSettings {
  if (!effectColorField(effect)) {
    return { mode: 'authored' };
  }
  if (effect.id === 'fire') {
    const rootColor = colorParam(params, 'rootColor');
    const tipColor = colorParam(params, 'tipColor');
    if (rootColor !== undefined || tipColor !== undefined) {
      return {
        mode: 'root-and-tip',
        ...(rootColor === undefined ? {} : { rootColor }),
        ...(tipColor === undefined ? {} : { tipColor }),
      };
    }
  }
  const color = colorParam(params, 'color');
  return color === undefined ? { mode: 'authored' } : { mode: 'single', color };
}

/** Never throws: each invalid or out-of-range value is ignored and keeps its default. */
export function parseEffectSettings(effect: Effect, params: URLSearchParams): EffectSettings {
  const defaults = defaultEffectSettings(effect);
  const clock = params.get('clock') === 'manual' ? 'manual' : defaults.clock;
  const time =
    clock === 'manual'
      ? rangeParam(params, 'time', effectTimeField.min, effectTimeField.max)
      : undefined;
  return {
    intensity: optionParam(params, 'intensity', intensityField) ?? defaults.intensity,
    seed: seedParam(params) ?? defaults.seed,
    clock,
    time: time ?? defaults.time,
    motion: params.get('motion') === 'static' ? 'static' : defaults.motion,
    options: Object.fromEntries(
      optionFields(effect).map(({ name, field }) => [
        name,
        optionParam(params, name, field) ?? apiDefault(field),
      ]),
    ),
    color: parseColor(effect, params),
  };
}

const settingParamNames = new Set([
  'clock',
  'time',
  'motion',
  'intensity',
  'seed',
  'color',
  'rootColor',
  'tipColor',
  ...effects.flatMap((effect) => optionFields(effect).map(({ name }) => name)),
]);

function withoutSettingParams(search: string) {
  const params = new URLSearchParams(search);
  for (const name of settingParamNames) {
    params.delete(name);
  }
  return params;
}

function searchString(params: URLSearchParams) {
  const search = params.toString();
  return search ? `?${search}` : '';
}

/** The Copy link query for a page that already names its effect; other params are kept. */
export function effectSettingsSearch(
  search: string,
  effect: Effect,
  settings: EffectSettings,
): string {
  const params = withoutSettingParams(search);
  for (const [name, value] of encodeEffectSettings(effect, settings)) {
    params.set(name, value);
  }
  return searchString(params);
}

/** The marketing Copy link query: names the dialog and keeps `audience` and other params. */
export function marketingEffectSearch(
  search: string,
  effect: Effect,
  settings: EffectSettings,
): string {
  const params = withoutSettingParams(search);
  params.set('effect', effect.id);
  for (const [name, value] of encodeEffectSettings(effect, settings)) {
    params.set(name, value);
  }
  return searchString(params);
}

/** The dialog a marketing URL opens; a missing or unknown effect opens nothing. */
export function parseMarketingEffectSearch(
  search: string,
): { readonly effect: Effect; readonly settings: EffectSettings } | undefined {
  const params = new URLSearchParams(search);
  const effect = findEffect(params.get('effect') ?? undefined);
  return effect && { effect, settings: parseEffectSettings(effect, params) };
}

/** Reset all stays disabled while this is false. An unset color mode counts as no difference. */
export function effectSettingsDiffer(effect: Effect, settings: EffectSettings): boolean {
  return encodeEffectSettings(effect, settings).size > 0;
}

/** Clears the other modes' values. Root and tip with neither side set changes no output. */
export function switchFireColorMode(settings: EffectSettings, mode: FireColorMode): EffectSettings {
  return settings.color.mode === mode ? settings : { ...settings, color: { mode } };
}

/** Snap points in the field's slider units: min, default and max. Presets have none. */
export function effectSliderStops(field: EffectSetting): readonly number[] {
  return field.kind === 'range' ? [...new Set([field.min, field.defaultValue, field.max])] : [];
}

/**
 * Moves a slider value to a stop within `tolerance`, one step by default. Apply it to pointer
 * drags only: a keyboard step that snapped back could never leave a stop.
 */
export function snapEffectSliderValue(
  field: EffectSetting,
  value: number,
  tolerance = field.kind === 'range' ? field.step : 0,
): number {
  return effectSliderStops(field).find((stop) => Math.abs(stop - value) <= tolerance) ?? value;
}
