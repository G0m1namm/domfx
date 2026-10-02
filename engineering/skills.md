# Specialist engineering skills

Load the skills needed by a change rather than the full catalog. The general
TypeScript skill and `HARNESS.md` continue to govern scope and verification.

| Area                 | Skill                                                                                     | Responsibility                                                                                              |
| -------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Architecture review  | [improve-codebase-architecture](../.agents/skills/improve-codebase-architecture/SKILL.md) | User-invoked review of architectural friction, visual candidates, and selected refactoring opportunities    |
| Architecture design  | [codebase-design](../.agents/skills/codebase-design/SKILL.md)                             | Required vocabulary and design guidance for the architecture review skill                                   |
| GPU and shaders      | [domfx-gpu-engineering](../.agents/skills/domfx-gpu-engineering/SKILL.md)                 | TypeGPU/WGSL contracts, layouts, pass ordering, numerical correctness, resources, device loss, and readback |
| Browser integration  | [domfx-browser-engineering](../.agents/skills/domfx-browser-engineering/SKILL.md)         | Capture fidelity, geometry, compositing, observers, accessibility, scheduling, and cleanup                  |
| Animation API        | [gsap-core](../.agents/skills/gsap-core/SKILL.md)                                         | Official tween, easing, playback, and media-query guidance                                                  |
| Animation sequencing | [gsap-timeline](../.agents/skills/gsap-timeline/SKILL.md)                                 | Official timeline composition, positioning, and playback guidance                                           |

For cross-boundary changes, use both GPU and browser skills. GSAP stays in the examples/fixtures
or its future optional adapter, never the independent core or browser package.
Upstream examples are API references: apply our TypeScript style, explicit ownership,
and dependency rules. Do not introduce plugins, global defaults, broad style cleanup,
or changes to original target visibility simply because an example recommends them.
References to other GSAP skills are optional; they are not installed by this set.

## Provenance

Added 2026-09-28. `improve-codebase-architecture` and its required `codebase-design`
helper are unmodified skill bundles from
[Matt Pocock's skills repository at c55ee46073ed923f86ce59a5eb3b6d895095d1b7](https://github.com/mattpocock/skills/tree/c55ee46073ed923f86ce59a5eb3b6d895095d1b7/skills/engineering).
Each folder includes the upstream MIT `LICENSE` and Codex UI metadata. The review
also uses the existing `grilling` and `domain-modeling` skills. Repository scope,
dependency boundaries, design guidance, and verification contracts take precedence.
Optional ignored ADRs may inform a review, but required decisions belong in the
issue or tracked contributor guidance. Retain the license and review upstream
changes when updating these pinned skills.

Reviewed 2026-09-08. `domfx-gpu-engineering` and `domfx-browser-engineering` are
original project guidance with primary references, covered by the project license.

`gsap-core/SKILL.md` and `gsap-timeline/SKILL.md` are unmodified files from
[GreenSock's skills repository at aed9cfd3277740755f6bfc1155c7aa645403b760](https://github.com/greensock/gsap-skills/tree/aed9cfd3277740755f6bfc1155c7aa645403b760).
Each folder includes GreenSock's MIT `LICENSE` and local Codex UI metadata.
Their MIT license applies to the skill text, not to the GSAP runtime library.
Review changes and retain these notices when updating the pinned skills.

The [official TypeGPU skill](https://github.com/software-mansion-labs/skills/blob/fed69f566b78d3289b6f00e4bccc1d4a696ffde3/skills/typegpu/SKILL.md)
targets TypeGPU 0.12 and is linked by [TypeGPU's AI tools documentation](https://docs.swmansion.com/TypeGPU/tooling/ai-tools/).
No redistribution license was found in the inspected skills repository at that revision,
so it is a reference only; its text and reference bundle are not vendored here.

We also considered [cazala/webgpu-skill](https://github.com/cazala/webgpu-skill) and
[dgreenheck/webgpu-claude-skill](https://github.com/dgreenheck/webgpu-claude-skill).
The former overlaps the focused GPU guidance; the latter centers on Three.js/TSL,
which is not domfx's rendering stack. Neither is installed.

## Agent integration

The source of truth is `.agents/skills`, using standard `SKILL.md` files. Codex can
discover these project skills; `AGENTS.md` routes work to the relevant ones. A client
that discovers only its own skill directory needs its normal import/link setup to
read these same files. Do not maintain a second independently edited copy.

These skills guide decisions. The harness enforces executable checks, including the
[development/production browser suite](browser-verification.md). Broader device and
behavior coverage remains specific to the change being made.
