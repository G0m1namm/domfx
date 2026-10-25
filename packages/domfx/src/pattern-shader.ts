import type { PatternEffect } from './pattern-options.js';
import {
  effectBindings,
  fullscreenVertex,
  vectorHash,
  valueNoise,
  cssDistanceGradient,
} from './shader-primitives.js';

export const patternBodies: Record<PatternEffect, string> = {
  halftone: `
    // Rotated print-screen dots vary in radius rather than turning on/off.
    let rotated = vec2f(p.x + p.y, p.y - p.x) * .70710678;
    let spacing = controls.material.z;
    let cell = floor(rotated / spacing);
    let center = (cell + .5) * spacing;
    let sample = vec2f(center.x - center.y, center.x + center.y) * .70710678;
    let density = densityAt(sample);
    let radius = 2.5 * (spacing / 5.5) * sqrt(clamp(density.x, 0, 1));
    coverage = (1 - smoothstep(radius - aa, radius + aa, length(rotated - center)))
             * smoothstep(0, .07, density.x);
    heat = density.z;
`,
  stipple: `
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
`,
  scanlines: `
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
`,
  crosshatch: `
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
`,
  diamonds: `
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
`,
  'contour-echoes': `
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
`,
  engraving: `
    // Curved engraved strokes bend with the silhouette, then loosen into wisps.
    let density = densityAt(p);
    let curve = p.y + sin(p.x * .045 + seed.x) * 5
              + distance * .6 + sin(p.x * .12 + params.x * .6) * 1.3;
    let band = abs(fract(curve / 3.8) - .5) * 3.8;
    let width = .2 + .4 * density.x;
    let breakage = noise(p * vec2f(.09, .025) + seed + vec2f(0, params.x * .3));
    coverage = (1 - smoothstep(width - aa, width + aa, band))
             * smoothstep(.12, .3, density.x) * smoothstep(.1, .3, breakage);
    heat = density.z;
    tint = vec3f(.58, .53, .77);
`,
  'woven-mesh': `
    // Crossing threads alternate over/under, with loose ends at low density.
    let density = densityAt(p);
    let q = p + vec2f(sin(p.y * .07 + params.x * .5), sin(p.x * .08 - params.x * .4)) * 1.4;
    let cell = floor(q / 6);
    let local = abs(fract(q / 6) - .5) * 6;
    let vertical = 1 - smoothstep(.65 - aa, .65 + aa, local.x);
    let horizontal = 1 - smoothstep(.65 - aa, .65 + aa, local.y);
    let over = (i32(cell.x + cell.y) & 1) == 0;
    let threads = select(max(horizontal, vertical * .45), max(vertical, horizontal * .45), over);
    let fray = smoothstep(hash(cell + seed) * .65, hash(cell + seed) * .65 + .18, density.x);
    coverage = threads * fray * smoothstep(0, .16, density.x);
    heat = density.z * .7 + select(horizontal, vertical, over) * .3;
`,
  hexagons: `
    // Nearest of two offset triangular grids forms a gap-free honeycomb.
    let spacing = vec2f(8.66, 15);
    let a = (floor(p / spacing) + .5) * spacing;
    let b = (floor((p - spacing * .5) / spacing) + 1) * spacing;
    let center = select(b, a, dot(p - a, p - a) < dot(p - b, p - b));
    let density = densityAt(center);
    let q = abs(p - center);
    let hex = max(q.x, dot(q, vec2f(.5, .8660254)));
    let radius = 4.05 * sqrt(clamp(density.x, 0, 1));
    let outer = 1 - smoothstep(radius - aa, radius + aa, hex);
    let hollow = smoothstep(radius - .9 - aa, radius - .9 + aa, hex);
    coverage = outer * mix(1, hollow, smoothstep(.3, .75, hash(center + seed)))
             * smoothstep(0, .1, density.x);
    heat = density.z;
    tint = vec3f(.44, .49, .85);
`,
  interference: `
    // Two fine, slightly rotated wave families create broad interference beats.
    let density = densityAt(p);
    let phase = p.x * 1.7 + sin(p.y * .035 + params.x * .4) * 3;
    let second = p.x * 1.62 + p.y * .18 + distance * .15 - params.x * 1.2;
    let firstLine = smoothstep(.3, .8, sin(phase));
    let secondLine = smoothstep(.3, .8, sin(second));
    coverage = firstLine * secondLine * smoothstep(.05, .5, density.x);
    heat = clamp(density.z * .7 + .3 * sin(phase - second), 0, 1);
    tint = vec3f(.58, .35, .86);
`,
  shards: `
    // Independently oriented triangular facets drift upward with the edge flow.
    let moving = p + vec2f(0, params.x * 4);
    let cell = floor(moving / 8);
    let random = hash(cell + seed);
    let center = (cell + .5) * 8 + vec2f(sin(random * 31), cos(random * 47)) * 1.3;
    let density = densityAt(center - vec2f(0, params.x * 4));
    let angle = random * 6.28318 + params.x * .25;
    let relative = moving - center;
    let q = vec2f(relative.x * cos(angle) - relative.y * sin(angle),
                  relative.x * sin(angle) + relative.y * cos(angle));
    let radius = 1.6 * sqrt(clamp(density.x, 0, 1));
    let triangle = max(abs(q.x) * .8660254 + q.y * .5, -q.y);
    coverage = (1 - smoothstep(radius - aa, radius + aa, triangle)) * smoothstep(0, .12, density.x);
    heat = clamp(density.z * .6 + .4 * pow(.5 + .5 * sin(params.x * 2 + random * 31), 8), 0, 1);
    tint = mix(vec3f(.47, .34, .86), vec3f(.35, .67, .83), random);
`,
  circuits: `
    // L-shaped paths join adjacent cells; bright pulses pass small solder nodes.
    let cell = floor(p / 10);
    let center = (cell + .5) * 10;
    let density = densityAt(p);
    var q = p - center;
    let turn = hash(cell + seed);
    if (turn > .5) { q.x = -q.x; }
    if (hash(cell + seed + 9.7) > .5) { q.y = -q.y; }
    let horizontal = length(q - vec2f(clamp(q.x, -5, 0), 0));
    let vertical = length(q - vec2f(0, clamp(q.y, 0, 5)));
    let line = 1 - smoothstep(.4 - aa, .4 + aa, min(horizontal, vertical));
    let node = 1 - smoothstep(1.15 - aa, 1.15 + aa, length(q));
    coverage = max(line, node) * smoothstep(.07, .35, density.x);
    let pulse = pow(.5 + .5 * sin((p.x + p.y) * .13 - params.x * 3), 12);
    heat = clamp(.3 + density.z * .25 + pulse * .6, 0, 1);
    tint = vec3f(.32, .56, .84);
`,
  'star-shimmer': `
    // Four concave points grow out of small glints; sparse stars never form a band.
    let cell = floor(p / 12);
    let random = hash(cell + seed);
    let center = (cell + .5) * 12 + vec2f(sin(random * 43), cos(random * 31)) * .6;
    let density = densityAt(center);
    let twinkle = pow(.5 + .5 * sin(params.x * (1.5 + random) + random * 37), 2);
    let radius = (1 + twinkle * 4) * pow(clamp(density.x, 0, 1), .25);
    let q = abs(p - center);
    let star = pow(sqrt(q.x) + sqrt(q.y), 2);
    let shape = min(star, length(q) * 2.5);
    coverage = (1 - smoothstep(radius - aa, radius + aa, shape))
             * smoothstep(.08, .3, density.x) * (.45 + .55 * twinkle);
    heat = .65 + .35 * twinkle;
    tint = vec3f(.6, .42, .84);
`,
  'brush-fringe': `
    // Short bristles point outward from the silhouette, with irregular dry tips.
    let grid = floor(p / 7);
    for (var y = -1; y <= 1; y++) {
      for (var x = -1; x <= 1; x++) {
        let cell = grid + vec2f(f32(x), f32(y));
        let random = hash(cell + seed);
        let center = (cell + .5) * 7 + vec2f(random - .5, hash(cell + 17.1) - .5) * 3;
        let sample = field(center);
        // Thin glyph strokes have a medial ridge with no usable normal. A zero
        // direction collapses both projections, painting a square instead of ink.
        let gradientLength = length(sample.yz);
        if (gradientLength < .15) { continue; }
        let normal = sample.yz / gradientLength;
        let q = p - center;
        let along = dot(q, normal);
        let across = abs(dot(q, vec2f(-normal.y, normal.x)));
        let reach = 3 + intensity * 16;
        let envelope = (1 - smoothstep(0, reach, max(sample.x, 0)))
                     * (1 - smoothstep(0, 1 + intensity * 5, max(-sample.x, 0)));
        let length = (1.5 + random * 3) * sqrt(envelope * intensity);
        let taper = clamp(1 - abs(along) / max(length, .01), 0, 1);
        let width = (.3 + random * .45) * taper;
        let bristle = (1 - smoothstep(width - aa, width + aa, across))
                    * (1 - smoothstep(length - aa, length + aa, abs(along)));
        let ink = .6 + .4 * noise(vec2f(along * 1.5, random * 71 + params.x * .35));
        coverage = max(coverage, bristle * envelope * ink * sqrt(intensity));
      }
    }
    coverage *= smoothstep(-1.5, -.3, distance);
    heat = 1 - clamp(max(distance, 0) / 22, 0, 1);
    tint = vec3f(.57, .49, .74);
`,
};

/** Shared edge flow; each exploration uses a distinct procedural mark. */
export function createPatternShader(pattern: PatternEffect): string {
  return `
${effectBindings}

${fullscreenVertex}

// CSS distance and its analytic bilinear gradient share four raster reads.
// The gradient's raster/raster units cancel; only the distance needs division.
${cssDistanceGradient}

${vectorHash}

${valueNoise}

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

${patternBodies[pattern]}
  let exteriorColor = mix(tint, vec3f(.92, .94, 1), heat);
  let color = mix(tint * .8, exteriorColor, smoothstep(-1, 1, distance));
  let alpha = clamp(coverage * .94, 0, .94);
  return vec4f(color * alpha, alpha);
}`;
}
