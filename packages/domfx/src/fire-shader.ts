import {
  rasterDistance,
  effectBindings,
  fullscreenVertex,
  gradientDirections,
  scalarHash,
  gradientNoise,
} from './shader-primitives.js';

export const fireShader = `
${effectBindings}
${fullscreenVertex}
${rasterDistance}
${scalarHash}
${gradientDirections}
${gradientNoise}
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
  if (controls.material.y > 0) {
    let column = floor(p.x / 12);
    for (var neighbor = -1; neighbor <= 1; neighbor++) {
      let id = column + f32(neighbor);
      let random = hash(vec2f(id, seed + 53));
      if (random > intensity * .6 * controls.material.y) { continue; }
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
  }
  ember *= exterior * intensity;
  let emberAlpha = min(ember, .9);
  return vec4f(vec3f(1, .78, .28) * emberAlpha + color * alpha * (1 - emberAlpha),
               emberAlpha + alpha * (1 - emberAlpha));
}`;
