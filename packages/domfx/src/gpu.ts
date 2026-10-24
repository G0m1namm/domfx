import { createJumpFlood, type JumpFlood } from '@typegpu/sdf';
import { d, std, tgpu, type TgpuRoot } from 'typegpu';

import type { CaptureFrame } from '@domfx/core';

import { EffectError } from './effect-error.js';
import type { EffectGeometry } from './effect-geometry.js';
import { EffectPrograms, type RenderEffect } from './effect-programs.js';

export type { RenderEffect } from './effect-programs.js';

const sourceLayout = tgpu.bindGroupLayout({ source: { texture: d.texture2d() } });
const classifyMask = (coord: d.v2u) => {
  'use gpu';
  return std.textureLoad(sourceLayout.$.source, coord, 0).w >= 128 / 255;
};
const storeDistance = (_coord: d.v2u, _size: d.v2u, signedDistance: number) => {
  'use gpu';
  return signedDistance;
};
const copyNearestColor = (_coord: d.v2u, _size: d.v2u, _distance: number, insidePx: d.v2u) => {
  'use gpu';
  return std.textureLoad(sourceLayout.$.source, insidePx, 0);
};

export function decodeFloat16(bits: number): number {
  const sign = bits & 0x8000 ? -1 : 1;
  const exponent = (bits >>> 10) & 31;
  const fraction = bits & 1023;
  if (exponent === 31) {
    return fraction ? NaN : sign * Infinity;
  }
  return (
    sign * (exponent === 0 ? fraction * 2 ** -24 : (1 + fraction / 1024) * 2 ** (exponent - 15))
  );
}

export interface PreparedGpuFrame {
  readonly width: number;
  readonly height: number;
  readonly managedBytes: number;
  readonly prepareMs: number;
  readSdf(): Promise<Float32Array>;
  render(
    time: number,
    seed: number,
    intensity: number,
    pixelsPerCss: number,
    timestampWrites?: GPURenderPassTimestampWrites,
    flameHeight?: number,
    effect?: RenderEffect,
    geometry?: EffectGeometry,
    dripDensity?: number,
  ): void;
  present(destination: GPUTexture): void;
  readFire(): Promise<Uint8Array>;
  destroy(): void;
}

/** One experimental renderer service; caller owns it and shares it between targets.
 * No DOM Elements or layout reads cross this boundary.
 */
export class GpuExperiment {
  private readonly prepared = new Set<PreparedGpuFrame>();
  private readonly programs: EffectPrograms;
  private preparation: Promise<void> = Promise.resolve();
  private destroyed = false;
  readonly errors: string[] = [];
  private constructor(
    readonly root: TgpuRoot,
    readonly adapterInfo: GPUAdapterInfo,
    programs: EffectPrograms,
  ) {
    const device = root.device;
    device.addEventListener('uncapturederror', (event) => {
      this.errors.push(event.error.message.slice(0, 2000));
      if (this.errors.length > 32) {
        this.errors.shift();
      }
    });
    this.programs = programs;
  }

  static async create(
    gpu: GPU | null = navigator.gpu ?? null,
    measureTimestamps = false,
  ): Promise<GpuExperiment> {
    if (!gpu) {
      throw new EffectError('no-webgpu');
    }
    const adapter = await gpu.requestAdapter();
    if (!adapter) {
      throw new EffectError('no-adapter');
    }
    const device = await adapter.requestDevice({
      requiredFeatures:
        measureTimestamps && adapter.features.has('timestamp-query') ? ['timestamp-query'] : [],
    });
    let root: TgpuRoot | undefined;
    try {
      root = tgpu.initFromDevice({ device });
      const programs = await EffectPrograms.create(device);
      return new GpuExperiment(root, adapter.info, programs);
    } catch (error) {
      root?.destroy();
      device.destroy();
      throw error;
    }
  }

  get device(): GPUDevice {
    return this.root.device;
  }
  get managedBytes(): number {
    return [...this.prepared].reduce((sum, frame) => sum + frame.managedBytes, 0);
  }

