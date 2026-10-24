import type { CaptureFrame } from '@domfx/core';

import { EffectError } from './effect-error.js';
import type { EffectGeometry } from './effect-geometry.js';

/** Private paired material fractions; absent partner is zero after opting in. */
export interface MaterialExtent {
  readonly depth: number;
  readonly reach: number;
}

export function materialExtentOptions(
  depth: number | undefined,
  reach: number | undefined,
  effect: string,
): MaterialExtent | undefined {
  if (depth === undefined && reach === undefined) {
    return undefined;
  }
  const values = [depth === undefined ? 0 : depth, reach === undefined ? 0 : reach];
  if (values.some((value) => typeof value !== 'number' || !Number.isFinite(value) || value < 0)) {
    throw new Error(`invalid-${effect}-parameter`);
  }
  return { depth: depth ?? 0, reach: reach ?? 0 };
}

export function materialLengths(width: number, height: number, extent: MaterialExtent) {
  const inwardDepth = Math.min(width, height) * extent.depth;
  const directionalReach = height * extent.reach;
  if (
    ![inwardDepth, directionalReach].every(
      (value) => Number.isFinite(value) && Number.isFinite(Math.fround(value)),
    )
  ) {
    throw new EffectError('capture-budget');
  }
  return { inwardDepth, directionalReach };
}

/** Complete conservative support: fixed material lip <=6 CSS px; moving marks
 * and smooth joins <=8 CSS px beyond their configured center travel. Inward
 * depth needs no exterior padding. Neither footprint grows with intensity.
 */
export function materialSupport(reach: number, depth: number): number {
  return Math.max(depth > 0 ? 6 : 0, reach > 0 ? reach + 8 : 0);
}

export function materialPadding(
  width: number,
  height: number,
  dpr: number,
  extent: MaterialExtent,
): number {
  const { directionalReach, inwardDepth } = materialLengths(width, height, extent);
  return Math.max(8, Math.ceil(materialSupport(directionalReach, inwardDepth) + 4 + 2 / dpr));
}

export function materialGeometry(frame: CaptureFrame, extent: MaterialExtent): EffectGeometry {
  return {
    pixelToLocal: frame.pixelToLocal,
    ...materialLengths(frame.contentBounds.width, frame.contentBounds.height, extent),
  };
}

/** Exact raster mapping with conservative local distance and analytic bilinear
 * CSS gradients. Four reads; no DOM/layout values enter the GPU boundary.
 */
export const localMaterialField = `
fn field(p: vec2f) -> vec3f {
  let raster = (p - geometry.map.zw) / geometry.map.xy;
  let size = vec2i(textureDimensions(distances));
  let q = raster - .5;
  let base = vec2i(floor(q));
  // Same 1/256-raster phase stabilization as the shared scalar field.
  let blend = round(fract(q) * 256) / 256;
  let a = textureLoad(distances, clamp(base, vec2i(0), size - 1), 0).r;
  let b = textureLoad(distances, clamp(base + vec2i(1, 0), vec2i(0), size - 1), 0).r;
  let c = textureLoad(distances, clamp(base + vec2i(0, 1), vec2i(0), size - 1), 0).r;
  let d = textureLoad(distances, clamp(base + vec2i(1, 1), vec2i(0), size - 1), 0).r;
  let scale = min(geometry.map.x, geometry.map.y);
  return vec3f(mix(mix(a,b,blend.x),mix(c,d,blend.x),blend.y) * scale,
               vec2f(mix(b-a,d-c,blend.y),mix(c-a,d-b,blend.x)) * scale / geometry.map.xy);
}
`;
