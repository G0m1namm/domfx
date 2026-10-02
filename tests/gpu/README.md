# Private GPU regression fixtures

The website (`pnpm demo`) is the public examples and development surface. This
private workspace contains small pages needed to reproduce capture, resource,
async ordering and lifecycle failures. It has no gallery/navigation or publishing role.

- `pnpm test:gpu`: ten production smoke cases.
- `pnpm test:gpu:full`: the full development/production suite, including long observations.
- `pnpm build:gpu`, then `pnpm --filter @domfx/gpu-tests exec playwright test <spec>`:
  focused local investigation.
- `pnpm --filter @domfx/gpu-tests exec vite --host 127.0.0.1`: inspect a fixture directly.

Tests consume compiled package exports. Independent numerical oracles stay here,
outside consumer runtime. The repository's fast `pnpm check` includes the numerical,
memory-ledger and GSAP adapter unit tests; it does not execute WebGPU.

See [browser verification](../../engineering/browser-verification.md) for evidence,
backends, visual testing and release requirements. Missing hardware is not a pass.
