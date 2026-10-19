import { createJumpFlood, type JumpFlood } from '@typegpu/sdf';
import { d, std, tgpu, type TgpuRoot } from 'typegpu';

import type { CaptureFrame } from '@domfx/core';

import { burnedPaperShader } from './burned-paper-shader.js';
import { ditherShader } from './dither-shader.js';
import { EffectError } from './effect-error.js';
import { electricityShader } from './electricity-shader.js';
import { frostShader } from './frost-shader.js';
import { kineticShader } from './kinetic-shader.js';
import type { PatternEffect } from './pattern-options.js';
import { createPatternShader } from './pattern-shader.js';
import { slimeShader } from './slime-shader.js';

export type RenderEffect =
  | 'fire'
  | 'electricity'
  | 'frost'
  | 'kinetic'
  | 'slime'
  | 'burned-paper'
  | 'dither'
  | PatternEffect;

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
// time, seed, intensity, raster pixels per flame unit (24 units = flameHeight CSS px).
@group(0) @binding(1) var<uniform> params: vec4f;
@vertex fn vertex(@builtin(vertex_index) index: u32) -> @builtin(position) vec4f {
  let positions = array<vec2f, 3>(vec2f(-1, -1), vec2f(3, -1), vec2f(-1, 3));
  return vec4f(positions[index], 0, 1);
}
fn field(p: vec2f) -> f32 {
  let size = vec2i(textureDimensions(distances));
  let q = p - .5;
  let base = vec2i(floor(q));
  let blend = fract(q);
  let a = textureLoad(distances, clamp(base, vec2i(0), size - 1), 0).r;
  let b = textureLoad(distances, clamp(base + vec2i(1, 0), vec2i(0), size - 1), 0).r;
  let c = textureLoad(distances, clamp(base + vec2i(0, 1), vec2i(0), size - 1), 0).r;
  let e = textureLoad(distances, clamp(base + vec2i(1, 1), vec2i(0), size - 1), 0).r;
  return mix(mix(a, b, blend.x), mix(c, e, blend.x), blend.y) / params.w;
}
fn hash(p: vec2f) -> f32 {
  var q = fract(vec3f(p.x, p.y, p.x) * vec3f(.1031, .1030, .0973));
  q += dot(q, q.yzx + 19.19);
  return fract((q.x + q.y) * q.z);
}
fn gradient(p: vec2f) -> vec2f {
  let direction = u32(hash(p) * 8);
  var g = vec2f(1, .5);
  if ((direction & 1u) != 0u) { g = g.yx; }
  g *= vec2f(select(1.0, -1.0, (direction & 2u) != 0u),
             select(1.0, -1.0, (direction & 4u) != 0u));
  return g * .8944272;
}
fn noise(p: vec2f) -> f32 {
  let cell = floor(p);
  let f = fract(p);
  let u = f * f * f * (f * (f * 6 - 15) + 10);
  let a = dot(gradient(cell), f);
  let b = dot(gradient(cell + vec2f(1, 0)), f - vec2f(1, 0));
  let c = dot(gradient(cell + vec2f(0, 1)), f - vec2f(0, 1));
  let e = dot(gradient(cell + vec2f(1, 1)), f - vec2f(1, 1));
  return .5 + mix(mix(a, b, u.x), mix(c, e, u.x), u.y) * .8;
}
fn rootHeight(p: vec2f, bend: f32) -> f32 {
  var height = 0.0;
  // Trace down to an actual emitter instead of drawing a displaced copy of the shape.
  for (var step = 0; step < 7; step++) {
    let sample = p + vec2f(bend * height / 28, height) * params.w;
    let distance = field(sample);
    if (distance <= .75) { return height; }
    height += max(distance, .75);
    if (height > 28) { return -1; }
  }
  return -1;
}
@fragment fn fragment(@builtin(position) pos: vec4f) -> @location(0) vec4f {
  let p = pos.xy / params.w;
  let time = params.x;
  let seed = params.y;
  let intensity = params.z;
  let distance = textureLoad(distances, vec2i(pos.xy), 0).r / params.w;
  if (intensity == 0 || distance <= -3 || distance > 30) { return vec4f(0); }
  // Upward advection and nested noise give the wisps a soft, curling interior.
  var flow = p * vec2f(.18, .025) + vec2f(sin(seed) * 17, cos(seed) * 23 + time * .8);
  let warp = noise(flow * .6 + vec2f(3.7, time * .2));
  flow.x += (warp - .5) * 1.6;
  let turbulence = noise(flow) * .5
                 + noise(flow * 2.03 + vec2f(8.3, time * .3)) * .25
                 + noise(flow * 4.07 + vec2f(2.8, time * .6)) * .15
                 + noise(flow * 8.13) * .1;
  let height = rootHeight(pos.xy, (warp - .5) * 7 * intensity);
  let reach = 28 * intensity;
  var density = -1.0;
  let rise = clamp(height / reach, 0, 1);
  if (height >= 0) { density = turbulence * 1.4 - .1 - rise * .8; }
  let body = smoothstep(0, .5, density) * pow(1 - rise, .55);
  let rim = exp(-abs(distance) * 1.6) * .28;
  let glow = exp(-abs(distance) * .45) * .07;
  let exterior = smoothstep(-.75, .75, distance);
  let alpha = clamp((rim + glow + body * exterior * .94) * sqrt(intensity), 0, .95)
              * smoothstep(-3, -.5, distance);
  let heat = clamp(exp(-max(height, 0) * .24) * .85 + max(density, 0) * .25, 0, 1);
  let orange = mix(vec3f(1, .09, .005), vec3f(1, .55, .025), smoothstep(.1, .65, heat));
  let color = mix(orange, vec3f(1, .96, .64), smoothstep(.65, 1, heat));

  // Each column emits occasional embers from an upward-facing silhouette edge.
  // Absolute-time lifetimes preserve seeking, reverse playback and seed determinism.
  var ember = 0.0;
  let column = floor(p.x / 12);
  for (var neighbor = -1; neighbor <= 1; neighbor++) {
    let id = column + f32(neighbor);
    let random = hash(vec2f(id, seed + 53));
    if (random > intensity * .6) { continue; }
    let age = fract(time * .65 + hash(vec2f(id + 17, seed)));
    let emitterX = (id + hash(vec2f(id, seed + 9))) * 12;
    let drift = sin(age * 5 + random * 6) * age * 2;
    let dx = p.x - emitterX - drift;
    if (abs(dx) > 2) { continue; }
    let source = vec2f(emitterX, p.y + age * 28) * params.w;
    let dy = field(source);
    let facing = field(source - vec2f(0, params.w)) - field(source + vec2f(0, params.w));
    let radius = .35 + random * .4;
    let spark = exp(-dx * dx / (radius * radius) - dy * dy / .7);
    ember = max(ember, spark * smoothstep(.5, 1.5, facing)
                * smoothstep(0, .12, age) * (1 - smoothstep(.65, 1, age)));
  }
  ember *= exterior * intensity;
  let emberAlpha = min(ember, .9);
  return vec4f(vec3f(1, .78, .28) * emberAlpha + color * alpha * (1 - emberAlpha),
               emberAlpha + alpha * (1 - emberAlpha));
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
    flameHeight?: number,
    effect?: RenderEffect,
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
  private readonly pipelines: Record<RenderEffect, GPURenderPipeline>;
  private preparation: Promise<void> = Promise.resolve();
  private destroyed = false;
  readonly errors: string[] = [];
  private constructor(
    readonly root: TgpuRoot,
    readonly adapterInfo: GPUAdapterInfo,
  ) {
    const device = root.device;
    device.addEventListener('uncapturederror', (event) => this.errors.push(event.error.message));
    const fireModule = device.createShaderModule({
      label: 'domfx deterministic fire',
      code: fireShader,
    });
    const electricityModule = device.createShaderModule({
      label: 'domfx deterministic electricity',
      code: electricityShader,
    });
    const frostModule = device.createShaderModule({
      label: 'domfx deterministic frost',
      code: frostShader,
    });
    const kineticModule = device.createShaderModule({
      label: 'domfx deterministic kinetic bloom',
      code: kineticShader,
    });
    const slimeModule = device.createShaderModule({
      label: 'domfx deterministic slime drips',
      code: slimeShader,
    });
    const burnedPaperModule = device.createShaderModule({
      label: 'domfx deterministic burned paper',
      code: burnedPaperShader,
    });
    const ditherModule = device.createShaderModule({
      label: 'domfx deterministic dither',
      code: ditherShader,
    });
    const pipeline = (name: RenderEffect, module: GPUShaderModule) =>
      device.createRenderPipeline({
        label: `domfx ${name}`,
        layout: 'auto',
        vertex: { module, entryPoint: 'vertex' },
        fragment: {
          module,
          entryPoint: 'fragment',
          targets: [{ format: 'rgba8unorm' }],
        },
        primitive: { topology: 'triangle-list' },
      });
    const patternPipeline = (effect: PatternEffect) =>
      pipeline(
        effect,
        device.createShaderModule({
          label: `domfx ${effect} exploration`,
          code: createPatternShader(effect),
        }),
      );
    this.pipelines = {
      fire: pipeline('fire', fireModule),
      electricity: pipeline('electricity', electricityModule),
      frost: pipeline('frost', frostModule),
      kinetic: pipeline('kinetic', kineticModule),
      slime: pipeline('slime', slimeModule),
      'burned-paper': pipeline('burned-paper', burnedPaperModule),
      dither: pipeline('dither', ditherModule),
      halftone: patternPipeline('halftone'),
      stipple: patternPipeline('stipple'),
      scanlines: patternPipeline('scanlines'),
      crosshatch: patternPipeline('crosshatch'),
      diamonds: patternPipeline('diamonds'),
      'contour-echoes': patternPipeline('contour-echoes'),
      engraving: patternPipeline('engraving'),
      'woven-mesh': patternPipeline('woven-mesh'),
      hexagons: patternPipeline('hexagons'),
      interference: patternPipeline('interference'),
      shards: patternPipeline('shards'),
      circuits: patternPipeline('circuits'),
      'star-shimmer': patternPipeline('star-shimmer'),
      'brush-fringe': patternPipeline('brush-fringe'),
    };
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
      throw new EffectError('capture-budget');
    }
    if (!pixels.some((value, i) => i % 4 === 3 && value >= 128)) {
      throw new EffectError('empty-mask');
    }
    if (!pixels.some((value, i) => i % 4 === 3 && value < 128)) {
      throw new EffectError('missing-exterior');
    }
    if (this.managedBytes + width * height * 36 + 20 > 144_000_000) {
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
      const outputTexture = output;
      const parameters = uniform;
      const bindGroupFor = (effect: RenderEffect) =>
        device.createBindGroup({
          layout: this.pipelines[effect].getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: sdfTexture.createView() },
            { binding: 1, resource: { buffer: parameters } },
          ],
        });
      const bindGroups = {
        fire: bindGroupFor('fire'),
        electricity: bindGroupFor('electricity'),
        frost: bindGroupFor('frost'),
        kinetic: bindGroupFor('kinetic'),
        slime: bindGroupFor('slime'),
        'burned-paper': bindGroupFor('burned-paper'),
        dither: bindGroupFor('dither'),
        halftone: bindGroupFor('halftone'),
        stipple: bindGroupFor('stipple'),
        scanlines: bindGroupFor('scanlines'),
        crosshatch: bindGroupFor('crosshatch'),
        diamonds: bindGroupFor('diamonds'),
        'contour-echoes': bindGroupFor('contour-echoes'),
        engraving: bindGroupFor('engraving'),
        'woven-mesh': bindGroupFor('woven-mesh'),
        hexagons: bindGroupFor('hexagons'),
        interference: bindGroupFor('interference'),
        shards: bindGroupFor('shards'),
        circuits: bindGroupFor('circuits'),
        'star-shimmer': bindGroupFor('star-shimmer'),
        'brush-fringe': bindGroupFor('brush-fringe'),
      };
      let disposed = false;
      const prepared: PreparedGpuFrame = {
        width,
        height,
        // Source/JFA/effect textures + one vec4f (16) and patched JFA i32 (4).
        managedBytes: width * height * 36 + 20,
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
        ) => {
          if (disposed) {
            throw new Error('frame-disposed');
          }
          if (
            ![time, seed, intensity, pixelsPerCss, flameHeight].every(Number.isFinite) ||
            pixelsPerCss <= 0 ||
            flameHeight < 8 ||
            flameHeight > 64
          ) {
            throw new Error('invalid-parameters');
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
          pass.setPipeline(this.pipelines[effect]);
          pass.setBindGroup(0, bindGroups[effect]);
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
        throw new EffectError('renderer-failed', error.message, error);
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
