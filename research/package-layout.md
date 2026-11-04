# Package layout and npm naming for framework bindings

Issue: G0m1namm/domfx#202. Date: 2026-11-03. Repo revision: `40c114efdc9deb5f401644f9dd386d6f8d7c1cb1` (main, after alpha.2 docs).
Reader: maintainer deciding the layout before any React/Vue binding exists.
Method: primary sources (npm and Node docs, TypeScript handbook, webpack docs) and `npm view` of live registry manifests on 2026-11-03.
Limits: no SSR or bundler experiment was run here; tree-shaking and SSR points are from docs and manifests, not measurement. Name availability is a point-in-time `npm view` 404, not a reservation.

## Verified facts

### Current domfx packages (repo `packages/*/package.json`)

- `@domfx/core` 0.1.0-alpha.2: no dependencies, single `.` export.
- `@domfx/browser` (dir `packages/domfx`): deps `@domfx/core`, `typegpu`, `@typegpu/sdf`, `@zumer/snapdom`, `@floating-ui/dom`; exports `.` and `./experimental`. No `sideEffects` field.
- `@domfx/gsap`: dep `@domfx/core`; `gsap ^3.15.0` is a required peer (no `peerDependenciesMeta`).
- All are ESM-only (`"type": "module"`, only `types` + `import` conditions), `files: ["dist"]`.
- Registry: `@domfx/browser` dist-tag `latest` is `0.1.0-alpha.0` while tag `alpha` is `0.1.0-alpha.2` (so a plain `npm i @domfx/browser` installs alpha.0). Maintainer `g0m1namm`.

### Names (npm view, 2026-11-03)

- `domfx`: exists, v0.3.5, modified 2022-06-15, maintainer `jsteinbeck`. Taken.
- 404 (currently unpublished): `@domfx/react`, `@domfx/vue`, `@domfx/solid`, `@domfx/svelte`, `domfx-js`, `domfx-react`, `domfx-gsap`, `domfx-fx`, `dom-fx`, `domfx.js`, `getdomfx`, `usedomfx`, `@domfx/vue3`, `@domfx/domfx`.
- The `@domfx` scope is owned by the maintainer, so any `@domfx/*` name is under their control. Unscoped candidates are only free until someone publishes them.

### npm policy (https://docs.npmjs.com/policies/disputes)

- Names are "first-come, first-served basis, and are intended for immediate and active use."
- "npm does not resolve squatting claims on demand." "We do not transfer package, organization, or username ownership simply because another user wants the name."
- Trademark claims follow GitHub's Trademark Policy; the formal name-dispute process on GitHub is "the only path we act on."
- Reserving a name "simply for the purposes of reserving it for future use" violates the Terms of Use.
- The page describes no process for acquiring an inactive but legitimate package, and does not mention contacting the owner. So 2022 inactivity alone is not a documented route to `domfx`.

### Node exports (https://nodejs.org/api/packages.html)

- Subpaths are declared in `"exports"`; once defined, all other subpaths are encapsulated (`ERR_PACKAGE_PATH_NOT_EXPORTED`).
- Condition order is significant (most specific first); `"types"` "should always be included first".
- A package can self-reference its own name via `exports`.
- `sideEffects` is not a Node feature.

### TypeScript (https://www.typescriptlang.org/docs/handbook/modules/reference.html)

- `node16`/`nodenext`/`bundler` follow `exports`; subpaths not listed do not resolve.
- `node10` does not read `exports` (feature table). It resolves package-relative files and honours `typesVersions`; `typesVersions` is not read where `exports` is read.
- Consequence: `domfx/react` types resolve under modern modes without extra work. Under legacy `node10` consumers they fail unless `typesVersions` or a physical `react/package.json` stub is added. This repo's own `@domfx/browser/experimental` has the same property today.

### npm peer dependencies (https://docs.npmjs.com/cli/v10/configuring-npm/package-json)

- npm 7+ installs peers by default; `peerDependenciesMeta.<name>.optional` stops auto-install of that peer.
- Optional peers are what let one package expose `react` and `vue` subpaths without forcing either framework.

### Tree-shaking (https://webpack.js.org/guides/tree-shaking/)

- `"sideEffects": false` is a module-level hint: a module whose exports are unused can be skipped, with its subtree. Separate subpath entries add a second mechanism: a bundler never loads an entry that is not imported.
- Without the flag, a barrel re-exporting framework code can still be evaluated.

### How comparable libraries ship (manifests from registry, versions as of 2026-11-03)

