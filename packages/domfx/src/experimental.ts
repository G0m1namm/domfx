/** Private-workspace spike access for the lab; not a stable public API. */
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
