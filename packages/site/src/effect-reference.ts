import type { EffectId } from './effects';

// Reader-facing descriptions live here; renderer settings remain in the browser package.
export const effectReference = {
  electricity: {
    description: 'Branching blue lightning strands follow the visible shape.',
    intensity: 'Increases the reach and brightness of the electrical strands.',
  },
  frost: {
    description: 'An icy white-blue coating, pale smoke and small frost particles.',
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
    description: 'A glossy green coating with stretching, falling drips.',
    intensity: 'Strengthens the coating and dripping material.',
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
    description: 'A halftone dot pattern follows the edge.',
    intensity: 'Strengthens the patterned coating and its reach.',
  },
  stipple: {
    description: 'Scattered stipple marks trace the visible shape.',
    intensity: 'Strengthens the patterned coating and its reach.',
  },
  scanlines: {
    description: 'Fine horizontal bands form an animated edge treatment.',
    intensity: 'Strengthens the patterned coating and its reach.',
  },
  crosshatch: {
    description: 'Crossing lines build a hatched edge treatment.',
    intensity: 'Strengthens the patterned coating and its reach.',
  },
  diamonds: {
    description: 'A diamond lattice follows the visible shape.',
    intensity: 'Strengthens the patterned coating and its reach.',
  },
  'contour-echoes': {
    description: 'Repeated outlines echo the edge of the visible shape.',
    intensity: 'Strengthens the patterned coating and its reach.',
  },
  engraving: {
    description: 'Engraved linework forms a textured edge treatment.',
    intensity: 'Strengthens the patterned coating and its reach.',
  },
  'woven-mesh': {
    description: 'Interlaced strands create a woven edge texture.',
    intensity: 'Strengthens the patterned coating and its reach.',
  },
  hexagons: {
    description: 'A hexagonal grid follows the visible shape.',
    intensity: 'Strengthens the patterned coating and its reach.',
  },
  interference: {
    description: 'Overlapping waves form an interference pattern around the edge.',
    intensity: 'Strengthens the patterned coating and its reach.',
  },
  shards: {
    description: 'Angular fragments form a geometric edge treatment.',
    intensity: 'Strengthens the patterned coating and its reach.',
  },
  circuits: {
    description: 'Circuit-like paths trace the visible shape.',
    intensity: 'Strengthens the patterned coating and its reach.',
  },
  'star-shimmer': {
    description: 'Small star-shaped highlights shimmer along the edge.',
    intensity: 'Strengthens the patterned coating and its reach.',
  },
  'brush-fringe': {
    description: 'Brush-like marks form a fringe along the visible shape.',
    intensity: 'Strengthens the patterned coating and its reach.',
  },
} satisfies Record<EffectId, { description: string; intensity: string }>;
