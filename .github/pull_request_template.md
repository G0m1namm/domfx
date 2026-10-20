## Why

Related issue and intended result:

## Changes

Owning module, contract/API impact, and reason for any new abstraction or dependency:

## Verification

- [ ] PR title follows Conventional Commits (`type(scope): description`).
- [ ] Routine verification passes (`pnpm agent:verify`, or `pnpm check` and `pnpm test:web:smoke` for contributors without an agent harness; proves repository/build/no-GPU website usability).
- [ ] Behavior changes include an observable regression test.
- [ ] UI changes follow [UI conventions](https://github.com/G0m1namm/domfx/blob/main/engineering/ui-conventions.md); report its review results or why not applicable.
- [ ] Capture, rendering, or lifecycle changes include applicable real-GPU fixture evidence (using package-private `tests/gpu` or website examples on a WebGPU device).
- [ ] No generated files, local notes (`.scratch/`, `PROJECT_CONTEXT.md`, local `docs/`), credentials, or unrelated changes are included (package-private test fixtures are public in Git; never commit secrets).

## Evidence and notes

Automated results (`pnpm agent:verify` report or CI check output), real-GPU evidence when applicable (or explicit statement why not applicable), and design review findings/resolution:

Limitations or follow-up work:
