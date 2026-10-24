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

/** Shared creation controls keep marketing and docs previews on the same API. */
export function effectCreationFields(effect: Effect) {
  const fields = (effectExtentReference(effect)?.fields ?? []).map((field) => ({
    ...field,
    max: 30,
  }));
  if (effect.id !== 'slime') {
    return fields;
  }
  return [
    ...fields,
    {
      name: 'dripDensity' as const,
      basis: 'drip-density' as const,
      example: 0.56,
      max: 100,
      label: { en: 'Drip density', es: 'Densidad de gotas' },
    },
  ];
}

export type EffectCreationField = ReturnType<typeof effectCreationFields>[number];
