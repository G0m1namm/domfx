import { gsap } from 'gsap';

import {
  attachBurnedPaper,
  attachFire,
  attachFrost,
  attachHalftone,
  attachSlime,
} from '@domfx/browser';

declare global {
  interface Window {
    controlEffects: {
      frost: typeof attachFrost;
      fire: typeof attachFire;
      halftone: typeof attachHalftone;
      slime: typeof attachSlime;
      'burned-paper': typeof attachBurnedPaper;
      gsap: typeof gsap;
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
};
