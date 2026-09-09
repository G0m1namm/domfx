# Shader and data rules

- Record exact buffer member offsets, alignment, struct size, array stride, and binding
  size for CPU/GPU shared data. Prefer TypeGPU layout utilities over hand-packed numbers.
  A WGSL `vec3<f32>` has size 12 and alignment 16; this does not mean every following
  member or every struct occupies 16 bytes. Uniform address-space constraints also matter.
- Ensure host writes match shader scalar types and padding. Verify normalized versus
  integer/float texture formats, sample type, storage access, and usage flags together.
- Distinguish raster pixels, CSS pixels, texel coordinates, UVs, and clip space. Specify
  pixel-center sampling and origin. Carry DPR conversions explicitly and apply them once.
- Preserve straight versus premultiplied alpha at each interface. Align shader output,
  blend factors, canvas alpha mode, and color space; do not multiply alpha twice.
- Guard out-of-range invocations without making required workgroup barriers divergent.
  All participating invocations must reach barriers uniformly; a workgroup barrier
  does not synchronize separate workgroups. Separate passes when global ordering is needed.
- Use separate source/destination resources when an algorithm reads the previous field
  while producing a new one. Do not assume parallel in-place neighbor updates are deterministic.
- Guard zero divisors, invalid normalization, and array/texture bounds according to the
  algorithm. Do not use WGSL `select` as short-circuit protection for an unsafe expression.
- Preserve the seed/time contract for procedural effects. Verify seek and reverse at
  identical input values; do not substitute accumulated frame deltas for absolute time.
- Distinguish `shader-f16` arithmetic support from half-float texture storage. Request
  optional features only when used and verify the granted device capabilities.
- For texture/buffer copies, calculate pitch and offsets for that exact API. Encoder
  buffer/texture copies and `queue.writeTexture` do not share every row-alignment rule.
- Check the generated shader and a numerical/visual fixture after changes to bindings,
  shader signatures, precision, workgroup sizes, or coordinate conversions.

References: [WGSL memory layout](https://www.w3.org/TR/WGSL/#memory-layout),
[WGSL uniformity](https://www.w3.org/TR/WGSL/#uniformity),
[copyTextureToBuffer](https://developer.mozilla.org/en-US/docs/Web/API/GPUCommandEncoder/copyTextureToBuffer),
[writeTexture](https://developer.mozilla.org/en-US/docs/Web/API/GPUQueue/writeTexture).
