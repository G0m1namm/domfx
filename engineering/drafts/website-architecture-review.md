# Website architecture review — 2026-10-19

Survey of `apps/web` and how it uses `packages/*`, run on main `c74bc3a` with the
`improve-codebase-architecture` workflow. It focused on the areas changed by #122 and #123.
It leaves out SEO/metadata (#124), the docs platform move (#125), GPU effect-program
internals (#121, ADR-0001), capture-revision ownership (#84) and typed error codes (#54).

## Selected

**01 · Concentrate effect instance lifetime in one shared effect slot** (Strong, ports & adapters).
Decisions and acceptance checks are in [#127](https://github.com/G0m1namm/domfx/issues/127)
and the [original design](effect-slot-issue.md). The issue retains this complete survey.
It is blocked by #125's shared-site-package and content-migration slices.

## Not yet explored

**02 · Let the effect catalog carry each effect's options shape** (Worth exploring, in-process)

- **Where:** `content/effects.ts`, `content/effect-reference.ts`, `pages/docs/api/effects/[effect].astro` 18–57, `DocsEffectLab.astro` 19–27, `docs-effect-lab.ts` 113, `examples.ts` 8 and 37.
- **Problem:** the docs pages added in #123 branch on effect ids in about five places (`effect.id === 'fire'`). They also derive the options type name with an unchecked rule (`Pattern && id !== 'dither' ? 'PatternOptions' : …`), and restate the `flameHeight` range already defined in `fire-options.ts`.
- **Idea:** catalog records carry the options type name, effect-specific creation options with their ranges, and the reference copy. They are type-checked against the package's attachment signatures, and the shallow `effect-reference.ts` sidecar is deleted.
- **Note:** this builds on #121 slice 1 and does not redo it. Under #125 the catalog moves to the shared site package.

**03 · One attachment-snippet module behind every code disclosure** (Worth exploring, in-process)

- **Where:** seven code generators: `examples.ts`, `marketing-story.astro` 4–23, `marketing.ts` 561–564, `[effect].astro` 23–36, `api.astro`, `gsap.astro`, and the lab's markup plus `docs-effect-lab.ts` 68–77.
- **Problem:** only two of the seven are executed, by `documentation.spec.ts` 422–547. The homepage copy button emits the legacy `clock: 'ambient'` spelling.
- **Idea:** one pure `(effect, settings) → code` module, so the existing rendered-disclosure execution test can cover every snippet. It pairs well with 02.

**04 · Pull the pattern cycle out of the marketing closure** (Worth exploring, in-process)

- **Where:** `marketing.ts` intensity curve 117–129, per-frame `data-*` writes 145–153, tick/advance 843–890, zoom/pan 567–600, and the module-global `savedPattern`.
- **Idea:** a pure pattern-cycle module whose `advance(dt)` returns `{ effect, time, intensity, switched }`, so tests don't have to read per-frame DOM attributes.
- **Caveats:** this gets simpler after 01. Any per-frame DOM writes it removes must respect #86's attribution caveats.

**05 · Make API-reference tables answer to package types** (Speculative)

- **Where:** `docs-effect-state.astro`, `docs-shared-options.astro`, `docs-effect-controls.astro` and `docs-gsap-bindings.astro` restate package TSDoc. `troubleshooting.md` lists the 17 `EffectReason` codes with nothing enforcing the list.
- **Idea:** key the reference row records by the package types, so that drift becomes a type error.
- **Caveat:** the payoff grows only after the alpha (#91).

## Observed, not candidates

- `docs-search.ts` is a pass-through for the pagehide/pageshow idiom. 01 replaces it with a shared page-lifetime helper.
- The single-use components `docs-effect-index`, `docs-effect-state` and `docs-gsap-bindings` fail the deletion test.
- `documentation.spec.ts` 423 sets `sessionStorage 'domfx-playback'`, and nothing reads it.
- The search index is built by regex-parsing page sources inside `site-search.astro`. #125 replaces it with Pagefind.
