import type { Effect, EffectId } from './effects';

// Reader-facing descriptions live here; renderer settings remain in the browser package.
export const effectReference = {
  electricity: {
    description:
      'Branching blue lightning follows the visible shape. Creation-only contourSpread is a finite nonnegative fraction of the shorter untransformed border-box side, transparent margins included: 0.1 permits 10 CSS px outside a 100px shorter side. It bounds positive signed distance; strand thickness, noise and spark detail stay fixed. Zero is transparent; omission keeps legacy rendering.',
    intensity:
      'Changes electrical strength and brightness; it does not move the strands. With contourSpread, scales premultiplied output independently of spread and detail.',
  },
  frost: {
    description:
      'A white-blue ice coating with pale smoke and small frost particles. Writable mistOpacity changes smoke opacity without changing the coating or grains.',
    intensity:
      'Legacy mode extends frost inward and strengthens mist and particles. With coatingDepth or mistReach, intensity scales strength only; omitted extents are zero.',
  },
  fire: {
    description:
      'Warm flames and sparks rise from the visible shape. Creation-only emberDensity selects fixed seeded ember sites; the resolved value is read-only on the handle.',
    intensity:
      'With flameReach, scales visual strength without changing reach or fine detail. Omitted flameReach preserves legacy intensity and flameHeight behavior.',
  },
  dither: {
    description: 'Ordered dots coat the edge and form rising wisps.',
    intensity:
      'With extent options omitted: Increases dot density, inward coverage and outward reach. In relative mode, intensity scales opacity without changing extent or marks.',
  },
  slime: {
    description:
      'A glossy green coating with drips that stretch and fall. Writable gloss changes highlights without moving the coating or drip contours.',
    intensity:
      'Legacy mode changes coating and drip geometry. With coatingDepth or dripReach, intensity scales strength only; omitted extents are zero.',
  },
  kinetic: {
    description:
      'A bright pulse travels around the shape with a violet wake and geometric fragments. Creation-only fragmentTravel is a finite nonnegative fraction of the shorter untransformed border-box side, transparent margins included: 0.1 permits 10 CSS px of outward fragment-center travel on a 100px shorter side. A fixed 3px sideways drift and 5px fragment footprint add 8px to exterior support. Zero is transparent; omission keeps legacy rendering.',
    intensity:
      'With fragmentTravel, scales premultiplied strength while pulse/wake coverage, fragment travel and fine fragment size stay fixed. Omission retains legacy pulse-width and fragment behavior.',
  },
  'burned-paper': {
    description:
      'An uneven charred rim with brown scorching and sparse glowing seams. Writable emberGlow changes the glow without removing char or scorching.',
    intensity:
      'Legacy mode spreads scorching inward and strengthens ash. With scorchDepth or ashReach, intensity scales strength only; omitted extents are zero. The original content remains intact.',
  },
  halftone: {
    description:
      'Halftone dots follow the edge. Creation-only dotSpacing sets local CSS-pixel pitch and proportionally scales dot radius without extending support.',
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
