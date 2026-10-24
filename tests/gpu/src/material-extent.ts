import { attachFrost, attachSlime, attachBurnedPaper } from '@domfx/browser';
import { GpuExperiment } from '@domfx/browser/experimental';

declare global {
  interface Window {
    materials: {
      frost: typeof attachFrost;
      slime: typeof attachSlime;
      'burned-paper': typeof attachBurnedPaper;
      renderer: typeof GpuExperiment;
    };
  }
}
window.materials = {
  frost: attachFrost,
  slime: attachSlime,
  'burned-paper': attachBurnedPaper,
  renderer: GpuExperiment,
};
