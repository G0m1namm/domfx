import { gsap } from 'gsap';

import {
  attachBurnedPaper,
  attachElectricity,
  attachFire,
  attachFrost,
  attachHalftone,
  attachSlime,
} from '@domfx/browser';
import { memoryFor, startEffectDiagnostics } from '@domfx/browser/experimental';

import { qualifyRawAlphaControls } from './controls-raw-alpha.js';

declare global {
  interface Window {
    controlEffects: {
      frost: typeof attachFrost;
      fire: typeof attachFire;
      electricity: typeof attachElectricity;
      halftone: typeof attachHalftone;
      slime: typeof attachSlime;
      'burned-paper': typeof attachBurnedPaper;
      gsap: typeof gsap;
      diagnostics: typeof startEffectDiagnostics;
      memory: typeof memoryFor;
      qualifyRawAlphaControls: typeof qualifyRawAlphaControls;
    };
  }
}

window.controlEffects = {
  frost: attachFrost,
  fire: attachFire,
  electricity: attachElectricity,
  halftone: attachHalftone,
  slime: attachSlime,
  'burned-paper': attachBurnedPaper,
  gsap,
  diagnostics: startEffectDiagnostics,
  memory: memoryFor,
  qualifyRawAlphaControls,
};
