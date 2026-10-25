import {
  rasterDistance,
  effectBindings,
  fullscreenVertex,
  scalarHash,
} from './shader-primitives.js';

/** Premultiplied electricity overlay over the captured silhouette's signed distance field. */
export const electricityShader = `
${effectBindings}

${fullscreenVertex}

${rasterDistance}

${scalarHash}

@fragment fn fragment(@builtin(position) pos: vec4f) -> @location(0) vec4f {
  let time = params.x;
  let seed = params.y;
  let intensity = params.z;
  let distance = field(pos.xy);
  if (intensity <= 0 || distance < -2.5 || distance > 18) { return vec4f(0); }

  let dx = field(pos.xy + vec2f(params.w, 0)) - field(pos.xy - vec2f(params.w, 0));
  let dy = field(pos.xy + vec2f(0, params.w)) - field(pos.xy - vec2f(0, params.w));
  let normal = normalize(vec2f(dx, dy) + vec2f(.0001, .0001));
  let edge = pos.xy / params.w - normal * distance;
  let axis = select(edge.y, edge.x, abs(normal.y) > abs(normal.x));
  // Continuous spatial phase avoids breaking the strand where a curved edge turns.
  let phase = dot(edge, vec2f(.31, .17));
  let split = pow(max(sin(phase * .48 - time * 4.5 + seed * .6), 0), 3);
  let wobble = sin(phase * 2.4 - time * 6 + seed) * .48
             + sin(phase * 5.8 + time * 10) * .18;
  let primaryPath = .7 + wobble;
  let secondPath = primaryPath + 1.5 + split * 3.4
                 + sin(phase * 4.2 + time * 8) * .3;
  let thirdPath = secondPath + 2.3 + split * 2.2;

  // Neighboring strands split and rejoin around one persistent hot contour.
  let primary = exp(-pow((distance - primaryPath) / .52, 2));
  let secondary = exp(-pow((distance - secondPath) / .4, 2)) * (.5 + split * .45);
  let tertiary = exp(-pow((distance - thirdPath) / .36, 2)) * split * .7;
  let glow = exp(-pow(max(distance, 0) / 6, 2)) * (.11 + split * .1)
           + exp(-pow((distance - secondPath) / 2.2, 2)) * (.12 + split * .12);
  let junction = pow(max(sin(phase * .78 - time * 5 + seed), 0), 18)
               * exp(-pow((distance - primaryPath) / 1.7, 2)) * 1.1;

  // Sparks are in contour-local coordinates and use absolute-time lifetimes.
  var sparks = 0.0;
  let cell = floor(axis / 18);
  for (var neighbor = -1; neighbor <= 1; neighbor++) {
    let id = cell + f32(neighbor);
    let random = hash(vec2f(id, seed + 31));
    if (random < .58) { continue; }
    let age = fract(time * .72 + hash(vec2f(id + 17, seed)));
    let emitter = (id + hash(vec2f(id, seed + 9))) * 18;
    let x = axis - emitter + sin(age * 8 + random * 7) * age * 2.5;
    let y = distance - 1.3 - age * 11;
    let radius = .4 + random * .35;
    let spark = exp(-(x * x + y * y) / (radius * radius));
    sparks = max(sparks, spark * smoothstep(0, .12, age)
                 * (1 - smoothstep(.7, 1, age)));
  }

  let exterior = smoothstep(-2.5, -.25, distance);
  let halo = glow + tertiary * .65;
  let arc = secondary + tertiary * .35 + sparks * .5;
  let hot = primary + junction + sparks * .8;
  let energy = (halo * .6 + arc * .95 + hot * 1.35) * intensity * exterior;
  let alpha = min(.95, energy);
  let color = (halo * vec3f(.08, .28, .9)
             + arc * vec3f(.32, .62, 1)
             + hot * vec3f(.84, .96, 1)) / max(halo + arc + hot, .0001);
  return applyEffectColor(vec4f(color * alpha, alpha));
}`;
