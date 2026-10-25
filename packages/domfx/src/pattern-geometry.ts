import { EffectError } from './effect-error.js';

const flowEffects = new Set([
  'dither',
  'halftone',
  'stipple',
  'scanlines',
  'crosshatch',
  'diamonds',
  'engraving',
  'woven-mesh',
  'hexagons',
  'interference',
  'shards',
  'circuits',
  'star-shimmer',
]);

type ExtentOptions = {
  readonly plumeReach?: number;
  readonly bandDepth?: number;
  readonly echoReach?: number;
  readonly fringeReach?: number;
};

/** Resolve creation-only fractions from the captured, untransformed border box. */
export function resolvePatternGeometry(
  effect: string,
  options: object,
  width: number,
  height: number,
): { directionalReach: number; inwardDepth: number } | undefined {
  let fields: (keyof ExtentOptions)[] | undefined;
  if (flowEffects.has(effect)) {
    fields = ['plumeReach', 'bandDepth'];
  } else if (effect === 'contour-echoes') {
    fields = ['echoReach'];
  } else if (effect === 'brush-fringe') {
    fields = ['fringeReach'];
  }
  if (!fields) {
    return undefined;
  }
  const extents: Partial<Record<keyof ExtentOptions, number>> = {};
  for (const key of ['plumeReach', 'bandDepth', 'echoReach', 'fringeReach'] as const) {
    const value: unknown = Reflect.get(options, key);
    if (value === undefined) {
      continue;
    }
    if (
      !fields.includes(key) ||
      typeof value !== 'number' ||
      !Number.isFinite(value) ||
      value < 0
    ) {
      throw new Error(`invalid-${effect}-parameter`);
    }
    extents[key] = value;
  }
  if (Object.keys(extents).length === 0) {
    return undefined;
  }
  const shorterSide = Math.min(width, height);
  const directionalReach = flowEffects.has(effect)
    ? height * (extents.plumeReach ?? 0)
    : shorterSide * (extents.echoReach ?? extents.fringeReach ?? 0);
  const inwardDepth = flowEffects.has(effect) ? shorterSide * (extents.bandDepth ?? 0) : 0;
  if (![directionalReach, inwardDepth].every((value) => Number.isFinite(Math.fround(value)))) {
    throw new EffectError('capture-budget');
  }
  return { directionalReach, inwardDepth };
}

/** Six CSS px bounds every fixed pattern mark, including rotated hexagons,
 * stars and bristles. Add the shared 2 CSS px paint overflow and SDF guard.
 */
export function patternSupport(geometry: {
  directionalReach: number;
  inwardDepth: number;
}): number {
  if (geometry.directionalReach === 0 && geometry.inwardDepth === 0) {
    return 0;
  }
  return geometry.directionalReach + 6;
}

export function patternPadding(
  geometry: { directionalReach: number; inwardDepth: number },
  dpr: number,
): number {
  return Math.max(8, Math.ceil(patternSupport(geometry) + 4 + 2 / dpr));
}
