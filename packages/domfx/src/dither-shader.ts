import {
  effectBindings,
  fullscreenVertex,
  vectorHash,
  valueNoise,
  cssDistanceGradient,
} from './shader-primitives.js';

export const ditherShader = `
${effectBindings}

${fullscreenVertex}

// CSS distance and its analytic bilinear gradient share four raster reads.
// The gradient's raster/raster units cancel; only the distance needs division.
${cssDistanceGradient}

${vectorHash}

${valueNoise}

// Four-by-four ordered thresholds stay fixed in CSS-pixel space while the
// density field rises through them. Each active cell is a small circular dot.
fn threshold(cell: vec2i) -> f32 {
  let bayer = array<f32, 16>(0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5);
  let index = u32((cell.x & 3) + (cell.y & 3) * 4);
  return (bayer[index] + .5) / 16;
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

@fragment fn fragment(@builtin(position) pos: vec4f) -> @location(0) vec4f {
  if (params.w <= 0 || params.z <= 0) { return vec4f(0); }
  let p = pos.xy / params.w;
  let intensity = clamp(params.z, 0, 1);
  let spacing = 2.0;
  let cell = vec2i(floor(p / spacing));
  let center = (vec2f(cell) + .5) * spacing;
  let distance = field(center).x;
  if (distance < -8 || distance > 29) { return vec4f(0); }
  let seed = vec2f(sin(params.y) * 17, cos(params.y) * 23);
  var flow = center * vec2f(.11, .045) + seed + vec2f(0, params.x * .9);
  let warp = noise(flow * .6 + vec2f(3.7, params.x * .15));
  flow.x += (warp - .5) * 1.8;
  let turbulence = noise(flow) * .65 + noise(flow * 2.03 + 8.3) * .35;
  let height = rootHeight(center, (warp - .5) * 7 * intensity);
  let reach = max(26 * intensity, .01);
  let rise = clamp(height / reach, 0, 1);
  var plume = 0.0;
  if (height >= 0 && distance > 0) {
    plume = clamp((turbulence * 1.6 - rise * .95) * (1 - rise), 0, 1);
  }
  let inwardDepth = 1 + intensity * 6;
  let rim = (1 - smoothstep(0, inwardDepth, max(-distance, 0)))
          * (1 - smoothstep(0, 2.2, max(distance, 0))) * (.65 + turbulence * .35);
  let density = max(plume, rim) * sqrt(intensity);
  if (density < threshold(cell)) { return vec4f(0); }
  let aa = clamp(.45 / params.w, .15, .45);
  let dotCoverage = 1 - smoothstep(.67 - aa, .67 + aa, length(p - center));
  let heat = clamp(1 - max(height, 0) / reach, 0, 1);
  let exteriorColor = mix(vec3f(.48, .37, .83), vec3f(.91, .94, 1), heat);
  let color = mix(vec3f(.38, .3, .65), exteriorColor, smoothstep(-1, 1, distance));
  let alpha = dotCoverage * .95;
  return applyEffectColor(vec4f(color * alpha, alpha));
}`;
