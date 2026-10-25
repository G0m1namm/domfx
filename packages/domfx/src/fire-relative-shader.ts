import { effectGeometryBindings, localDistanceField } from './effect-geometry.js';
import {
  effectBindings,
  fullscreenVertex,
  gradientDirections,
  gradientNoise,
  scalarHash,
} from './shader-primitives.js';

/** Relative Fire keeps all noise, rim, bend and ember detail in target-local CSS px.
 * Only upward travel and the finite exterior envelope use directionalReach.
 */
export const relativeFireShader = `
${effectBindings}
${effectGeometryBindings}
${fullscreenVertex}
${scalarHash}
${gradientDirections}
${gradientNoise}
${localDistanceField}
fn rootHeight(p: vec2f, bend: f32, reach: f32) -> f32 {
  var height = 0.0;
  let direction = vec2f(bend / max(reach, 1), 1);
  let texel = min(geometry.map.x, geometry.map.y);
  // Symmetric admission implies reach < 500 raster px at the 1M-pixel gate.
  // Steps advance at least .5 raster px, so 2048 covers the entire admitted ray.
  // Subtract the interpolation/classification uncertainty before sphere tracing.
  for (var step = 0; step < 2048; step++) {
    let distance = field(p + direction * height);
    // Refine the last subpixel step instead of snapping to an iteration boundary.
    // Tiny f32 sampling differences after a padding change must not move a tongue.
    if (distance <= .75 * texel) { return max(0, height + distance / length(direction)); }
    height += max(distance - .75 * texel, .5 * texel) / length(direction);
    if (height > reach) { return -1; }
  }
  return -1;
}
@fragment fn fragment(@builtin(position) pos: vec4f) -> @location(0) vec4f {
  let reach = geometry.extent.x;
  let depth = geometry.extent.y;
  let intensity = params.z;
  if (reach == 0 || intensity == 0) { return vec4f(0); }
  let p = pos.xy * geometry.map.xy + geometry.map.zw;
  let time = params.x;
  let seed = params.y;
  let distance = field(p);
  // The SDF is isotropic in raster space. Use the upper CSS metric bound for
  // the support envelope, and the lower bound for conservative emitter tracing.
  let supportDistance = distance * max(geometry.map.x, geometry.map.y) / min(geometry.map.x, geometry.map.y);
  if (distance <= -depth || supportDistance >= reach) { return vec4f(0); }
  var flow = p * vec2f(.18, .025) + vec2f(sin(seed) * 17, cos(seed) * 23 + time * .8);
  let warp = noise(flow * .6 + vec2f(3.7, time * .2));
  flow.x += (warp - .5) * 1.6;
  let turbulence = noise(flow) * .5
                 + noise(flow * 2.03 + vec2f(8.3, time * .3)) * .25
                 + noise(flow * 4.07 + vec2f(2.8, time * .6)) * .15
                 + noise(flow * 8.13) * .1;
  let height = rootHeight(p, (warp - .5) * 7, reach);
  var density = -1.0;
  let rise = clamp(height / reach, 0, 1);
  if (height >= 0) { density = turbulence * 1.4 - .1 - rise * .8; }
  let body = smoothstep(0, .5, density) * pow(1 - rise, .55);
  let rim = exp(-abs(distance) * 1.6) * .28;
  let glow = exp(-abs(distance) * .45) * .07;
  let exterior = smoothstep(-.75, .75, distance);
  let envelope = 1 - smoothstep(max(0, reach - 1), reach, supportDistance);
  let alpha = clamp(rim + glow + body * exterior * .94, 0, .95)
              * smoothstep(-depth, -min(depth, .5), distance) * envelope;
  let heat = clamp(exp(-max(height, 0) / reach * 6.72) * .85 + max(density, 0) * .25, 0, 1);
  let orange = mix(vec3f(1, .09, .005), vec3f(1, .55, .025), smoothstep(.1, .65, heat));
  let color = mix(orange, vec3f(1, .96, .64), smoothstep(.65, 1, heat));
  var ember = 0.0;
  if (controls.material.y > 0) {
    let column = floor(p.x / 12);
    for (var neighbor = -1; neighbor <= 1; neighbor++) {
      let id = column + f32(neighbor);
      let random = hash(vec2f(id, seed + 53));
      if (random > .6 * controls.material.y) { continue; }
      let age = fract(time * .65 + hash(vec2f(id + 17, seed)));
      let emitterX = (id + hash(vec2f(id, seed + 9))) * 12;
      let drift = sin(age * 5 + random * 6) * age * 2;
      let dx = p.x - emitterX - drift;
      if (abs(dx) > 2) { continue; }
      let source = vec2f(emitterX, p.y + age * reach);
      let dy = field(source);
      let facing = field(source - vec2f(0, 1)) - field(source + vec2f(0, 1));
      let radius = .35 + random * .4;
      let spark = exp(-dx * dx / (radius * radius) - dy * dy / .7);
      ember = max(ember, spark * smoothstep(.5, 1.5, facing)
                  * smoothstep(0, .12, age) * (1 - smoothstep(.65, 1, age)));
    }
  }
  let emberAlpha = min(ember * exterior * envelope, .9);
  return vec4f(vec3f(1, .78, .28) * emberAlpha + color * alpha * (1 - emberAlpha),
               emberAlpha + alpha * (1 - emberAlpha)) * intensity;
}`;
