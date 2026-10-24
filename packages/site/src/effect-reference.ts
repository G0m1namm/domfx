import type { Effect, EffectId } from './effects';

// Reader-facing descriptions live here; renderer settings remain in the browser package.
export const effectReference = {
  electricity: {
    description: 'Branching blue lightning strands follow the visible shape.',
    intensity: 'Increases the reach and brightness of the electrical strands.',
  },
  frost: {
    description: 'A white-blue ice coating with pale smoke and small frost particles.',
    intensity: 'Extends the frost inward and strengthens the smoke and particles.',
  },
  fire: {
    description: 'Warm flames and sparks rise from the visible shape.',
    intensity:
      'Increases flame reach and brightness. Use flameHeight to set the flame scale at creation.',
  },
  dither: {
    description: 'Ordered dots coat the edge and form rising wisps.',
    intensity:
      'With extent options omitted: Increases dot density, inward coverage and outward reach. In relative mode, intensity scales opacity without changing extent or marks.',
  },
  slime: {
    description: 'A glossy green coating with drips that stretch and fall.',
    intensity: 'Strengthens the coating and drips.',
  },
  kinetic: {
    description:
      'A bright pulse travels around the shape with a violet wake and geometric fragments.',
    intensity: 'Increases pulse width, brightness and fragment reach.',
  },
  'burned-paper': {
    description: 'An uneven charred rim with brown scorching and sparse glowing seams.',
    intensity:
      'Spreads the scorching inward while keeping the outer rim narrow. The original content remains intact.',
  },
  halftone: {
    description: 'Halftone dots follow the edge.',
    intensity:
      'With extent options omitted: Strengthens the pattern and extends its reach. In relative mode, intensity scales opacity without changing extent or marks.',
  },
  stipple: {
    description: 'Scattered dots trace the visible shape.',
    intensity:
      'With extent options omitted: Strengthens the pattern and extends its reach. In relative mode, intensity scales opacity without changing extent or marks.',
  },
  scanlines: {
    description: 'Fine horizontal bands move along the edge.',
    intensity:
      'With extent options omitted: Strengthens the pattern and extends its reach. In relative mode, intensity scales opacity without changing extent or marks.',
  },
  crosshatch: {
    description: 'Crossing lines form a hatched pattern along the edge.',
    intensity:
      'With extent options omitted: Strengthens the pattern and extends its reach. In relative mode, intensity scales opacity without changing extent or marks.',
  },
  diamonds: {
    description: 'A diamond lattice follows the visible shape.',
    intensity:
      'With extent options omitted: Strengthens the pattern and extends its reach. In relative mode, intensity scales opacity without changing extent or marks.',
  },
  'contour-echoes': {
    description: 'Repeated outlines echo the edge of the visible shape.',
    intensity:
      'With extent options omitted: Strengthens the pattern and extends its reach. In relative mode, intensity scales opacity without changing extent or marks.',
  },
  engraving: {
    description: 'Fine engraved lines texture the edge.',
    intensity:
      'With extent options omitted: Strengthens the pattern and extends its reach. In relative mode, intensity scales opacity without changing extent or marks.',
  },
  'woven-mesh': {
    description: 'Interlaced strands create a woven edge texture.',
    intensity:
      'With extent options omitted: Strengthens the pattern and extends its reach. In relative mode, intensity scales opacity without changing extent or marks.',
  },
  hexagons: {
    description: 'A hexagonal grid follows the visible shape.',
    intensity:
      'With extent options omitted: Strengthens the pattern and extends its reach. In relative mode, intensity scales opacity without changing extent or marks.',
  },
  interference: {
    description: 'Overlapping waves form an interference pattern around the edge.',
    intensity:
      'With extent options omitted: Strengthens the pattern and extends its reach. In relative mode, intensity scales opacity without changing extent or marks.',
  },
  shards: {
    description: 'Angular fragments cluster along the edge.',
    intensity:
      'With extent options omitted: Strengthens the pattern and extends its reach. In relative mode, intensity scales opacity without changing extent or marks.',
  },
  circuits: {
    description: 'Circuit-like paths trace the visible shape.',
    intensity:
      'With extent options omitted: Strengthens the pattern and extends its reach. In relative mode, intensity scales opacity without changing extent or marks.',
  },
  'star-shimmer': {
    description: 'Small star-shaped highlights shimmer along the edge.',
    intensity:
      'With extent options omitted: Strengthens the pattern and extends its reach. In relative mode, intensity scales opacity without changing extent or marks.',
  },
  'brush-fringe': {
    description: 'Brush-like marks form a fringe along the visible shape.',
    intensity:
      'With extent options omitted: Strengthens the pattern and extends its reach. In relative mode, intensity scales opacity without changing extent or marks.',
  },
} satisfies Record<EffectId, { description: string; intensity: string }>;

const flowExtent = {
  optionsType: 'PatternOptions',
  family: 'flow',
  fields: [
    {
      name: 'plumeReach',
      basis: 'height',
      example: 0.1,
      label: { en: 'Plume reach', es: 'Alcance ascendente' },
    },
    {
      name: 'bandDepth',
      basis: 'shorter-side',
      example: 0.05,
      label: { en: 'Inward band depth', es: 'Profundidad de la banda interior' },
    },
  ],
} as const;

/** Shared reference/preview metadata; all values are creation-only numeric fractions. */
export function patternExtentReference(effect: Effect) {
  if (effect.category !== 'Pattern') {
    return undefined;
  }
  if (effect.id === 'contour-echoes') {
    return {
      optionsType: 'ContourEchoesOptions',
      family: 'echoes',
      fields: [
        {
          name: 'echoReach',
          basis: 'shorter-side',
          example: 0.1,
          label: { en: 'Echo reach', es: 'Alcance de los contornos' },
        },
      ],
    } as const;
  }
  if (effect.id === 'brush-fringe') {
    return {
      optionsType: 'BrushFringeOptions',
      family: 'fringe',
      fields: [
        {
          name: 'fringeReach',
          basis: 'shorter-side',
          example: 0.1,
          label: { en: 'Fringe reach', es: 'Alcance de las pinceladas' },
        },
      ],
    } as const;
  }
  return effect.id === 'dither' ? { ...flowExtent, optionsType: 'DitherOptions' } : flowExtent;
}
