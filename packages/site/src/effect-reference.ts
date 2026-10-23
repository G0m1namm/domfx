import type { EffectId } from './effects';

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
    intensity: 'Increases dot density, inward coverage and outward reach.',
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
    intensity: 'Strengthens the pattern and extends its reach.',
  },
  stipple: {
    description: 'Scattered dots trace the visible shape.',
    intensity: 'Strengthens the pattern and extends its reach.',
  },
  scanlines: {
    description: 'Fine horizontal bands move along the edge.',
    intensity: 'Strengthens the pattern and extends its reach.',
  },
  crosshatch: {
    description: 'Crossing lines form a hatched pattern along the edge.',
    intensity: 'Strengthens the pattern and extends its reach.',
  },
  diamonds: {
    description: 'A diamond lattice follows the visible shape.',
    intensity: 'Strengthens the pattern and extends its reach.',
  },
  'contour-echoes': {
    description: 'Repeated outlines echo the edge of the visible shape.',
    intensity: 'Strengthens the pattern and extends its reach.',
  },
  engraving: {
    description: 'Fine engraved lines texture the edge.',
    intensity: 'Strengthens the pattern and extends its reach.',
  },
  'woven-mesh': {
    description: 'Interlaced strands create a woven edge texture.',
    intensity: 'Strengthens the pattern and extends its reach.',
  },
  hexagons: {
    description: 'A hexagonal grid follows the visible shape.',
    intensity: 'Strengthens the pattern and extends its reach.',
  },
  interference: {
    description: 'Overlapping waves form an interference pattern around the edge.',
    intensity: 'Strengthens the pattern and extends its reach.',
  },
  shards: {
    description: 'Angular fragments cluster along the edge.',
    intensity: 'Strengthens the pattern and extends its reach.',
  },
  circuits: {
    description: 'Circuit-like paths trace the visible shape.',
    intensity: 'Strengthens the pattern and extends its reach.',
  },
  'star-shimmer': {
    description: 'Small star-shaped highlights shimmer along the edge.',
    intensity: 'Strengthens the pattern and extends its reach.',
  },
  'brush-fringe': {
    description: 'Brush-like marks form a fringe along the visible shape.',
    intensity: 'Strengthens the pattern and extends its reach.',
  },
} satisfies Record<EffectId, { description: string; intensity: string }>;