  prepare(frame: Pick<CaptureFrame, 'width' | 'height' | 'pixels'>): Promise<PreparedGpuFrame> {
    // Validation scopes are device-wide stacks; budget checks must also include
    // the preceding preparation's allocations before admitting another frame.
    const pending = this.preparation.then(() => this.prepareFrame(frame));
    this.preparation = pending.then(
      () => {},
      () => {},
    );
    return pending;
  }

  private assertAvailable() {
    if (this.destroyed) {
      throw new Error('renderer-disposed');
    }
  }

  private async prepareFrame(
    frame: Pick<CaptureFrame, 'width' | 'height' | 'pixels'>,
  ): Promise<PreparedGpuFrame> {
    this.assertAvailable();
    const { width, height, pixels } = frame;
    if (
      !Number.isInteger(width) ||
      !Number.isInteger(height) ||
      width < 1 ||
      height < 1 ||
      pixels.length !== width * height * 4
    ) {
      throw new Error('invalid-frame');
    }
    if (
      width * height > 1_000_000 ||
      width > this.device.limits.maxTextureDimension2D ||
      height > this.device.limits.maxTextureDimension2D
    ) {
      throw new EffectError('capture-budget');
    }
    if (!pixels.some((value, i) => i % 4 === 3 && value >= 128)) {
      throw new EffectError('empty-mask');
    }
    if (!pixels.some((value, i) => i % 4 === 3 && value < 128)) {
      throw new EffectError('missing-exterior');
    }
    if (this.managedBytes + width * height * 36 + 52 > 144_000_000) {
      throw new EffectError('aggregate-budget');
    }

    const started = performance.now();
    const root = this.root;
    const device = this.device;
    const source = root
      .createTexture({ size: [width, height] as const, format: 'rgba8unorm' as const })
      .$usage('sampled');
    let runner: JumpFlood.Executor | undefined;
    let output: GPUTexture | undefined;
    let uniform: GPUBuffer | undefined;
    let geometryUniform: GPUBuffer | undefined;
    let scopeOpen = true;
    device.pushErrorScope('validation');
    try {
      device.queue.writeTexture(
        { texture: root.unwrap(source) },
        pixels,
        { bytesPerRow: width * 4 },
        { width, height },
      );
      runner = createJumpFlood({
        root,
        size: { width, height },
        classify: classifyMask,
        getSdf: storeDistance,
        getColor: copyNearestColor,
      }).with(root.createBindGroup(sourceLayout, { source: source.createView() }));
      await runner.initAsync();
      this.assertAvailable();
      runner.run();
      await device.queue.onSubmittedWorkDone();
      this.assertAvailable();
      const sdfTexture = root.unwrap(runner.sdfOutput);
      output = device.createTexture({
        label: 'domfx effect output',
        size: [width, height],
        format: 'rgba8unorm',
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
      });
      uniform = device.createBuffer({
        size: 16,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });
      geometryUniform = device.createBuffer({
        label: 'domfx target-local geometry',
        size: 32,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });
      const outputTexture = output;
      const parameters = uniform;
      const geometricParameters = geometryUniform;
      const bindings = this.programs.bind(sdfTexture, parameters, geometricParameters);
      let disposed = false;
      const prepared: PreparedGpuFrame = {
        width,
        height,
        // Textures + legacy vec4f (16), geometry (32), patched JFA i32 (4).
        managedBytes: width * height * 36 + 52,
        prepareMs: performance.now() - started,
        readSdf: async () => {
          const bytes = await this.readTexture(sdfTexture, width, height, 8);
          const view = new DataView(bytes.buffer);
          return Float32Array.from({ length: width * height }, (_, i) =>
            decodeFloat16(view.getUint16(i * 8, true)),
          );
        },
        render: (
          time,
          seed,
          intensity,
          pixelsPerCss,
          timestampWrites,
          flameHeight = 24,
          effect = 'fire',
          geometry,
          dripDensity = 0.56,
        ) => {
          if (disposed) {
            throw new Error('frame-disposed');
          }
          if (
            ![time, seed, intensity, pixelsPerCss, flameHeight, dripDensity].every(
              Number.isFinite,
            ) ||
            pixelsPerCss <= 0 ||
            flameHeight < 8 ||
            flameHeight > 64 ||
            dripDensity < 0 ||
            dripDensity > 1
          ) {
            throw new Error('invalid-parameters');
          }
          if (geometry) {
            const { a, d, e, f } = geometry.pixelToLocal;
            const values = [
              a,
              d,
              e,
              f,
              geometry.directionalReach,
              geometry.inwardDepth,
              dripDensity,
              0,
            ];
            if (
              values.some((value) => !Number.isFinite(Math.fround(value))) ||
              a <= 0 ||
              d <= 0 ||
              geometry.directionalReach < 0 ||
              geometry.inwardDepth < 0
            ) {
              throw new Error('invalid-geometry');
            }
            device.queue.writeBuffer(geometricParameters, 0, new Float32Array(values));
          } else if (effect === 'slime') {
            device.queue.writeBuffer(geometricParameters, 24, new Float32Array([dripDensity]));
          }
          device.queue.writeBuffer(
            parameters,
            0,
            // Scale flame coordinates without adding uniforms or changing SDF raster units.
            new Float32Array([
              time,
              seed,
              Math.max(0, Math.min(1, intensity)),
              (pixelsPerCss * flameHeight) / 24,
            ]),
          );
          const encoder = device.createCommandEncoder();
          const pass = encoder.beginRenderPass({
            timestampWrites,
            colorAttachments: [
              {
                view: outputTexture.createView(),
                clearValue: [0, 0, 0, 0],
                loadOp: 'clear',
                storeOp: 'store',
              },
            ],
          });
          pass.setPipeline(this.programs.pipeline(effect, geometry !== undefined));
          pass.setBindGroup(0, bindings);
          pass.draw(3);
          pass.end();
          device.queue.submit([encoder.finish()]);
        },
        present: (destination) => {
          if (disposed) {
            throw new Error('frame-disposed');
          }
          const encoder = device.createCommandEncoder();
          encoder.copyTextureToTexture(
            { texture: outputTexture },
            { texture: destination },
            { width, height },
          );
          device.queue.submit([encoder.finish()]);
        },
        readFire: () => this.readTexture(outputTexture, width, height, 4),
        destroy: () => {
          if (disposed) {
            return;
          }
          disposed = true;
          runner!.destroy();
          source.destroy();
          outputTexture.destroy();
          parameters.destroy();
          geometricParameters.destroy();
          this.prepared.delete(prepared);
        },
      };
      const error = await device.popErrorScope();
      scopeOpen = false;
      this.assertAvailable();
      if (error) {
        throw new EffectError('renderer-failed', error.message, error);
      }
      this.prepared.add(prepared);
      return prepared;
    } catch (error) {
      runner?.destroy();
      source.destroy();
      output?.destroy();
      uniform?.destroy();
      geometryUniform?.destroy();
      if (scopeOpen) {
        await device.popErrorScope();
      }
      throw error;
    }
  }

  private async readTexture(
    texture: GPUTexture,
    width: number,
    height: number,
    bytesPerPixel: number,
  ): Promise<Uint8Array> {
    const stride = Math.ceil((width * bytesPerPixel) / 256) * 256;
    const buffer = this.device.createBuffer({
      size: stride * height,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });
    try {
      const encoder = this.device.createCommandEncoder();
      encoder.copyTextureToBuffer({ texture }, { buffer, bytesPerRow: stride }, { width, height });
      this.device.queue.submit([encoder.finish()]);
      await buffer.mapAsync(GPUMapMode.READ);
      const mapped = new Uint8Array(buffer.getMappedRange());
      const packed = new Uint8Array(width * height * bytesPerPixel);
      for (let row = 0; row < height; row += 1) {
        packed.set(
          mapped.subarray(row * stride, row * stride + width * bytesPerPixel),
          row * width * bytesPerPixel,
        );
      }
      buffer.unmap();
      return packed;
    } finally {
      buffer.destroy();
    }
  }

  destroy(): void {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    for (const frame of this.prepared) {
      frame.destroy();
    }
    this.root.destroy();
    this.device.destroy();
  }
}
