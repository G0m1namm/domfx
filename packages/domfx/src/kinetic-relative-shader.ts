import { effectGeometryBindings, localDistanceField } from './effect-geometry.js';
import { effectBindings, fullscreenVertex, vectorHash } from './shader-primitives.js';

export const relativeKineticShader = `
${effectBindings}

${fullscreenVertex}

${effectGeometryBindings}
${localDistanceField}
// Finite differences remain in target-local CSS px, independent of reach.
fn surfaceAt(p: vec2f) -> vec3f {
  return vec3f(field(p), (field(p + vec2f(.5, 0)) - field(p - vec2f(.5, 0))),
                       (field(p + vec2f(0, .5)) - field(p - vec2f(0, .5))));
}

${vectorHash}

// One clockwise sweep around the capture center; all actual contours in the
// swept sector light up, including holes and disconnected letters.
fn phaseAt(p: vec2f) -> f32 {
  let center = vec2f(textureDimensions(distances)) * geometry.map.xy * .5 + geometry.map.zw;
  let delta = p - center;
  let angle = atan2(delta.y, delta.x + .00001) / 6.283185;
  return fract(params.x / 5.8 + hash(vec2f(params.y, 13.7)) - angle);
}

@fragment fn fragment(@builtin(position) pos: vec4f) -> @location(0) vec4f {
  let reach = geometry.extent.x;
  if (reach <= 0 || params.z <= 0) { return vec4f(0); }
  let p = pos.xy * geometry.map.xy + geometry.map.zw;
  let distance = field(p);
  let supportDistance = distance * max(geometry.map.x, geometry.map.y) / min(geometry.map.x, geometry.map.y);
  let support = reach + 8;
  if (distance <= -3 || supportDistance >= support) { return vec4f(0); }
  // Fix the legacy full-strength pulse/wake profile; strength only scales output.
  let intensity = 1.0;
  let aa = clamp(.65 * min(geometry.map.x, geometry.map.y), .15, .8);
  let lower = geometry.map.zw + geometry.map.xy * .5;
  let upper = geometry.map.zw + (vec2f(textureDimensions(distances)) - .5) * geometry.map.xy;
  let seed = vec2f(params.y * .137, params.y * .071);
  let silver = vec3f(.94, .95, 1);
  let violet = vec3f(.49, .32, .95);

  let phase = phaseAt(p);
  let frontDistance = min(phase, 1 - phase);
  // Pulse widths, wake lifetime and fragment dimensions do not depend on travel.
  let wakeEnd = .23 + intensity * .05;
  let head = exp(-pow(frontDistance / (.018 + intensity * .016), 2));
  let wake = exp(-phase / (.075 + intensity * .035))
           * (1 - smoothstep(wakeEnd * .65, wakeEnd, phase));
  let core = exp(-distance * distance / (.9 + intensity * 1.3))
           * (head * (1 + intensity * .3) + wake * (.5 + intensity * .25));
  let halo = exp(-distance * distance / (10 + intensity * 12))
           * (head * (.3 + intensity * .25) + wake * (.23 + intensity * .17));
  let coreAlpha = min(core, .98);
  let pulseColor = mix(vec3f(.68, .5, 1), silver, head);
  var result = vec4f(pulseColor * coreAlpha + violet * halo * (1 - coreAlpha),
                     coreAlpha + halo * (1 - coreAlpha));

  let cell = floor(p / 12);
  // Every contributing probe is within 7px projection + reach + 3px drift +
  // 5px footprint. Probe jitter adds 2.4px and a cell center adds 6px per axis.
  // The search is finite and grows with admitted CSS travel, including DPR < 1.
  let neighbors = i32(ceil((reach + 23.4) / 12));
  for (var y = -neighbors; y <= neighbors; y++) {
    for (var x = -neighbors; x <= neighbors; x++) {
      let id = cell + vec2f(f32(x), f32(y));
      let random = hash(id + seed);
      if (random > .65 + intensity * .35) { continue; }
      let jitter = vec2f(hash(id + seed + 7.1), hash(id + seed + 53.2));
      let probe = (id + .5) * 12 + (jitter - .5) * 4.8;
      if (any(probe < lower) || any(probe > upper)) { continue; }
      if (length(p - probe) > reach + 15) { continue; }
      var surface = surfaceAt(probe);
      if (abs(surface.x) > 7) { continue; }
      var origin = probe;
      for (var step = 0; step < 3; step++) {
        let squared = dot(surface.yz, surface.yz);
        if (!(squared >= .04 && squared <= 4)) { break; }
        let correction = surface.yz * surface.x / max(squared, .25);
        origin -= correction * min(1, 7 / max(length(correction), .001));
        if (any(origin < lower) || any(origin > upper)) { break; }
        surface = surfaceAt(origin);
      }
      if (any(origin < lower) || any(origin > upper)) { continue; }
      let squared = dot(surface.yz, surface.yz);
      if (!(abs(surface.x) <= .35 && squared >= .04 && squared <= 4)) { continue; }
      if (length(origin - probe) > 7 || length(p - origin) > reach + 8) { continue; }
      let age = phaseAt(origin) / wakeEnd;
      if (age <= 0 || age >= 1) { continue; }
      let normal = surface.yz / sqrt(squared);
      let tangent = vec2f(-normal.y, normal.x);
      let travel = (1 - pow(1 - age, 2)) * (.5 + random * .5) * reach;
      let center = origin + normal * travel + tangent * (sin(age * 4) * age * 3);
      let offset = p - center;
      let support = 1 - smoothstep(4, 5, length(offset));
      if (support <= 0) { continue; }
      let angle = random * 6.283185 + age * 2;
      let axis = normal * cos(angle) + tangent * sin(angle);
      let q = vec2f(dot(offset, axis), dot(offset, vec2f(-axis.y, axis.x)));
      let size = (1.2 + random * .8) * (.85 + intensity * .4) * (1 - age * .35);
      let shape = (abs(q.x) + abs(q.y) * .7 - size) * .8;
      let body = 1 - smoothstep(-aa, aa, shape);
      let glow = exp(-max(shape, 0) * max(shape, 0) / 2) * (.26 + intensity * .14);
      let color = mix(silver, vec3f(.66, .49, 1), smoothstep(.1, .8, age));
      let envelope = smoothstep(0, .06, age) * (1 - smoothstep(.35, 1, age)) * support;
      let alpha = body * envelope * .95;
      let fragmentGlow = glow * envelope;
      let shard = vec4f(color * alpha + violet * fragmentGlow * (1 - alpha),
                        alpha + fragmentGlow * (1 - alpha));
      result = shard + result * (1 - shard.a);
    }
  }
  return result * (params.z * smoothstep(-3, -.5, distance)
                 * (1 - smoothstep(max(0, support - 1), support, supportDistance)));
}`;
