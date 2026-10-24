import { attachElectricity, attachKinetic, type EffectHandle } from '@domfx/browser';

import { verifyEnergyExtentGeometry, verifyEnergyExtentLifecycle } from './energy-extent-checks.js';

declare global {
  interface Window {
    energy: {
      dprEffect?: EffectHandle;
      attachElectricity: typeof attachElectricity;
      attachKinetic: typeof attachKinetic;
      verifyGeometry: typeof verifyEnergyExtentGeometry;
      verifyLifecycle: typeof verifyEnergyExtentLifecycle;
    };
  }
}
window.energy = {
  attachElectricity,
  attachKinetic,
  verifyGeometry: verifyEnergyExtentGeometry,
  verifyLifecycle: verifyEnergyExtentLifecycle,
};