| Library                             | Layout                                                                                                 | Framework peers                                                                                     | Notes                                                                                                                                                       |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `motion` 14.9.0 / `framer-motion`   | One package, many subpaths (`./react`, `./mini`, `./three`, `./react-client`, `./remix`...)            | `react`, `react-dom`, `remix` all optional via `peerDependenciesMeta`                               | `sideEffects: false`; core logic in separate `motion-dom`/`motion-utils` packages                                                                           |
| `@tanstack/*-query` 5.105.3         | Separate packages: `query-core` (no peers) + `react-query`, `vue-query`, `solid-query`, `svelte-query` | Framework is a required peer of each binding; core is a pinned dep (`@tanstack/query-core` 5.105.3) | `sideEffects: false`; adapters version in lockstep with core; single `.` export each                                                                        |
| `@floating-ui/*`                    | `core` -> `dom` -> `react-dom` -> `react`, plus `vue`                                                  | Framework required peer of each binding; `react-dom` depends on `dom` with caret                    | `sideEffects: false`; `@floating-ui/react` also has `./utils` subpath; bindings version independently (react 0.27.x, react-dom 2.1.x, vue 2.0.x, dom 1.8.0) |
| `gsap` 3.15.0 + `@gsap/react` 2.1.2 | Core package plus separate React helper package; gsap has wildcard subpath exports (`./*`) for plugins | `@gsap/react` peers `gsap` and `react` (required)                                                   | `gsap` `sideEffects: false`; `@gsap/react` does not use `exports`                                                                                           |
| `@react-three/fiber` 9.8.2          | Separate scoped React renderer; `three` is peer                                                        | `three`, `react` required; `react-native`, `expo*`, `react-dom` optional                            | `sideEffects: false`; no `exports` map                                                                                                                      |

Pattern: the two real-world approaches both exist. Single-package-with-subpaths (motion) uses optional peers. Separate packages (TanStack, Floating UI, R3F, GSAP) keep a framework-free core and require the framework peer in each binding. Every library above sets `sideEffects: false`.

## Comparison for domfx

| Concern               | Separate scoped packages (`@domfx/react`)                                                                                               | One package with subpaths (`domfx/react`)                                                                                                                                                        |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Optional peers        | Natural: React is a plain peer of `@domfx/react`; nobody else sees it.                                                                  | Needs `peerDependenciesMeta` optional entries for every framework (and `gsap`). Package managers will not warn if a user imports `domfx/react` without React.                                    |
| TS resolution         | One `.` export per package; works in every `moduleResolution`, including `node10`.                                                      | Needs `exports` subpaths; fails under `node10` without `typesVersions` or stubs.                                                                                                                 |
| Tree-shaking          | Unused binding is never installed.                                                                                                      | Fine with `sideEffects: false` plus separate entries, but domfx has no `sideEffects` field today and depends on typegpu and snapdom, so a missing flag or top-level side effect would weaken it. |
| SSR import safety     | Each package controls its own entry; the browser package already is the only one touching DOM/GPU.                                      | Same risk per entry, but a shared root `domfx` entry would make it easier to import browser code from a server file by accident. Not measured here.                                              |
| Versioning            | Independent versions possible (Floating UI) or lockstep (TanStack). More release work and a compatibility matrix with `@domfx/browser`. | One version, one release; every framework fix bumps everything.                                                                                                                                  |
| Migration             | Name is already owned (`@domfx` scope); existing `@domfx/browser`, `core`, `gsap` need no rename.                                       | Needs a new unscoped name; existing packages become a rename or deprecation path. Unscoped `domfx` is not available.                                                                             |
| Fit with current repo | Matches the existing `@domfx/gsap` pattern and `workspace-boundaries.mjs` style (one directory per package).                            | Would merge `core`, `browser`, `gsap` or add a facade package.                                                                                                                                   |

## Recommendation (maintainer decides)

1. Keep separate scoped packages: `@domfx/react`, `@domfx/vue` when they exist. They match the existing `@domfx/gsap` shape, avoid optional-peer pitfalls, resolve under every TypeScript mode, and the names are free under a scope the maintainer owns. This is the TanStack/Floating UI/R3F approach.
2. Do not pursue unscoped `domfx`. npm documents no route for inactive names and does not transfer ownership because someone wants a name; the only action path is a trademark or formal dispute, which this project does not obviously qualify for. Contacting the owner is out of scope here.
3. If a short install name is wanted later, publish a thin unscoped alias (for example `domfx-js` or `usedomfx`, currently free) that re-exports `@domfx/browser`. Treat this as optional marketing, not layout.
4. Cheap hardening regardless of choice: add `"sideEffects": false` to the three packages after confirming no module has import-time effects, and decide whether `@domfx/gsap` should keep gsap as a required peer (all comparables keep it required for dedicated adapters).
5. Subpaths remain the right tool for same-concern variants inside one package (as `@domfx/browser/experimental` already does), not for frameworks with different peers.
6. Separate: `latest` for `@domfx/browser` points to alpha.0 while the `alpha` tag has alpha.2. Worth checking against the release plan; not part of this question.

Switch to the single-package option if the maintainer values one install name and one version over clean peer dependencies; the cost is optional-peer handling, `node10` type shims and a rename of existing packages.

## Sources

- npm disputes: https://docs.npmjs.com/policies/disputes
- npm package.json: https://docs.npmjs.com/cli/v10/configuring-npm/package-json
- Node packages: https://nodejs.org/api/packages.html
- TypeScript modules reference: https://www.typescriptlang.org/docs/handbook/modules/reference.html
- webpack tree shaking: https://webpack.js.org/guides/tree-shaking/
- Registry manifests via `npm view <name> --json` on 2026-11-03: motion, framer-motion, motion-dom, gsap, @gsap/react, @tanstack/{query-core,react-query,vue-query,solid-query,svelte-query}, @floating-ui/{core,dom,react,react-dom,vue}, @react-three/fiber.
- Repo: `packages/{core,domfx,gsap}/package.json` at the revision above.
