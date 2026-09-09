---
name: domfx-typescript-engineering
description: Write, refactor, or review TypeScript in domfx with clear module ownership, safe types, explicit lifecycles, and behavior-based verification. Use for TypeScript implementation, API design, package organization, architecture decisions, and requests for engineering best practices or system design patterns in this repository.
---

# TypeScript engineering for domfx

## 1. Establish the contract

- Read `AGENTS.md`, `README.md`, `CONTRIBUTING.md`, `CONTEXT.md`, and
  `workspace-boundaries.mjs` at the repository root. They override this skill.
- Read the affected package exports, TypeScript configuration, nearby implementation,
  and tests. Work with the installed TypeScript version and existing tools.
- Use the linked issue for scope and acceptance criteria. If none exists, use the
  user's request and state the observable acceptance checks; do not invent an issue.
- State assumptions and a short implementation/verification plan. Resolve ambiguous
  capture, rendering, compositing, or animation contracts before changing behavior.
- For a design decision, identify the owner, inputs, outputs, invariants, resource
  lifetime, and failure behavior. Keep this proportional to the change.

## 2. Keep ownership and dependencies clear

- Put DOM/framework/GPU-independent contracts and computation in core. Put browser
  capture and GPU implementation in the browser package. Follow the boundary file
  for other packages; never scaffold planned packages merely because they appear there.
- Keep domain computation separate from DOM, GPU, timing, and I/O effects so it can
  be verified without a browser. Inject a small function or interface at a real
  external boundary when needed; do not introduce a dependency-injection framework.
- Group code by responsibility and what changes together. Split a module when it has
  unrelated responsibilities, not to satisfy an arbitrary line or function limit.
- Use exported package entry points across workspaces. Keep internal helpers private;
  do not expose implementation types or create catch-all utils/services modules.
- Prefer straightforward functions and composition. Use a class when it makes state
  ownership or resource lifetime clearer, not as a default container for functions.

## 3. Make TypeScript express the real contract

- Preserve strict checking. Use inference locally and explicit types at public
  boundaries where they clarify and stabilize the contract.
- Treat untrusted input as `unknown` and validate where it enters. Type assertions
  do not perform runtime validation. Do not repeat validation on already trusted data.
- Narrow with runtime checks and discriminated unions. Model mutually exclusive
  states as variants when optional fields or independent flags allow invalid states.
  Use exhaustive handling with `never` where all variants must be addressed.
- Avoid `any`, double assertions, non-null assertions, and suppression comments as
  shortcuts. If an external library requires an escape hatch, isolate it at the
  adapter, explain the invariant, and verify that boundary.
- Use generics only to express an actual relationship between inputs and outputs.
  Prefer readable concrete types to elaborate conditional types without a caller need.
- Use `readonly` to communicate ownership where useful; it is not runtime freezing.
  Avoid blanket cloning or immutability rules in performance-sensitive GPU paths.
- Follow the repository's named exports, type-only imports, ESM conventions, and
  naming rules. Do not change compiler settings or formatting tools as incidental cleanup.

## 4. Choose patterns for a concrete pressure

| Pressure in the requested change | Smallest useful approach | Avoid |
| --- | --- | --- |
| Browser or library behavior must be isolated | Adapter with a narrow contract | A universal backend/plugin framework |
| Multiple existing algorithms are interchangeable | Strategy function with the same input/output contract | A hierarchy for one implementation |
| Lifecycle combinations or transitions are invalid | Discriminated union and explicit transition logic | Unrelated booleans or a new state-machine dependency by default |
| Computation is difficult to test because of I/O | Pure calculation plus an effect-owning wrapper | Splitting every expression into a layer |
| Several resources share a lifetime | One clear owner with cleanup | Global singletons or hidden shared mutable state |

- Before adding a pattern, explain which present requirement it solves and why a
  plain function/module is insufficient. No requirement means no new abstraction.
- Apply single responsibility, dependency inversion, and information hiding through
  these decisions; do not impose enterprise folders, repositories, CQRS, or event buses.
- Extract shared code when callers share meaning and a reason to change. Similar
  syntax alone is insufficient; a little duplication can be clearer than coupling.

## 5. Make lifecycle and failure behavior observable

- Identify who creates and disposes listeners, observers, animation work, and GPU
  resources. Match the agreed contract for repeated disposal and partial setup failure.
- For async capture or refresh changes, specify how obsolete work is cancelled or
  ignored and how completion after disposal is handled. Verify out-of-order completion
  when concurrent requests are possible; do not silently choose a refresh policy.
- Handle expected environmental failures at the adapter boundary. Keep the original
  target usable when an effect is unavailable. Preserve useful error context rather
  than swallowing errors or reporting success after failure.
- Keep time/animation behavior compatible with the agreed seek and reverse contract.
  Measure performance changes against a relevant scenario; do not claim GPU correctness
  or performance from a typecheck or numerical unit test.

## 6. Verify and hand off a small change

- For a bug, add a regression that fails for the original behavior. For a feature,
  verify observable acceptance criteria, including applicable failure/lifecycle cases.
  For a refactor, preserve the behavior checks before and after.
- Test public behavior and invariants, not private call sequences or copied algorithms.
  Use independent numerical expectations for numerical work. Mock external boundaries
  only when needed; use browser checks for actual browser/GPU behavior.
- Follow `CONTRIBUTING.md` for formatting and linting; review any automatic fixes.
  Run `pnpm check` and `pnpm build:demo` before proposing code changes. For capture/GPU
  changes, also perform the documented development and preview browser checks.
- If a check cannot run, report the specific blocker and what remains unverified.
  Never substitute a passing build for a missing rendering check.
- Review the diff for scope, accidental public exports, dependency direction, and
  abstractions without current callers. Remove only unused code created by this change.
- Report the resulting behavior, the design choice if material, verification evidence,
  and remaining limitations. Follow release guidance for consumer-facing changes.

## Sources

Consult these primary sources when the relevant language or design detail is uncertain.
Use the project's installed version when current documentation describes newer features.

- [TypeScript narrowing](https://www.typescriptlang.org/docs/handbook/2/narrowing.html):
  runtime guards, discriminated unions, and exhaustive handling.
- [TypeScript generics](https://www.typescriptlang.org/docs/handbook/2/generics.html):
  relationships between types at function and API boundaries.
- [TypeScript modules](https://www.typescriptlang.org/docs/handbook/modules/theory.html):
  module behavior and resolution; preserve the repository's existing configuration.
- [YAGNI](https://martinfowler.com/bliki/Yagni.html): defer speculative capability
  while maintaining code that can be changed safely.
