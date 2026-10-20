export const effects = [
  'fire',
  'electricity',
  'frost',
  'kinetic',
  'slime',
  'burned-paper',
  'dither',
  'halftone',
  'stipple',
  'scanlines',
  'crosshatch',
  'diamonds',
  'contour-echoes',
  'engraving',
  'woven-mesh',
  'hexagons',
  'interference',
  'shards',
  'circuits',
  'star-shimmer',
  'brush-fringe',
] as const;

export function measurementEffect(): (typeof effects)[number] {
  const requested = new URLSearchParams(location.search).get('effect') ?? 'fire';
  const effect = effects.find((effect) => effect === requested);
  if (!effect) {
    throw new Error(`Unknown measurement effect: ${requested}`);
  }
  return effect;
}
