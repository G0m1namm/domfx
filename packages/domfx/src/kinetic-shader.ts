export const kineticShader = `
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

// One clockwise sweep around the capture center; all actual contours in the
// swept sector light up, including holes and disconnected letters.
fn phaseAt(p: vec2f) -> f32 {
  let center = vec2f(textureDimensions(distances)) / (2 * params.w);
  let delta = p - center;
  let angle = atan2(delta.y, delta.x + .00001) / 6.283185;
  return fract(params.x / 5.8 + hash(vec2f(params.y, 13.7)) - angle);
}

@fragment fn fragment(@builtin(position) pos: vec4f) -> @location(0) vec4f {
  if (params.w <= 0 || params.z <= 0) { return vec4f(0); }
  let p = pos.xy / params.w;
  let distance = field(p).x;
  if (distance < -3 || distance > 30) { return vec4f(0); }
  let intensity = clamp(params.z, 0, 1);
  let aa = clamp(.65 / params.w, .15, .8);
  let extent = vec2f(textureDimensions(distances)) / params.w;
  let inset = vec2f(.5 / params.w);
  let seed = vec2f(params.y * .137, params.y * .071);
  let silver = vec3f(.94, .95, 1);
  let violet = vec3f(.49, .32, .95);

  let phase = phaseAt(p);
  let frontDistance = min(phase, 1 - phase);
  // Higher intensity broadens the luminous front and its wake as well as
  // brightening them, so the control visibly builds energy around the edge.
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
  // 7px contour projection + 21px flight + 5px fragment/halo support.
  // The first omitted cell is >=39.6px away after probe jitter.
  for (var y = -3; y <= 3; y++) {
    for (var x = -3; x <= 3; x++) {
      let id = cell + vec2f(f32(x), f32(y));
      let random = hash(id + seed);
      if (random > .65 + intensity * .35) { continue; }
      let jitter = vec2f(hash(id + seed + 7.1), hash(id + seed + 53.2));
      let probe = (id + .5) * 12 + (jitter - .5) * 4.8;
      if (any(probe < inset) || any(probe > extent - inset)) { continue; }
      if (length(p - probe) > 34) { continue; }
      var surface = field(probe);
      if (abs(surface.x) > 7) { continue; }
      var origin = probe;
      for (var step = 0; step < 3; step++) {
        let squared = dot(surface.yz, surface.yz);
        if (!(squared >= .04 && squared <= 4)) { break; }
        let correction = surface.yz * surface.x / max(squared, .25);
        origin -= correction * min(1, 7 / max(length(correction), .001));
        if (any(origin < inset) || any(origin > extent - inset)) { break; }
        surface = field(origin);
      }
      if (any(origin < inset) || any(origin > extent - inset)) { continue; }
      let squared = dot(surface.yz, surface.yz);
      if (!(abs(surface.x) <= .35 && squared >= .04 && squared <= 4)) { continue; }
      if (length(origin - probe) > 7 || length(p - origin) > 27) { continue; }
      let age = phaseAt(origin) / wakeEnd;
      if (age <= 0 || age >= 1) { continue; }
      let normal = surface.yz / sqrt(squared);
      let tangent = vec2f(-normal.y, normal.x);
      let travel = (1 - pow(1 - age, 2)) * (10 + random * 10) * intensity;
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
  return result * (pow(intensity, .4) * smoothstep(-3, -.5, distance)
                 * (1 - smoothstep(27, 30, distance)));
}`;
