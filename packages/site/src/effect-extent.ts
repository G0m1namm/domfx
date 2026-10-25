import { patternExtentReference } from './effect-reference';
import type { Effect } from './effects';

const extents = {
  fire: {
    optionsType: 'FireOptions',
    fields: [
      {
        name: 'flameReach',
        basis: 'height',
        example: 0.2,
        label: { en: 'Flame reach', es: 'Alcance de las llamas' },
      },
    ],
  },
  frost: {
    optionsType: 'FrostOptions',
    fields: [
      {
        name: 'coatingDepth',
        basis: 'shorter-side',
        example: 0.1,
        label: { en: 'Coating depth', es: 'Profundidad de la capa' },
      },
      {
        name: 'mistReach',
        basis: 'height',
        example: 0.2,
        label: { en: 'Mist travel', es: 'Recorrido de la niebla' },
      },
    ],
  },
  slime: {
    optionsType: 'SlimeOptions',
    fields: [
      {
        name: 'coatingDepth',
        basis: 'shorter-side',
        example: 0.05,
        label: { en: 'Coating depth', es: 'Profundidad de la capa' },
      },
      {
        name: 'dripReach',
        basis: 'height',
        example: 0.2,
        label: { en: 'Drip travel', es: 'Recorrido de las gotas' },
      },
    ],
  },
  'burned-paper': {
    optionsType: 'BurnedPaperOptions',
    fields: [
      {
        name: 'scorchDepth',
        basis: 'shorter-side',
        example: 0.15,
        label: { en: 'Scorch depth', es: 'Profundidad de la quemadura' },
      },
      {
        name: 'ashReach',
        basis: 'height',
        example: 0.15,
        label: { en: 'Ash travel', es: 'Recorrido de la ceniza' },
      },
    ],
  },
  electricity: {
    optionsType: 'ElectricityOptions',
    fields: [
      {
        name: 'contourSpread',
        basis: 'shorter-side',
        example: 0.1,
        label: { en: 'Contour spread', es: 'Extensión del contorno' },
      },
    ],
  },
  kinetic: {
    optionsType: 'KineticOptions',
    fields: [
      {
        name: 'fragmentTravel',
        basis: 'shorter-side',
        example: 0.2,
        label: { en: 'Fragment travel', es: 'Recorrido de los fragmentos' },
      },
    ],
  },
} as const;

/** One source for server-rendered examples and live creation controls. */
export function effectExtentReference(effect: Effect) {
  switch (effect.id) {
    case 'fire':
    case 'frost':
    case 'slime':
    case 'burned-paper':
    case 'electricity':
    case 'kinetic':
      return extents[effect.id];
    default:
      return patternExtentReference(effect);
  }
}

export type ExtentField = NonNullable<ReturnType<typeof effectExtentReference>>['fields'][number];
export type EffectCreationName = ExtentField['name'] | 'emberDensity' | 'dripDensity';
export type EffectWritableName = 'mistOpacity' | 'emberGlow';
export type EffectOptionName = EffectCreationName | EffectWritableName;
const effectCreationNames: readonly string[] = [
  'flameReach',
  'coatingDepth',
  'mistReach',
  'dripReach',
  'scorchDepth',
  'ashReach',
  'contourSpread',
  'fragmentTravel',
  'plumeReach',
  'bandDepth',
  'echoReach',
  'fringeReach',
  'emberDensity',
  'dripDensity',
];

export function isEffectCreationName(name: string): name is EffectCreationName {
  return effectCreationNames.includes(name);
}

export function isEffectWritableName(name: string): name is EffectWritableName {
  return ['mistOpacity', 'emberGlow'].includes(name);
}

