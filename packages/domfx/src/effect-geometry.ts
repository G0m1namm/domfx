import type { CaptureFrame } from '@domfx/core';

import { EffectError } from './effect-error.js';

/** Renderer-private CSS geometry. Raster centers map to untransformed target-local
 * coordinates via (x*a+e, y*d+f); padding never enters procedural coordinates.
 * Directional reach and inward depth resolve independently, before rendering.
 */
export interface EffectGeometry {
  readonly pixelToLocal: CaptureFrame['pixelToLocal'];
  readonly directionalReach: number;
  readonly inwardDepth: number;
}

export function fireReachPadding(height: number, fraction: number, dpr: number): number {
  const reach = height * fraction;
  if (!Number.isFinite(reach) || !Number.isFinite(Math.fround(reach))) {
    throw new EffectError('capture-budget');
  }
  // Two CSS px of supported paint overflow, plus 2 CSS px + 2 raster px:
  // bilinear footprint, pixel-center classification and half-float SDF rounding.
  return Math.max(8, Math.ceil(reach + 4 + 2 / dpr));
}

/** Relative mode supports paint within two CSS px of the target border box.
 * Check every nontransparent sample, not merely the existence of exterior pixels.
 */
export function assertFirePaintMargin(frame: CaptureFrame, reach: number, effect = 'Fire'): void {
  const { a, d, e, f } = frame.pixelToLocal;
  const guard = 2 + 2 * Math.max(a, d);
  const { x, y, width, height } = frame.contentBounds;
  for (let row = 0; row < frame.height; row++) {
    for (let column = 0; column < frame.width; column++) {
      if (frame.pixels[(row * frame.width + column) * 4 + 3] === 0) {
        continue;
      }
      const localX = (column + 0.5) * a + e;
      const localY = (row + 0.5) * d + f;
      if (
        localX < x - 2 ||
        localX > x + width + 2 ||
        localY < y - 2 ||
        localY > y + height + 2 ||
        (column + 0.5) * a < reach + guard ||
        (frame.width - column - 0.5) * a < reach + guard ||
        (row + 0.5) * d < reach + guard ||
        (frame.height - row - 0.5) * d < reach + guard
      ) {
        throw new EffectError(
          'missing-exterior',
          `Relative ${effect} requires paint within the target border box plus 2 CSS px and its full reserved margin.`,
        );
      }
    }
  }
}

/** Binding 2: two vec4f, offsets 0/16, alignment 16, size/binding size 32.
 * map=(a,d,e,f); extent=(directionalReach,inwardDepth,0,0), lengths in CSS px.
 * Kept separate from legacy binding 1 (time, seed, intensity, artistic scale).
 */
export const effectGeometryBindings = `
struct EffectGeometry {
  map: vec4f,
  extent: vec4f,
}
@group(0) @binding(2) var<uniform> geometry: EffectGeometry;
`;

/** Bilinear SDF sampling in local CSS coordinates using the exact raster mapping. */
export const localDistanceField = `
fn field(p: vec2f) -> f32 {
  let raster = (p - geometry.map.zw) / geometry.map.xy;
  let size = vec2i(textureDimensions(distances));
  let q = raster - .5;
  let base = vec2i(floor(q));
  let blend = fract(q);
  let a = textureLoad(distances, clamp(base, vec2i(0), size - 1), 0).r;
  let b = textureLoad(distances, clamp(base + vec2i(1, 0), vec2i(0), size - 1), 0).r;
  let c = textureLoad(distances, clamp(base + vec2i(0, 1), vec2i(0), size - 1), 0).r;
  let e = textureLoad(distances, clamp(base + vec2i(1, 1), vec2i(0), size - 1), 0).r;
  // Conservative local distance for the slightly anisotropic ceil-rounded raster.
  return mix(mix(a, b, blend.x), mix(c, e, blend.x), blend.y)
         * min(geometry.map.x, geometry.map.y);
}
`;
