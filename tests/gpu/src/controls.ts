import { gsap } from 'gsap';

import {
  attachBurnedPaper,
  attachElectricity,
  attachDither,
  attachFire,
  attachFrost,
  attachHalftone,
  attachStipple,
  attachScanlines,
  attachCrosshatch,
  attachDiamonds,
  attachContourEchoes,
  attachEngraving,
  attachWovenMesh,
  attachHexagons,
  attachInterference,
  attachShards,
  attachCircuits,
  attachStarShimmer,
  attachBrushFringe,
  attachKinetic,
  attachSlime,
} from '@domfx/browser';
import { memoryFor, startEffectDiagnostics } from '@domfx/browser/experimental';

import { qualifyRawAlphaControls, qualifyRawEffectColors } from './controls-raw-alpha.js';

declare global {
  interface Window {
    controlEffects: {
      frost: typeof attachFrost;
      fire: typeof attachFire;
      electricity: typeof attachElectricity;
      dither: typeof attachDither;
      kinetic: typeof attachKinetic;
      halftone: typeof attachHalftone;
      stipple: typeof attachStipple;
      scanlines: typeof attachScanlines;
      crosshatch: typeof attachCrosshatch;
      diamonds: typeof attachDiamonds;
      'contour-echoes': typeof attachContourEchoes;
      engraving: typeof attachEngraving;
      'woven-mesh': typeof attachWovenMesh;
      hexagons: typeof attachHexagons;
      interference: typeof attachInterference;
      shards: typeof attachShards;
      circuits: typeof attachCircuits;
      'star-shimmer': typeof attachStarShimmer;
      'brush-fringe': typeof attachBrushFringe;
      slime: typeof attachSlime;
      'burned-paper': typeof attachBurnedPaper;
      gsap: typeof gsap;
      diagnostics: typeof startEffectDiagnostics;
      memory: typeof memoryFor;
      qualifyRawAlphaControls: typeof qualifyRawAlphaControls;
      qualifyRawEffectColors: typeof qualifyRawEffectColors;
    };
  }
}

window.controlEffects = {
  frost: attachFrost,
  fire: attachFire,
  electricity: attachElectricity,
  dither: attachDither,
  kinetic: attachKinetic,
  halftone: attachHalftone,
  stipple: attachStipple,
  scanlines: attachScanlines,
  crosshatch: attachCrosshatch,
  diamonds: attachDiamonds,
  'contour-echoes': attachContourEchoes,
  engraving: attachEngraving,
  'woven-mesh': attachWovenMesh,
  hexagons: attachHexagons,
  interference: attachInterference,
  shards: attachShards,
  circuits: attachCircuits,
  'star-shimmer': attachStarShimmer,
  'brush-fringe': attachBrushFringe,
  slime: attachSlime,
  'burned-paper': attachBurnedPaper,
  gsap,
  diagnostics: startEffectDiagnostics,
  memory: memoryFor,
  qualifyRawAlphaControls,
  qualifyRawEffectColors,
};
