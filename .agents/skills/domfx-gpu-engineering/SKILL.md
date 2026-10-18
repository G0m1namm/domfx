---
name: domfx-gpu-engineering
description: Implement, debug, and review domfx GPU rendering and compute code, TypeGPU use-gpu functions, raw WGSL shaders, signed distance fields, textures, buffers, readback, and device/resource lifecycles. Use for GPU validation errors, shader artifacts, memory growth, precision, pass ordering, and rendering performance. Pair with domfx-browser-engineering when presentation or capture geometry changes.
---

# domfx GPU engineering

Follow the root `AGENTS.md`, `CONTRIBUTING.md`, `GLOSSARY.md`, and `HARNESS.md`.
Use the TypeScript engineering skill for general code rules; this skill adds GPU checks.

## Establish the GPU contract

- Inspect `packages/domfx/src/gpu.ts`, its callers, package versions, the lockfile,
  and build configuration. Read the affected TypeGPU declarations/source when an API
  is uncertain. Do not copy newer examples or run an upgrade/scaffolder incidentally.
- Keep TypeGPU transformation in the browser package. Preserve the lab's use of built
  exports. Do not introduce Three.js, TSL, GLSL, React, or operator-overloading tooling
  merely because an external example uses them.
- Before changing a pass, list its inputs/outputs, sizes/formats, bindings, units,
  read/write ownership, ordering, resource budget, and the observable expected result.
- Keep DOM/layout reads outside GPU code. Treat `CaptureFrame` as the input contract;
  changing its coordinates, padding, alpha classification, or distance convention
  requires resolving the contract with the caller first.

## Author and diagnose shaders

- Read [shader-rules.md](references/shader-rules.md) for shader or buffer-layout changes.
- Use the project's established TypeGPU schema and math APIs for typed GPU functions.
  Keep existing raw WGSL interfaces where needed; do not rewrite working shaders solely
  for stylistic uniformity. CPU closure mutation is not a runtime shader uniform.
- Label shader modules, pipelines, and resources meaningfully. Inspect compilation
  messages and validation errors in the actual browser. TypeScript cannot validate a
  WGSL string or prove that the translated shader is correct.
- Localize a failure: capture pixels → classified mask → distance field → effect output
  → presentation. Inspect the earliest incorrect stage before changing later stages.

## Own resources and asynchronous work

- Identify the owner of the device/root and every texture, buffer, prepared frame,
  and pending readback. Wrapping an existing device does not transfer ownership of
  the caller's device. Verify root cleanup semantics against the installed TypeGPU API.
- Handle partial initialization and completion after disposal. A late prepare/readback
  result must not resurrect a disposed owner or leak allocations. State the agreed
  cancellation/stale-result policy before implementing it.
- Handle missing adapters, requested device limits/features, validation failures,
  and device loss as unavailable-effect paths. Stop scheduling work on a lost device;
  recovery policy is a product contract, not an automatic infinite retry loop.
- Balance error scopes and keep concurrent operations from consuming each other's
  scopes. Release owned resources on failure as well as normal disposal.
- Reuse stable GPU resources. Allocate/rebuild when size, format, or bindings change;
  avoid per-frame pipeline creation. Account for all retained allocations in budgets.
- Keep diagnostic readbacks bounded and out of the steady render loop. Copy mapped
  data into owned CPU storage before unmapping; clean up staging buffers on failure.
  Distinguish queue submission time from GPU execution time when profiling.

## Verification and handoff

- For numerical changes, compare against an independent oracle in the lab. Cover holes,
  disconnected regions, threshold edges, odd dimensions, empty/full masks, and precision
  limits relevant to the change. Use a justified tolerance, not an unexplained epsilon.
- For lifecycle changes, exercise partial failure, resize/reprepare, disposal during
  pending work, repeated disposal, and unavailable/lost-device behavior as applicable.
- Run `pnpm agent:verify` and the development/production browser checks required by
  `CONTRIBUTING.md`. Record browser/GPU, dimensions/DPR, diagnostics, and observed output.
- Report correctness and lifecycle defects before optimizations. Name unverified paths;
  never infer GPU success from a green build or CPU test.

## Primary references

Consult the relevant section when needed; compare current docs with installed versions.

- [TypeGPU roots](https://docs.swmansion.com/TypeGPU/apis/roots/): ownership and cleanup.
- [TypeGPU functions](https://docs.swmansion.com/TypeGPU/apis/functions/): typed GPU code.
- [WebGPU API](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API): capabilities
  and API entry points.
- [WGSL specification](https://www.w3.org/TR/WGSL/): shader semantics and layout.
