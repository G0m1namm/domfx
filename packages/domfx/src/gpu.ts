import { createJumpFlood, type JumpFlood } from '@typegpu/sdf';
import { d, std, tgpu, type TgpuRoot } from 'typegpu';

import type { CaptureFrame } from '@domfx/core';

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

const fireShader = `
@group(0) @binding(0) var distances: texture_2d<f32>;
@group(0) @binding(1) var<uniform> params: vec4f;
@vertex fn vertex(@builtin(vertex_index) index: u32) -> @builtin(position) vec4f {
  let positions = array<vec2f, 3>(vec2f(-1, -1), vec2f(3, -1), vec2f(-1, 3));
  return vec4f(positions[index], 0, 1);
}
fn field(p: vec2f) -> f32 {
  let size = vec2i(textureDimensions(distances));
  return textureLoad(distances, clamp(vec2i(p), vec2i(0), size - 1), 0).r / params.w;
}
@fragment fn fragment(@builtin(position) pos: vec4f) -> @location(0) vec4f {
  let p = pos.xy / params.w;
  let time = params.x;
  let seed = params.y;
  let intensity = params.z;
  let noise = .5 + .25 * sin(p.x * .27 + p.y * .11 + time * 4 + seed)
                  + .25 * sin(p.x * .51 - p.y * .17 - time * 3 + seed * 2);
  let lift = (2 + 10 * noise) * intensity;
  let shifted = pos.xy + vec2f(sin(p.y * .14 + time * 3 + seed) * 2, lift) * params.w;
  let distance = field(pos.xy);
  let stretched = field(shifted);
  let rim = exp(-abs(distance) * .9);
  let flame = (1 - smoothstep(-1, 4, stretched)) * smoothstep(-2, 1, distance);
  let alpha = clamp((rim * .9 + flame * (.2 + noise * .8)) * intensity, 0, .95);
  let heat = clamp(rim + noise * .4, 0, 1);
  let color = mix(vec3f(1, .12, .015), vec3f(1, .92, .4), heat);
  return vec4f(color * alpha, alpha);
}`;

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
  private readonly pipeline: GPURenderPipeline;
  private preparation: Promise<void> = Promise.resolve();
  private destroyed = false;
  readonly errors: string[] = [];
  private constructor(
    readonly root: TgpuRoot,
    readonly adapterInfo: GPUAdapterInfo,
  ) {
    const device = root.device;
    device.addEventListener('uncapturederror', (event) => this.errors.push(event.error.message));
    const module = device.createShaderModule({
      label: 'domfx deterministic fire',
      code: fireShader,
    });
    this.pipeline = device.createRenderPipeline({
      label: 'domfx fire',
      layout: 'auto',
      vertex: { module, entryPoint: 'vertex' },
      fragment: { module, entryPoint: 'fragment', targets: [{ format: 'rgba8unorm' }] },
      primitive: { topology: 'triangle-list' },
    });
  }

  static async create(
    gpu: GPU | null = navigator.gpu ?? null,
    measureTimestamps = false,
  ): Promise<GpuExperiment> {
    if (!gpu) {
      throw new Error('no-webgpu');
    }
    const adapter = await gpu.requestAdapter();
    if (!adapter) {
      throw new Error('no-adapter');
    }
    const device = await adapter.requestDevice({
      requiredFeatures:
        measureTimestamps && adapter.features.has('timestamp-query') ? ['timestamp-query'] : [],
    });
    let root: TgpuRoot | undefined;
    try {
      root = tgpu.initFromDevice({ device });
      return new GpuExperiment(root, adapter.info);
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
      throw new Error('capture-budget');
    }
    if (!pixels.some((value, i) => i % 4 === 3 && value >= 128)) {
      throw new Error('empty-mask');
    }
    if (!pixels.some((value, i) => i % 4 === 3 && value < 128)) {
      throw new Error('missing-exterior');
    }
    if (this.managedBytes + width * height * 36 + 20 > 144_000_000) {
      throw new Error('aggregate-budget');
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
        label: 'domfx fire output',
        size: [width, height],
        format: 'rgba8unorm',
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
      });
      uniform = device.createBuffer({
        size: 16,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });
      const bindGroup = device.createBindGroup({
        layout: this.pipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: sdfTexture.createView() },
          { binding: 1, resource: { buffer: uniform } },
        ],
      });
      const outputTexture = output;
      const parameters = uniform;
      let disposed = false;
      const prepared: PreparedGpuFrame = {
        width,
        height,
        // Source/JFA/fire textures + fire vec4f (16) and patched JFA i32 (4).
        managedBytes: width * height * 36 + 20,
        prepareMs: performance.now() - started,
        readSdf: async () => {
          const bytes = await this.readTexture(sdfTexture, width, height, 8);
          const view = new DataView(bytes.buffer);
          return Float32Array.from({ length: width * height }, (_, i) =>
            decodeFloat16(view.getUint16(i * 8, true)),
          );
        },
        render: (time, seed, intensity, pixelsPerCss, timestampWrites) => {
          if (disposed) {
            throw new Error('frame-disposed');
          }
          if (![time, seed, intensity, pixelsPerCss].every(Number.isFinite) || pixelsPerCss <= 0) {
            throw new Error('invalid-parameters');
          }
          device.queue.writeBuffer(
            parameters,
            0,
            new Float32Array([time, seed, Math.max(0, Math.min(1, intensity)), pixelsPerCss]),
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
          pass.setPipeline(this.pipeline);
          pass.setBindGroup(0, bindGroup);
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
          this.prepared.delete(prepared);
        },
      };
      const error = await device.popErrorScope();
      scopeOpen = false;
      this.assertAvailable();
      if (error) {
        throw new Error(error.message);
      }
      this.prepared.add(prepared);
      return prepared;
    } catch (error) {
      runner?.destroy();
      source.destroy();
      output?.destroy();
      uniform?.destroy();
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
