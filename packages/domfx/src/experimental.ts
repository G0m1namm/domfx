/** `@domfx/browser/experimental` is unstable and can change in any release. */
export { captureElement } from './browser.js';
export type { CaptureFrame } from './capture-frame.js';
export { GpuExperiment, decodeFloat16, type PreparedGpuFrame } from './gpu.js';
export {
  attachBurnedPaperWithAdapters,
  attachDitherWithAdapters,
  attachPatternWithAdapters,
  attachElectricityWithAdapters,
  attachFireWithAdapters,
  attachFrostWithAdapters,
  attachKineticWithAdapters,
  attachSlimeWithAdapters,
  type AttachmentAdapters,
} from './attachment.js';
export { AllocationLedger, estimateFrameMemory, memoryFor } from './memory.js';
export { startEffectDiagnostics, type EffectDiagnostic } from './diagnostics.js';
