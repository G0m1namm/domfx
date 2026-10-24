import { effectGeometryBindings } from './effect-geometry.js';
import type { PatternEffect } from './pattern-options.js';
import { patternBodies } from './pattern-shader.js';
import { effectBindings, fullscreenVertex, valueNoise, vectorHash } from './shader-primitives.js';

// Same four-read bilinear SDF as localDistanceField, with its local-space gradient
// for Brush fringe. All procedural marks use the target origin, outside padding.
const relativeField = `
fn field(p: vec2f) -> vec3f {
  let raster = (p - geometry.map.zw) / geometry.map.xy;
  let size = vec2i(textureDimensions(distances));
  let q = raster - .5;
  let base = vec2i(floor(q));
  let blend = round(fract(q) * 256) / 256;
  let a = textureLoad(distances, clamp(base, vec2i(0), size - 1), 0).r;
  let b = textureLoad(distances, clamp(base + vec2i(1, 0), vec2i(0), size - 1), 0).r;
  let c = textureLoad(distances, clamp(base + vec2i(0, 1), vec2i(0), size - 1), 0).r;
  let d = textureLoad(distances, clamp(base + vec2i(1, 1), vec2i(0), size - 1), 0).r;
  let unit = min(geometry.map.x, geometry.map.y);
  return vec3f(mix(mix(a, b, blend.x), mix(c, d, blend.x), blend.y) * unit,
               mix(b - a, d - c, blend.y) * unit / geometry.map.x,
               mix(c - a, d - b, blend.x) * unit / geometry.map.y);
}

fn rootHeight(p: vec2f, bend: f32, reach: f32) -> f32 {
  var height = 0.0;
  let direction = vec2f(bend / max(reach, 1), 1);
  let texel = min(geometry.map.x, geometry.map.y);
  // Shared Fire bound: symmetric padding and 1M pixels bound an admitted ray.
  // Advance >=.5 raster px along it; account for interpolation uncertainty.
  for (var step = 0; step < 2048; step++) {
    let distance = field(p + direction * height).x;
    if (distance <= .75 * texel) { return height; }
    height += max(distance - .75 * texel, .5 * texel) / length(direction);
    if (height > reach) { return -1; }
  }
  return -1;
}
`;

function relativeFlow(dither: boolean): string {
  return `
fn densityAt(p: vec2f) -> vec3f {
  let distance = field(p).x;
  let reach = geometry.extent.x;
  let depth = geometry.extent.y;
  let seed = vec2f(sin(params.y) * 17, cos(params.y) * 23);
  var flow = p * vec2f(.11, .045) + seed + vec2f(0, params.x * ${dither ? '.9' : '.8'});
  let warp = noise(flow * .6 + vec2f(3.7, params.x * .15));
  flow.x += (warp - .5) * 1.8;
  let turbulence = noise(flow) * .65 + noise(flow * 2.03 + 8.3) * .35;
  var height = -1.0;
  var rise = 1.0;
  var plume = 0.0;
  if (reach > 0 && distance > 0 && distance < reach) {
    height = rootHeight(p, (warp - .5) * 7, reach);
    rise = clamp(height / reach, 0, 1);
    if (height >= 0) {
      plume = clamp((turbulence * ${dither ? '1.6' : '1.65'} - rise * ${dither ? '.95' : '.9'}) * (1 - rise), 0, 1);
    }
  }
  var rim = 0.0;
  if (depth > 0 && distance <= 0) {
    rim = (1 - smoothstep(0, depth, -distance)) * (.65 + turbulence * .35);
  }
  return vec3f(max(plume, rim), distance, 1 - rise);
}
`;
}

const echoes = `
    let reach = geometry.extent.x;
    let outside = max(distance, 0);
    let cycle = fract(outside / 5.5 - params.x * .65 + hash(seed));
    let band = min(cycle, 1 - cycle) * 5.5;
    let line = 1 - smoothstep(.4 - aa, .4 + aa, band);
    let noiseValue = noise(p * .11 + seed + vec2f(0, params.x * .2));
    let broken = smoothstep(.18 + outside / reach * .4, .48 + outside / reach * .3, noiseValue);
    let envelope = (1 - smoothstep(0, reach, outside)) * smoothstep(-.5, .5, distance);
    let rim = exp(-abs(distance) * 2) * .4 * (1 - smoothstep(.5, 1, abs(distance)))
            * (1 - smoothstep(0, reach, outside));
    coverage = max(line * broken * envelope, rim);
    heat = 1 - clamp(outside / reach, 0, 1);
`;

/** Artistic bristles stay bounded, so the original 3x3 neighbor search is complete:
 * the first omitted cell is >=9 CSS px away; a bristle reaches <5.1 CSS px.
 */
const fringe = patternBodies['brush-fringe'].replace(
  'let reach = 3 + intensity * 16;',
  'let reach = geometry.extent.x;',
);

export function createRelativePatternShader(pattern: PatternEffect | 'dither'): string {
  const dither = pattern === 'dither';
  const radial = pattern === 'contour-echoes' || pattern === 'brush-fringe';
  let body: string;
  if (dither) {
    body = `
    let spacing = 2.0;
    let cell = vec2i(floor(p / spacing));
    let center = (vec2f(cell) + .5) * spacing;
    let density = densityAt(center);
    let bayer = array<f32, 16>(0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5);
    let index = u32((cell.x & 3) + (cell.y & 3) * 4);
    if (density.x < (bayer[index] + .5) / 16) { return vec4f(0); }
    coverage = 1 - smoothstep(.67 - aa, .67 + aa, length(p - center));
    heat = density.z;
    tint = mix(vec3f(.38, .3, .65), vec3f(.48, .37, .83), smoothstep(-1, 1, distance));
`;
  } else if (pattern === 'contour-echoes') {
    body = echoes;
  } else if (pattern === 'brush-fringe') {
    body = fringe;
  } else {
    body = patternBodies[pattern];
  }
  return `
${effectBindings}
${effectGeometryBindings}
${fullscreenVertex}
${relativeField}
${vectorHash}
${valueNoise}
${relativeFlow(dither)}
@fragment fn fragment(@builtin(position) pos: vec4f) -> @location(0) vec4f {
  if (params.z <= 0 || ${radial ? 'geometry.extent.x == 0' : '(geometry.extent.x == 0 && geometry.extent.y == 0)'}) {
    return vec4f(0);
  }
  let p = pos.xy * geometry.map.xy + geometry.map.zw;
  let distance = field(p).x;
  if (distance > geometry.extent.x + 6 || distance < -geometry.extent.y - 6) { return vec4f(0); }
  let intensity = 1.0;
  let aa = clamp(.45 * max(geometry.map.x, geometry.map.y), ${dither ? '.15' : '.12'}, .45);
  let seed = vec2f(sin(params.y) * 17, cos(params.y) * 23);
  var coverage = 0.0;
  var heat = 1.0;
  var tint = vec3f(.48, .37, .83);
${body}
  let exteriorColor = mix(tint, vec3f(${dither ? '.91' : '.92'}, .94, 1), heat);
  let color = mix(tint * ${dither ? '1' : '.8'}, exteriorColor, smoothstep(-1, 1, distance));
  let alpha = clamp(coverage * ${dither ? '.95' : '.94'}, 0, ${dither ? '.95' : '.94'});
  return vec4f(color * alpha, alpha) * clamp(params.z, 0, 1);
}`;
}
