import { gsap } from 'gsap';

import {
  attachBurnedPaper,
  attachFire,
  attachFrost,
  attachHalftone,
  attachSlime,
} from '@domfx/browser';
import { memoryFor, startEffectDiagnostics } from '@domfx/browser/experimental';

declare global {
  interface Window {
    controlEffects: {
      frost: typeof attachFrost;
      fire: typeof attachFire;
      halftone: typeof attachHalftone;
      slime: typeof attachSlime;
      'burned-paper': typeof attachBurnedPaper;
      gsap: typeof gsap;
      diagnostics: typeof startEffectDiagnostics;
      memory: typeof memoryFor;
    };
  }
}

window.controlEffects = {
  frost: attachFrost,
  fire: attachFire,
  halftone: attachHalftone,
  slime: attachSlime,
  'burned-paper': attachBurnedPaper,
  gsap,
  diagnostics: startEffectDiagnostics,
  memory: memoryFor,
};
