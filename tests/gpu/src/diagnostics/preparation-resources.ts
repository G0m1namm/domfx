import { GpuExperiment } from '@domfx/browser/experimental';
import { classifyAlpha } from '@domfx/core';

import { signedDistanceOracle } from './distance-oracle.js';

/** Real GPU allocations observed at the device boundary, not total VRAM. */
export async function verifyPreparationResources() {
  const gpu = await GpuExperiment.create();
  const device = gpu.device;
  const buffers = new Map<GPUBuffer, number>();
  const createBuffer = device.createBuffer.bind(device);
  let createdBuffers = 0;
  let destroyedBuffers = 0;
  device.createBuffer = (descriptor) => {
    const buffer = createBuffer(descriptor);
    const destroy = buffer.destroy.bind(buffer);
    buffers.set(buffer, buffer.size);
    createdBuffers++;
    buffer.destroy = () => {
      if (buffers.delete(buffer)) {
        destroyedBuffers++;
      }
      destroy();
    };
    return buffer;
  };
  const bufferBytes = () => [...buffers.values()].reduce((sum, size) => sum + size, 0);
  const samples: Array<{ cycle: number; managedBytes: number; bufferBytes: number }> = [];
  let maxError = 0;
  let wrongSigns = 0;
  let peakManagedBytes = 0;
  let peakBufferBytes = 0;
  const cycles = 1000;
  try {
    for (let cycle = 1; cycle <= cycles; cycle++) {
      // Alternate odd dimensions and changing paint, including threshold alpha.
      const width = cycle % 2 ? 7 : 9;
      const height = 5;
      const pixels = new Uint8Array(width * height * 4);
      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          pixels[(y * width + x) * 4 + 3] = (x + y + cycle) % 3 ? 128 : 127;
        }
      }
      const raster = { width, height, pixels };
      const mask = classifyAlpha(raster);
      const truth = signedDistanceOracle(mask, width, height);
      const frame = await gpu.prepare(raster);
      try {
        peakManagedBytes = Math.max(peakManagedBytes, gpu.managedBytes);
        peakBufferBytes = Math.max(peakBufferBytes, bufferBytes());
        const values = await frame.readSdf();
        for (let i = 0; i < truth.length; i++) {
          const error = Math.abs(values[i] - truth[i]);
          if (!Number.isFinite(error)) {
            throw new Error(`nonfinite repeated preparation distance: cycle ${cycle}, pixel ${i}`);
          }
          maxError = Math.max(maxError, error);
          wrongSigns += Number(values[i] < 0 !== Boolean(mask[i]));
        }
      } finally {
        frame.destroy();
        frame.destroy();
      }
      if ([1, 10, 100, 1000].includes(cycle)) {
        samples.push({ cycle, managedBytes: gpu.managedBytes, bufferBytes: bufferBytes() });
      }
    }
    const afterCycles = { managedBytes: gpu.managedBytes, bufferBytes: bufferBytes() };
    // Keep two frames alive: disposing one must not invalidate the other's uniform/SDF.
    const raster = { width: 3, height: 3, pixels: new Uint8Array(36) };
    raster.pixels[19] = 255;
    // Fail after real submission to exercise cleanup of an allocated executor.
    const onSubmittedWorkDone = device.queue.onSubmittedWorkDone.bind(device.queue);
    let failureReason = '';
    device.queue.onSubmittedWorkDone = async () => {
      await onSubmittedWorkDone();
      throw new Error('injected-prepare-failure');
    };
    try {
      const unexpected = await gpu.prepare(raster);
      unexpected.destroy();
    } catch (error) {
      failureReason = error instanceof Error ? error.message : String(error);
    } finally {
      device.queue.onSubmittedWorkDone = onSubmittedWorkDone;
    }
    const failedPreparation = {
      reason: failureReason,
      managedBytes: gpu.managedBytes,
      bufferBytes: bufferBytes(),
    };
    const first = await gpu.prepare(raster);
    const second = await gpu.prepare(raster);
    first.destroy();
    const remainingSdf = await second.readSdf();
    const remainingTruth = signedDistanceOracle(classifyAlpha(raster), 3, 3);
    const remainingFrameCorrect = remainingSdf.every(
      (value, i) => Math.abs(value - remainingTruth[i]) <= 0.002,
    );
    second.render(1.5, 314, 0.85, 1);
    const remainingFireVisible = (await second.readFire()).some((value) => value > 0);
    gpu.destroy();
    gpu.destroy();
    first.destroy();
    second.destroy();
    const result = {
      cycles,
      dimensions: [
        [7, 5],
        [9, 5],
      ],
      maxError,
      wrongSigns,
      // These masks have nearest distances <= sqrt(5); Float16 error is below .002 px.
      tolerance: 0.002,
      peakManagedBytes,
      peakBufferBytes,
      samples,
      afterCycles,
      failedPreparation,
      remainingFrameCorrect,
      remainingFireVisible,
      afterServiceDestroy: { managedBytes: gpu.managedBytes, bufferBytes: bufferBytes() },
      createdBuffers,
      destroyedBuffers,
      gpuErrors: gpu.errors,
      adapter: {
        vendor: gpu.adapterInfo.vendor,
        architecture: gpu.adapterInfo.architecture,
        description: gpu.adapterInfo.description,
      },
      method:
        '1000 real preparations and oracle readbacks; managed texture/buffer ledger plus observed GPUBuffer create/destroy calls. Readback buffers are transient. Excludes driver caches, pipelines, canvas backing stores and total VRAM.',
    };
    return {
      ...result,
      pass:
        maxError <= result.tolerance &&
        wrongSigns === 0 &&
        afterCycles.managedBytes === 0 &&
        afterCycles.bufferBytes === 0 &&
        failedPreparation.reason === 'injected-prepare-failure' &&
        failedPreparation.managedBytes === 0 &&
        failedPreparation.bufferBytes === 0 &&
        remainingFrameCorrect &&
        remainingFireVisible &&
        samples.every((sample) => sample.managedBytes === 0 && sample.bufferBytes === 0) &&
        gpu.managedBytes === 0 &&
        buffers.size === 0 &&
        createdBuffers === destroyedBuffers &&
        gpu.errors.length === 0,
    };
  } finally {
    gpu.destroy();
    device.createBuffer = createBuffer;
  }
}
