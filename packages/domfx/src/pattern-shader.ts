import type { PatternEffect } from './pattern-options.js';

const patternModes: Record<PatternEffect, number> = {
  halftone: 0,
  stipple: 1,
  scanlines: 2,
  crosshatch: 3,
  diamonds: 4,
  'contour-echoes': 5,
};

/** Shared edge flow; each exploration uses a distinct procedural mark. */
export function createPatternShader(pattern: PatternEffect): string {
  return `
const mode: u32 = ${patternModes[pattern]}u;
@group(0) @binding(0) var distances: texture_2d<f32>;
@group(0) @binding(1) var<uniform> params: vec4f;

@vertex fn vertex(@builtin(vertex_index) index: u32) -> @builtin(position) vec4f {
  let positions = array<vec2f, 3>(vec2f(-1, -1), vec2f(3, -1), vec2f(-1, 3));
  return vec4f(positions[index], 0, 1);
}

// CSS distance and its analytic bilinear gradient share four raster reads.
// The gradient's raster/raster units cancel; only the distance needs division.
fn field(p: vec2f) -> vec3f {
  let size = vec2i(textureDimensions(distances));
  let q = p * params.w - .5;
  let base = vec2i(floor(q));
  let blend = fract(q);
  let a = textureLoad(distances, clamp(base, vec2i(0), size - 1), 0).r;
  let b = textureLoad(distances, clamp(base + vec2i(1, 0), vec2i(0), size - 1), 0).r;
  let c = textureLoad(distances, clamp(base + vec2i(0, 1), vec2i(0), size - 1), 0).r;
  let d = textureLoad(distances, clamp(base + vec2i(1, 1), vec2i(0), size - 1), 0).r;
  return vec3f(
    mix(mix(a, b, blend.x), mix(c, d, blend.x), blend.y) / params.w,
    mix(b - a, d - c, blend.y),
    mix(c - a, d - b, blend.x),
  );
}

fn hash(p: vec2f) -> f32 {
  var q = fract(vec3f(p.x, p.y, p.x) * vec3f(.1031, .1030, .0973));
  q += vec3f(dot(q, q.yzx + vec3f(19.19)));
  return fract((q.x + q.y) * q.z);
}

fn noise(p: vec2f) -> f32 {
  let cell = floor(p);
  let f = fract(p);
  let u = f * f * (3 - 2 * f);
  return mix(mix(hash(cell), hash(cell + vec2f(1, 0)), u.x),
             mix(hash(cell + vec2f(0, 1)), hash(cell + vec2f(1, 1)), u.x), u.y);
}

fn rootHeight(p: vec2f, bend: f32) -> f32 {
  var height = 0.0;
  for (var step = 0; step < 7; step++) {
    let distance = field(p + vec2f(bend * height / 28, height)).x;
    if (distance <= .5) { return height; }
    height += max(distance, .6);
    if (height > 28) { return -1; }
  }
  return -1;
}


// Density follows the same captured silhouette and absolute-time flow as Dither.
// Coordinates and pattern spacing are CSS pixels; the original content stays intact.
fn densityAt(p: vec2f) -> vec3f {
  let distance = field(p).x;
  let intensity = clamp(params.z, 0, 1);
  let seed = vec2f(sin(params.y) * 17, cos(params.y) * 23);
  var flow = p * vec2f(.11, .045) + seed + vec2f(0, params.x * .8);
  let warp = noise(flow * .6 + vec2f(3.7, params.x * .15));
  flow.x += (warp - .5) * 1.8;
  let turbulence = noise(flow) * .65 + noise(flow * 2.03 + 8.3) * .35;
  let height = rootHeight(p, (warp - .5) * 7 * intensity);
  let reach = max(26 * intensity, .01);
  let rise = clamp(height / reach, 0, 1);
  var plume = 0.0;
  if (height >= 0 && distance > 0) {
    plume = clamp((turbulence * 1.65 - rise * .9) * (1 - rise), 0, 1);
  }
  let rim = (1 - smoothstep(0, 1 + intensity * 6, max(-distance, 0)))
          * (1 - smoothstep(0, 2.2, max(distance, 0))) * (.65 + turbulence * .35);
  return vec3f(max(plume, rim) * sqrt(intensity), distance, 1 - rise);
}

@fragment fn fragment(@builtin(position) pos: vec4f) -> @location(0) vec4f {
  if (params.w <= 0 || params.z <= 0) { return vec4f(0); }
  let p = pos.xy / params.w;
  let distance = field(p).x;
  if (distance < -10 || distance > 30) { return vec4f(0); }
  let intensity = clamp(params.z, 0, 1);
  let aa = clamp(.45 / params.w, .12, .45);
  let seed = vec2f(sin(params.y) * 17, cos(params.y) * 23);
  var coverage = 0.0;
  var heat = 1.0;
  var tint = vec3f(.48, .37, .83);

  if (mode == 0u) {
    // Rotated print-screen dots vary in radius rather than turning on/off.
    let rotated = vec2f(p.x + p.y, p.y - p.x) * .70710678;
    let cell = floor(rotated / 5.5);
    let center = (cell + .5) * 5.5;
    let sample = vec2f(center.x - center.y, center.x + center.y) * .70710678;
    let density = densityAt(sample);
    let radius = 2.5 * sqrt(clamp(density.x, 0, 1));
    coverage = (1 - smoothstep(radius - aa, radius + aa, length(rotated - center)))
             * smoothstep(0, .07, density.x);
    heat = density.z;
  } else if (mode == 1u) {
    // Jittered seeds remove the visible grid while keeping grain stable over time.
    let density = densityAt(p);
    let grid = floor(p / 3.2);
    for (var y = -1; y <= 1; y++) {
      for (var x = -1; x <= 1; x++) {
        let cell = grid + vec2f(f32(x), f32(y));
        let random = hash(cell + seed);
        let jitter = vec2f(hash(cell + seed + 7.1), hash(cell + seed + 19.3));
        let center = (cell + .15 + jitter * .7) * 3.2;
        let radius = .35 + hash(cell + seed + 43.8) * .6;
        let dotMark = 1 - smoothstep(radius - aa, radius + aa, length(p - center));
        coverage = max(coverage, dotMark * smoothstep(random, random + .08, density.x));
      }
    }
    heat = density.z;
    tint = vec3f(.55, .51, .72);
  } else if (mode == 2u) {
    // Broken horizontal bands travel sideways, with alternating row directions.
    let row = floor(p.y / 3.5);
    let direction = select(-1.0, 1.0, (i32(row) & 1) == 0);
    let x = p.x + direction * params.x * 4 + hash(vec2f(row, params.y)) * 13;
    let center = vec2f(p.x, (row + .5) * 3.5);
    let density = densityAt(center);
    let halfLength = 5.1 * clamp(density.x, 0, 1);
    let dash = abs(fract(x / 11) - .5) * 11;
    coverage = (1 - smoothstep(.5 - aa, .5 + aa, abs(p.y - center.y)))
             * (1 - smoothstep(halfLength - aa, halfLength + aa, dash))
             * smoothstep(0, .1, density.x);
    heat = density.z;
    tint = vec3f(.35, .53, .85);
  } else if (mode == 3u) {
    // One diagonal stroke in light areas, crossed strokes where flow is denser.
    let cell = floor(p / 6);
    let center = (cell + .5) * 6;
    let density = densityAt(center);
    let q = p - center;
    let slash = 1 - smoothstep(.35 - aa, .35 + aa, abs(q.x + q.y) * .70710678);
    let cross = 1 - smoothstep(.35 - aa, .35 + aa, abs(q.x - q.y) * .70710678);
    let extent = 2.6 * sqrt(clamp(density.x, 0, 1));
    coverage = max(slash, cross * smoothstep(.4, .75, density.x))
             * (1 - smoothstep(extent - aa, extent + aa, max(abs(q.x), abs(q.y))))
             * smoothstep(0, .1, density.x);
    heat = density.z;
  } else if (mode == 4u) {
    // Staggered diamonds with a traveling bright wave; small open centers make
    // the dense edge read as a lattice rather than square breakup fragments.
    let row = floor(p.y / 4.8);
    let offset = f32(i32(row) & 1) * 2.4;
    let cell = floor(vec2f(p.x - offset, p.y) / 4.8);
    let center = (cell + .5) * 4.8 + vec2f(offset, 0);
    let density = densityAt(center);
    let q = abs(p - center);
    let radius = 2.1 * sqrt(clamp(density.x, 0, 1));
    let shape = q.x + q.y;
    let outer = 1 - smoothstep(radius - aa, radius + aa, shape);
    let inner = smoothstep(radius * .4 - aa, radius * .4 + aa, shape);
    coverage = outer * mix(1, inner, smoothstep(.35, .8, density.x))
             * smoothstep(0, .08, density.x);
    heat = clamp(density.z * .65 + .35 * pow(.5 + .5 * sin((center.x + center.y) * .08 - params.x * 2), 5), 0, 1);
    tint = vec3f(.61, .39, .87);
  } else {
    // Echoes travel along SDF level sets, so they follow outer and inner contours.
    let reach = 5 + intensity * 20;
    let outside = max(distance, 0);
    let cycle = fract(outside / 5.5 - params.x * .65 + hash(seed));
    let band = min(cycle, 1 - cycle) * 5.5;
    let line = 1 - smoothstep(.4 - aa, .4 + aa, band);
    let noiseValue = noise(p * .11 + seed + vec2f(0, params.x * .2));
    let broken = smoothstep(.18 + outside / reach * .4, .48 + outside / reach * .3, noiseValue);
    let envelope = (1 - smoothstep(1, reach, outside)) * smoothstep(-.5, .5, distance);
    let rim = exp(-abs(distance) * 2) * .4;
    coverage = max(line * broken * envelope, rim) * sqrt(intensity);
    heat = 1 - clamp(outside / reach, 0, 1);
  }
  let exteriorColor = mix(tint, vec3f(.92, .94, 1), heat);
  let color = mix(tint * .8, exteriorColor, smoothstep(-1, 1, distance));
  let alpha = clamp(coverage * .94, 0, .94);
  return vec4f(color * alpha, alpha);
}`;
}
