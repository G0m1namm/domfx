import type * as BrowserEffects from '@domfx/browser';

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
  category: 'Energy' | 'Material' | 'Pattern';
  exportName: keyof typeof BrowserEffects & `attach${string}`;
}[];

export type Effect = (typeof effects)[number];
export type EffectId = Effect['id'];

export function findEffect(id: string | undefined) {
  return effects.find((effect) => effect.id === id);
}

export const patternEffects = effects.filter(
  (effect) => effect.category === 'Pattern' && effect.id !== 'star-shimmer',
);