type RangeSetting = {
  readonly kind: 'range';
  readonly name: string;
  readonly defaultValue: number;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly scale: number;
  readonly unit: 'percent' | 'css-px';
  readonly basis?: 'height' | 'shorter-side';
  readonly label?: { readonly en: string; readonly es: string };
};
type PresetSetting = {
  readonly kind: 'preset';
  readonly name: string;
  readonly defaultValue: number;
  readonly scale: number;
  readonly options: readonly {
    readonly value: number;
    readonly label: { readonly en: string; readonly es: string };
  }[];
};
export type EffectSetting = RangeSetting | PresetSetting;

/** The single optional decorative color keeps its string value distinct from numeric settings. */
export type EffectColorSetting = {
  readonly kind: 'color';
  readonly name: 'color';
};

const colorSetting = { kind: 'color', name: 'color' } as const satisfies EffectColorSetting;

export function effectColorField(effect: Effect): EffectColorSetting | undefined {
  return effect.id === 'burned-paper' ? undefined : colorSetting;
}

function extentSetting(field: ExtentField): RangeSetting {
  return {
    ...field,
    kind: 'range',
    defaultValue: field.example * 100,
    min: 0,
    max: 30,
    step: 1,
    scale: 100,
    unit: 'percent',
  };
}

/** Effect-owned creation controls replace the current preview instance. */
export function effectCreationFields(effect: Effect): readonly EffectSetting[] {
  const fields = (effectExtentReference(effect)?.fields ?? []).map(extentSetting);
  if (effect.id === 'fire') {
    return [
      ...fields,
      {
        name: 'emberDensity',
        kind: 'preset',
        defaultValue: 100,
        scale: 100,
        options: [
          { value: 0, label: { en: 'None', es: 'Sin brasas' } },
          { value: 50, label: { en: 'Half', es: 'Media' } },
          { value: 100, label: { en: 'Full', es: 'Completa' } },
        ],
      },
    ];
  }
  if (effect.id === 'slime') {
    return [
      ...fields,
      {
        name: 'dripDensity',
        kind: 'preset',
        defaultValue: 56,
        scale: 100,
        options: [
          { value: 0, label: { en: 'None', es: 'Sin gotas' } },
          { value: 20, label: { en: 'Low', es: 'Baja' } },
          { value: 56, label: { en: 'Medium', es: 'Media' } },
          { value: 100, label: { en: 'High', es: 'Alta' } },
        ],
      },
    ];
  }
  return fields;
}

/** Instance fields update the current effect without recapturing its target. */
export function effectWritableFields(effect: Effect): readonly EffectSetting[] {
  switch (effect.id) {
    case 'frost':
      return [percentField('mistOpacity')];
    case 'burned-paper':
      return [percentField('emberGlow')];
    default:
      return [];
  }
}

function percentField(name: string): RangeSetting {
  return {
    name,
    kind: 'range',
    defaultValue: 100,
    min: 0,
    max: 100,
    step: 1,
    scale: 100,
    unit: 'percent',
  };
}

export type EffectCreationField = ReturnType<typeof effectCreationFields>[number];
export type EffectWritableField = ReturnType<typeof effectWritableFields>[number];

export const intensityField = percentField('intensity');

export function effectSettingApiValue(field: EffectSetting, value: string) {
  return Number(value) / field.scale;
}

export function effectSettingDisplayValue(field: EffectSetting, value: string) {
  return field.kind === 'range' && field.unit === 'css-px' ? `${value} px` : `${value}%`;
}

export function effectSettingBasis(field: EffectSetting, locale: 'en' | 'es') {
  if (field.kind !== 'range') {
    return '';
  }
  if (field.basis === 'height') {
    return locale === 'es' ? 'de la altura del elemento' : 'of element height';
  }
  if (field.basis === 'shorter-side') {
    return locale === 'es' ? 'del lado más corto' : 'of the shorter side';
  }
  if (field.unit === 'css-px') {
    return locale === 'es' ? 'píxeles CSS locales' : 'local CSS pixels';
  }
  return '';
}

export function effectSettingValueText(field: EffectSetting, value: string, locale: 'en' | 'es') {
  return `${effectSettingDisplayValue(field, value)} ${effectSettingBasis(field, locale)}`.trim();
}
