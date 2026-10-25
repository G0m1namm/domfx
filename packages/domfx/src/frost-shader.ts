import {
  rasterDistance,
  effectBindings,
  fullscreenVertex,
  gradientDirections,
  scalarHash,
  gradientNoise,
} from './shader-primitives.js';

export const frostShader = `
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
  if (params.z <= 0 || params.w <= 0) { return vec4f(0); }
  let p = pos.xy / params.w;
  let time = params.x;
  let seed = params.y;
  let intensity = clamp(params.z, 0, 1);
  let distance = textureLoad(distances, vec2i(pos.xy), 0).r / params.w;
  if (distance <= -15 || distance > 30) { return vec4f(0); }
  let exterior = smoothstep(-.5, .8, distance);
  let boundaryFade = smoothstep(-15, -14, distance) * (1 - smoothstep(27, 30, distance));
  let origin = vec2f(sin(seed) * 17, cos(seed) * 23);

  // Intensity thickens the settled coating inward, independently of the mist.
  // A noise-shaped front and stable grain keep it material-like rather than
  // a uniform outline. Maximum inward coverage stays below 13 CSS pixels.
  let crust = noise(p * .46 + origin);
  let grain = noise(p * 1.65 + origin * 2.3);
  let front = clamp(noise(p * .12 + origin), 0, 1);
  let frostDepth = (1.5 + 11.5 * pow(intensity, 1.2)) * (.7 + front * .3);
  let inward = max(-distance, 0);
  let lipWidth = (.75 + crust * .95) * (1 + intensity * .35);
  let lip = exp(-pow((distance + .2) / lipWidth, 2)) * (.72 + grain * .25);
  let coverage = (1 - smoothstep(frostDepth * .35, frostDepth, inward))
               * (1 - smoothstep(-.2, .6, distance));
  let coating = coverage * (.66 + grain * .3) * (.45 + intensity * .5);
  let iceAlpha = clamp(lip + coating * (1 - lip), 0, .98) * sqrt(intensity);
  let whiteMix = clamp(1 - inward / frostDepth + grain * .12, 0, 1);
  let iceColor = mix(vec3f(.53, .77, .93), vec3f(.97, .99, 1), whiteMix);

  // Stretched, layered turbulence pulls the mist into thin irregular wisps.
  // The traced source keeps it rooted in real contours, including openings.
  var flow = p * vec2f(.19, .033) + origin + vec2f(0, time * .38);
  let curl = noise(flow * .65 + vec2f(time * .07, 3.7));
  flow += vec2f((curl - .5) * 2.1, noise(flow + 13.7) * .3);
  let cloud = noise(flow) * .52
            + noise(flow * 2.04 + vec2f(8.3, time * .13)) * .27
            + noise(flow * 4.1 + vec2f(2.8, time * .19)) * .15
            + noise(flow * 8.13 + vec2f(5.1, time * .23)) * .06;
  let height = rootHeight(pos.xy, (curl - .5) * 10 * intensity);
  // Match Fire: intensity scales both reach and opacity, with no height floor.
  let reach = 28 * intensity;
  let rise = clamp(max(height, 0) / reach, 0, 1);
  var vapor = 0.0;
  if (height >= 0 && height < reach) {
    let density = cloud * 1.4 - .12 - rise * .85;
    let strands = smoothstep(.02, .5, density);
    vapor = strands * .64 * pow(1 - rise, .65)
          * (1 - smoothstep(.86, 1, rise));
  }
  let mistAlpha = vapor * exterior * sqrt(intensity) * controls.material.x;
  let mistColor = mix(vec3f(.79, .86, .92), vec3f(.97, .985, 1), cloud);
  var result = vec4f(iceColor * iceAlpha + mistColor * mistAlpha * (1 - iceAlpha),
                     iceAlpha + mistAlpha * (1 - iceAlpha));

  // Small faceted ice grains drift above the rim. A diamond body and a restrained
  // cool halo keep them visible without turning them into large snowflakes.
  var dust = 0.0;
  let column = floor(p.x / 10);
  for (var neighbor = -1; neighbor <= 1; neighbor++) {
    let id = column + f32(neighbor);
    let random = hash(vec2f(id, seed + 53));
    if (random > intensity * .65) { continue; }
    let age = fract(time * (.3 + random * .12) + hash(vec2f(id + 17, seed)));
    let emitterX = (id + hash(vec2f(id, seed + 9))) * 10;
    let drift = (sin(age * 6 + random * 6) - sin(random * 6)) * age * 1.7;
    let dx = p.x - emitterX - drift;
    if (abs(dx) > 2) { continue; }
    let source = vec2f(emitterX, p.y + age * reach) * params.w;
    let dy = field(source);
    let facing = field(source - vec2f(0, params.w)) - field(source + vec2f(0, params.w));
    let angle = random * 6.283185 + age * .7;
    let q = vec2f(dx * cos(angle) - dy * sin(angle), dx * sin(angle) + dy * cos(angle));
    let radius = .65 + random * .35;
    let crystalDistance = (abs(q.x) + abs(q.y) * .8 - radius) * .78;
    let aa = .45 / params.w;
    let body = 1 - smoothstep(-aa, aa, crystalDistance);
    let halo = exp(-(dx * dx + dy * dy) / 1.2) * .16;
    let speck = body + halo * (1 - body);
    dust = max(dust, speck * smoothstep(.5, 1.5, facing)
               * smoothstep(0, .1, age) * (1 - smoothstep(.65, 1, age)));
  }
  let dustAlpha = min(dust * exterior * sqrt(intensity), .95);
  result = vec4f(vec3f(.96, .985, 1) * dustAlpha, dustAlpha) + result * (1 - dustAlpha);
  return applyEffectColor(result * boundaryFade);
}`;
