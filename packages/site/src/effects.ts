import type * as BrowserEffects from '@domfx/browser';

export const effectCategories = ['Energy', 'Material', 'Pattern'] as const;
export type EffectCategory = (typeof effectCategories)[number];

export const effects = [
  { id: 'electricity', name: 'Electricity', category: 'Energy', exportName: 'attachElectricity' },
  { id: 'frost', name: 'Frost', category: 'Material', exportName: 'attachFrost' },
  { id: 'fire', name: 'Fire', category: 'Energy', exportName: 'attachFire' },
  { id: 'dither', name: 'Dither', category: 'Pattern', exportName: 'attachDither' },
  { id: 'slime', name: 'Slime', category: 'Material', exportName: 'attachSlime' },
  { id: 'kinetic', name: 'Kinetic bloom', category: 'Energy', exportName: 'attachKinetic' },
  {
    id: 'burned-paper',
    name: 'Burned paper',
    category: 'Material',
    exportName: 'attachBurnedPaper',
  },
  { id: 'halftone', name: 'Halftone', category: 'Pattern', exportName: 'attachHalftone' },
  { id: 'stipple', name: 'Stipple', category: 'Pattern', exportName: 'attachStipple' },
  { id: 'scanlines', name: 'Scanlines', category: 'Pattern', exportName: 'attachScanlines' },
  { id: 'crosshatch', name: 'Crosshatch', category: 'Pattern', exportName: 'attachCrosshatch' },
  { id: 'diamonds', name: 'Diamond lattice', category: 'Pattern', exportName: 'attachDiamonds' },
  {
    id: 'contour-echoes',
    name: 'Contour echoes',
    category: 'Pattern',
    exportName: 'attachContourEchoes',
  },
  { id: 'engraving', name: 'Engraving', category: 'Pattern', exportName: 'attachEngraving' },
  { id: 'woven-mesh', name: 'Woven mesh', category: 'Pattern', exportName: 'attachWovenMesh' },
  { id: 'hexagons', name: 'Hexagons', category: 'Pattern', exportName: 'attachHexagons' },
  {
    id: 'interference',
    name: 'Interference',
    category: 'Pattern',
    exportName: 'attachInterference',
  },
  { id: 'shards', name: 'Shards', category: 'Pattern', exportName: 'attachShards' },
  { id: 'circuits', name: 'Circuits', category: 'Pattern', exportName: 'attachCircuits' },
  {
    id: 'star-shimmer',
    name: 'Star shimmer',
    category: 'Pattern',
    exportName: 'attachStarShimmer',
  },
  {
    id: 'brush-fringe',
    name: 'Brush fringe',
    category: 'Pattern',
    exportName: 'attachBrushFringe',
  },
] as const satisfies readonly {
  id: string;
  name: string;
  category: EffectCategory;
  exportName: keyof typeof BrowserEffects & `attach${string}`;
}[];

export type Effect = (typeof effects)[number];
export type EffectId = Effect['id'];

// Product names and API identifiers stay in English in every locale.
export const effectDescriptions = {
  en: {
    electricity: 'Crackling energy along the edge.',
    frost: 'Crystalline ice around the shape.',
    fire: 'Warm flames that follow the edge.',
    dither: 'A shifting field of fine pixels.',
    slime: 'Viscous droplets along the edge.',
    kinetic: 'A bloom of moving light.',
    'burned-paper': 'A charred, glowing paper edge.',
    halftone: 'Printed dots around the shape.',
    stipple: 'A field of scattered points.',
    scanlines: 'Fine horizontal signal lines.',
    crosshatch: 'Intersecting drawn lines.',
    diamonds: 'A repeating diamond lattice.',
    'contour-echoes': 'Repeated outlines of the shape.',
    engraving: 'Fine engraved linework.',
    'woven-mesh': 'Interlaced geometric strands.',
    hexagons: 'A honeycomb of geometric cells.',
    interference: 'Overlapping wave patterns.',
    shards: 'Angular fragments around the edge.',
    circuits: 'Branching electronic traces.',
    'star-shimmer': 'A field of small glinting stars.',
    'brush-fringe': 'Loose brush marks along the edge.',
  },
  es: {
    electricity: 'Energía crepitante a lo largo del borde.',
    frost: 'Hielo cristalino alrededor de la forma.',
    fire: 'Llamas cálidas que siguen el borde.',
    dither: 'Un campo cambiante de píxeles finos.',
    slime: 'Gotas viscosas a lo largo del borde.',
    kinetic: 'Una floración de luz en movimiento.',
    'burned-paper': 'Un borde de papel carbonizado y brillante.',
    halftone: 'Puntos impresos alrededor de la forma.',
    stipple: 'Un campo de puntos dispersos.',
    scanlines: 'Líneas horizontales finas como una señal.',
    crosshatch: 'Líneas dibujadas que se entrecruzan.',
    diamonds: 'Una retícula repetida de diamantes.',
    'contour-echoes': 'Contornos repetidos de la forma.',
    engraving: 'Trazos finos de grabado.',
    'woven-mesh': 'Hilos geométricos entrelazados.',
    hexagons: 'Un panal de celdas geométricas.',
    interference: 'Patrones de ondas superpuestas.',
    shards: 'Fragmentos angulares alrededor del borde.',
    circuits: 'Pistas electrónicas ramificadas.',
    'star-shimmer': 'Un campo de pequeñas estrellas centelleantes.',
    'brush-fringe': 'Pinceladas sueltas a lo largo del borde.',
  },
} as const satisfies Record<'en' | 'es', Record<EffectId, string>>;

export function findEffect(id: string | undefined) {
  return effects.find((effect) => effect.id === id);
}

export const patternEffects = effects.filter(
  (effect) => effect.category === 'Pattern' && effect.id !== 'star-shimmer',
);
