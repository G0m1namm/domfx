export const burnedPaperShader = `
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

// Layered noise supplies one material coordinate for the torn edge, char and
// scorch bands, rather than stretching noise out from the nearest contour.
fn fbm(point: vec2f) -> f32 {
  var q = point;
  var value = 0.0;
  var amplitude = .5;
  for (var octave = 0; octave < 4; octave++) {
    value += noise(q) * amplitude;
    q = vec2f(q.x * 1.6 - q.y * 1.2, q.x * 1.2 + q.y * 1.6) + 7.1;
    amplitude *= .5;
  }
  return value / .9375;
}

@fragment fn fragment(@builtin(position) pos: vec4f) -> @location(0) vec4f {
  if (params.w <= 0 || params.z <= 0) { return vec4f(0); }
  let p = pos.xy / params.w;
  let targetField = field(p);
  let distance = targetField.x;
  if (distance < -22 || distance > 27) { return vec4f(0); }
  let intensity = clamp(params.z, 0, 1);
  let aa = clamp(.5 / params.w, .15, .7);
  let seed = vec2f(params.y * .137, params.y * .071);
  let normal = targetField.yz / max(length(targetField.yz), .001);
  let origin = p - normal * distance;
  let localWidth = max(12 - field(origin - normal * 12).x, 1);
  let q = p * .055 + seed;
  let warp = vec2f(noise(q + 13.7), noise(q + 38.2)) - .5;
  let broad = fbm(q + warp * 1.6);
  let fibers = noise(p * .68 + seed + 17.3);
  let grain = noise(p * 2.4 + seed + 31.7);
  let lobes = smoothstep(.23, .77, broad);
  // Keep the outside footprint below one CSS pixel. Intensity consumes more
  // of the surface inward instead of filling gaps between letters and shapes.
  let lip = (.15 + fibers * .65) * smoothstep(0, .15, intensity);
  // A stationary burn front keeps the content intact. Its signed coordinate
  // drives every material band, as in a noise-threshold burn/dissolve shader.
  let burn = lip - distance;
  let contour = smoothstep(-aa, aa, burn);
  let charDepth = lip + min(1 + intensity * 10, localWidth * (.06 + intensity * .24))
                     * (.5 + lobes * .5);
  let stainDepth = charDepth + min(2 + intensity * 15, localWidth * (.05 + intensity * .2))
                            * (.5 + lobes * .65);
  let charCoverage = 1 - smoothstep(charDepth * .65, charDepth, burn);
  let stainCoverage = 1 - smoothstep(charDepth * .4, stainDepth, burn);

  // The rolled lip catches a little light, then falls into black carbon and
  // uneven brown scorching. This is surface shading, not displaced geometry.
  let ridge = exp(-pow((burn - 1.05) / .65, 2));
  let light = .35 + .65 * max(dot(normal, vec2f(-.6, -.8)), 0);
  let ashTone = vec3f(.19, .14, .095) * ridge * light * (.65 + grain * .35);
  let soot = vec3f(.012, .007, .004) + ashTone;
  let brown = mix(vec3f(.19, .073, .018), vec3f(.43, .25, .095), broad);
  let scorchAlpha = stainCoverage * (.85 + grain * .1) * contour;
  let carbonAlpha = charCoverage * contour;
  var result = vec4f(soot * carbonAlpha + brown * scorchAlpha * (1 - carbonAlpha),
                    carbonAlpha + scorchAlpha * (1 - carbonAlpha));

  // A second, slowly animated field controls which portions are still hot.
  // Keep the emission in narrow bands of the same burn front, not a neon outline.
  let heatNoise = fbm(p * .037 + seed + vec2f(params.x * .045, -params.x * .025));
  let heat = smoothstep(.49, .7, heatNoise);
  let pulse = .88 + .12 * sin(params.x * 2.2 + broad * 11);
  let hotWidth = (.7 + intensity * 3.3) * (.45 + heat);
  let hotBand = smoothstep(-aa, aa, burn)
              * (1 - smoothstep(hotWidth * .3, hotWidth, burn));
  let temperature = clamp(heat * pulse * (1 - max(burn, 0) / (hotWidth * 1.8)), 0, 1);
  var emberColor = mix(vec3f(.7, .035, .001), vec3f(1, .38, .006), smoothstep(.05, .55, temperature));
  emberColor = mix(emberColor, vec3f(1, .91, .48), smoothstep(.55, .9, temperature));
  let emberAlpha = hotBand * smoothstep(.08, .55, heat) * pulse;
  result = vec4f(emberColor * emberAlpha, emberAlpha) + result * (1 - emberAlpha);
  let crease = exp(-pow((burn - .55 - fibers * .35) / (.2 + intensity * .3), 2));
  let creaseAlpha = crease * smoothstep(.35, .8, heat) * pulse;
  result = vec4f(vec3f(1, .96, .72) * creaseAlpha, creaseAlpha) + result * (1 - creaseAlpha);
  let glow = exp(-pow(max(-burn, 0) / 1.4, 2)) * heat * .24
           * (1 - smoothstep(-.5, .8, burn));
  result += vec4f(vec3f(1, .2, .005) * glow, glow) * (1 - result.a);

  // Sparse ash flakes lift from upward-facing edges, remaining inside padding.
  let column = floor(p.x / 12);
  let reach = 22 * intensity;
  for (var neighbor = -1; neighbor <= 1; neighbor++) {
    let id = column + f32(neighbor);
    let random = hash(vec2f(id, params.y + 53));
    if (random > intensity * .28) { continue; }
    let age = fract(params.x * (.19 + random * .1) + hash(vec2f(id + 17, params.y)));
    let emitterX = (id + hash(vec2f(id, params.y + 9))) * 12;
    let drift = sin(age * 5 + random * 6) * age * 2.5;
    let dx = p.x - emitterX - drift;
    if (abs(dx) > 1.5) { continue; }
    let source = vec2f(emitterX, p.y + age * reach);
    let sourceField = field(source);
    let facing = smoothstep(.25, .8, -sourceField.z);
    let angle = random * 6.283185 + age * 2;
    let dy = sourceField.x;
    let q = vec2f(dx * cos(angle) - dy * sin(angle), dx * sin(angle) + dy * cos(angle));
    let flake = abs(q.x) + abs(q.y) * .65 - (.4 + random * .6);
    let ash = (1 - smoothstep(-aa, aa, flake)) * facing
            * smoothstep(.5, 1.5, distance) * smoothstep(0, .12, age)
            * (1 - smoothstep(.65, 1, age)) * .6;
    let ashColor = mix(vec3f(.8, .18, .025), vec3f(.39, .35, .3), smoothstep(0, .25, age));
    result = vec4f(ashColor * ash, ash) + result * (1 - ash);
  }
  return result * sqrt(intensity);
}`;
