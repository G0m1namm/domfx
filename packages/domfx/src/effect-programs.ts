import { relativeBurnedPaperShader } from './burned-paper-relative-shader.js';
import { burnedPaperShader } from './burned-paper-shader.js';
import { ditherShader } from './dither-shader.js';
import { EffectError } from './effect-error.js';
import { electricityShader } from './electricity-shader.js';
import { relativeFireShader } from './fire-relative-shader.js';
import { fireShader } from './fire-shader.js';
import { relativeFrostShader } from './frost-relative-shader.js';
import { frostShader } from './frost-shader.js';
import { kineticShader } from './kinetic-shader.js';
import type { PatternEffect } from './pattern-options.js';
import { createRelativePatternShader } from './pattern-relative-shader.js';
import { createPatternShader } from './pattern-shader.js';
import { relativeSlimeShader } from './slime-relative-shader.js';
import { slimeShader } from './slime-shader.js';

const patternEffects = [
  'halftone',
  'stipple',
  'scanlines',
  'crosshatch',
  'diamonds',
  'contour-echoes',
  'engraving',
  'woven-mesh',
  'hexagons',
  'interference',
  'shards',
  'circuits',
  'star-shimmer',
  'brush-fringe',
] as const satisfies readonly PatternEffect[];

export type RenderEffect =
  | 'fire'
  | 'electricity'
  | 'frost'
  | 'kinetic'
  | 'slime'
  | 'burned-paper'
  | 'dither'
  | PatternEffect;

/** Renderer-private owner of effect source, compilation and the compatible binding layout. */
export class EffectPrograms {
  private readonly pipelines = new Map<
    RenderEffect | `${RenderEffect}-relative`,
    GPURenderPipeline
  >();
  readonly bindings: GPUBindGroupLayout;

  private constructor(private readonly device: GPUDevice) {
    this.bindings = device.createBindGroupLayout({
      label: 'domfx effect bindings',
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.FRAGMENT,
          texture: { sampleType: 'unfilterable-float' },
        },
        // time, seed, intensity, pixels/unit: vec4f, offsets 0/4/8/12, size/alignment 16.
        {
          binding: 1,
          visibility: GPUShaderStage.FRAGMENT,
          buffer: { type: 'uniform', minBindingSize: 16 },
        },
        {
          binding: 2,
          visibility: GPUShaderStage.FRAGMENT,
          buffer: { type: 'uniform', minBindingSize: 32 },
        },
      ],
    });
  }

  static async create(device: GPUDevice): Promise<EffectPrograms> {
    const programs = new EffectPrograms(device);
    const sources: [RenderEffect | `${RenderEffect}-relative`, string][] = [
      ['fire', fireShader],
      ['fire-relative', relativeFireShader],
      ['electricity', electricityShader],
      ['frost', frostShader],
      ['frost-relative', relativeFrostShader],
      ['kinetic', kineticShader],
      ['slime', slimeShader],
      ['slime-relative', relativeSlimeShader],
      ['burned-paper', burnedPaperShader],
      ['burned-paper-relative', relativeBurnedPaperShader],
      ['dither', ditherShader],
      ['dither-relative', createRelativePatternShader('dither')],
      ...patternEffects.map((effect): [`${PatternEffect}-relative`, string] => [
        `${effect}-relative`,
        createRelativePatternShader(effect),
      ]),
      ...patternEffects.map((effect): [RenderEffect, string] => [
        effect,
        createPatternShader(effect),
      ]),
    ];
    const layout = device.createPipelineLayout({
      label: 'domfx effects',
      bindGroupLayouts: [programs.bindings],
    });
    // Eager preparation keeps compilation out of synchronous render/seek and effect switches.
    // Scope ownership is serial and ends before any target preparation can begin.
    device.pushErrorScope('validation');
    let failure: unknown;
    try {
      for (const [effect, code] of sources) {
        const module = device.createShaderModule({ label: `domfx ${effect}`, code });
        const info = await module.getCompilationInfo();
        const errors = info.messages.filter((message) => message.type === 'error');
        if (errors.length) {
          const detail = errors
            .slice(0, 8)
            .map(
              (message) =>
                `${message.lineNum}:${message.linePos} ${message.message.slice(0, 1000)}`,
            )
            .join('\n');
          throw new EffectError('renderer-failed', `${effect} WGSL\n${detail}`);
        }
        try {
          programs.pipelines.set(
            effect,
            device.createRenderPipeline({
              label: `domfx ${effect}`,
              layout,
              vertex: { module, entryPoint: 'vertex' },
              fragment: { module, entryPoint: 'fragment', targets: [{ format: 'rgba8unorm' }] },
              primitive: { topology: 'triangle-list' },
            }),
          );
        } catch (cause) {
          const detail = cause instanceof Error ? cause.message : String(cause);
          throw new EffectError(
            'renderer-failed',
            `${effect} pipeline failed: ${detail.slice(0, 1000)}`,
            cause,
          );
        }
      }
    } catch (error) {
      failure = error;
    }
    const validation = await device.popErrorScope();
    if (failure) {
      throw failure;
    }
    if (validation) {
      throw new EffectError('renderer-failed', validation.message, validation);
    }
    return programs;
  }

  bind(distances: GPUTexture, parameters: GPUBuffer, geometry: GPUBuffer): GPUBindGroup {
    return this.device.createBindGroup({
      label: 'domfx prepared effect',
      layout: this.bindings,
      entries: [
        { binding: 0, resource: distances.createView() },
        { binding: 1, resource: { buffer: parameters } },
        { binding: 2, resource: { buffer: geometry } },
      ],
    });
  }

  pipeline(effect: RenderEffect, relative = false): GPURenderPipeline {
    const pipeline = this.pipelines.get(relative ? `${effect}-relative` : effect);
    if (!pipeline) {
      throw new Error(`Unknown effect: ${effect}`);
    }
    return pipeline;
  }
}
