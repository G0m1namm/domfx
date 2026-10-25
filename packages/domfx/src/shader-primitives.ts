/** Exact shared WGSL. Callers retain their original coordinate/noise variants. */
export const fullscreenVertex = `
@vertex fn vertex(@builtin(vertex_index) index: u32) -> @builtin(position) vec4f {
  let positions = array<vec2f, 3>(vec2f(-1, -1), vec2f(3, -1), vec2f(-1, 3));
  return vec4f(positions[index], 0, 1);
}
`;

export const rasterDistance = `
fn field(p: vec2f) -> f32 {
  let size = vec2i(textureDimensions(distances));
  let q = p - .5;
  let base = vec2i(floor(q));
  let blend = fract(q);
  let a = textureLoad(distances, clamp(base, vec2i(0), size - 1), 0).r;
  let b = textureLoad(distances, clamp(base + vec2i(1, 0), vec2i(0), size - 1), 0).r;
  let c = textureLoad(distances, clamp(base + vec2i(0, 1), vec2i(0), size - 1), 0).r;
  let e = textureLoad(distances, clamp(base + vec2i(1, 1), vec2i(0), size - 1), 0).r;
  return mix(mix(a, b, blend.x), mix(c, e, blend.x), blend.y) / params.w;
}
`;

export const scalarHash = `
fn hash(p: vec2f) -> f32 {
  var q = fract(vec3f(p.x, p.y, p.x) * vec3f(.1031, .1030, .0973));
  q += dot(q, q.yzx + 19.19);
  return fract((q.x + q.y) * q.z);
}
`;

export const gradientDirections = `
fn gradient(p: vec2f) -> vec2f {
  let direction = u32(hash(p) * 8);
  var g = vec2f(1, .5);
  if ((direction & 1u) != 0u) { g = g.yx; }
  g *= vec2f(select(1.0, -1.0, (direction & 2u) != 0u),
             select(1.0, -1.0, (direction & 4u) != 0u));
  return g * .8944272;
}
`;

export const gradientNoise = `
fn noise(p: vec2f) -> f32 {
  let cell = floor(p);
  let f = fract(p);
  let u = f * f * f * (f * (f * 6 - 15) + 10);
  let a = dot(gradient(cell), f);
  let b = dot(gradient(cell + vec2f(1, 0)), f - vec2f(1, 0));
  let c = dot(gradient(cell + vec2f(0, 1)), f - vec2f(0, 1));
  let e = dot(gradient(cell + vec2f(1, 1)), f - vec2f(1, 1));
  return .5 + mix(mix(a, b, u.x), mix(c, e, u.x), u.y) * .8;
}
`;

export const cssDistanceGradient = `
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
`;

export const vectorHash = `
fn hash(p: vec2f) -> f32 {
  var q = fract(vec3f(p.x, p.y, p.x) * vec3f(.1031, .1030, .0973));
  q += vec3f(dot(q, q.yzx + vec3f(19.19)));
  return fract((q.x + q.y) * q.z);
}
`;

export const valueNoise = `
fn noise(p: vec2f) -> f32 {
  let cell = floor(p);
  let f = fract(p);
  let u = f * f * (3 - 2 * f);
  return mix(mix(hash(cell), hash(cell + vec2f(1, 0)), u.x),
             mix(hash(cell + vec2f(0, 1)), hash(cell + vec2f(1, 1)), u.x), u.y);
}
`;

export const effectBindings = `
@group(0) @binding(0) var distances: texture_2d<f32>;
@group(0) @binding(1) var<uniform> params: vec4f;
struct EffectControls {
  material: vec4f,
  color: vec4f,
}
@group(0) @binding(3) var<uniform> controls: EffectControls;

fn applyEffectColor(input: vec4f) -> vec4f {
  if (controls.color.w == 0 || input.a == 0) { return input; }
  let source = input.rgb / input.a;
  let lightness = (max(max(source.r, source.g), source.b)
                 + min(min(source.r, source.g), source.b)) * .5;
  let selected = controls.color.rgb;
  let recolored = select(selected * (2 * lightness),
                         mix(selected, vec3f(1), 2 * lightness - 1), lightness > .5);
  return vec4f(recolored * input.a, input.a);
}
`;
