# refactor(web): concentrate effect instance lifetime in one shared effect slot

> Canonical issue: [#127](https://github.com/G0m1namm/domfx/issues/127). Labels: `enhancement`, `ready-for-agent`, `blocked`. Agreed with the maintainer on 2026-10-19 (architecture review, candidate 01).

## Problem

Every effect target on the website re-implements the lifetime of its effect instance. On main `c74bc3a` there are five hand-written copies:

- `apps/web/src/scripts/marketing.ts`: `showHeaderEffect` (157–194), `attachCard` (249–305), `attachClosingEffects` (455–496), `showDialogEffect` (666–725), plus the `visibilitychange` block (812–841)
- `apps/web/src/scripts/docs-effect-lab.ts`: `attach` (119–184)

Each copy repeats the same steps:

- bump a revision and dispose the previous handle
- gate on WebGPU, reduced motion, the Resume latch and `document.hidden`
- lazily import `@domfx/browser` and wait for fonts (only two copies also decode images)
- re-check the revision before and after `ready`
- write a status, and map any failure to `unavailable`

The copies already disagree:

- **Hidden page:** marketing disposes every handle when the page is hidden and re-attaches when it is shown. The lab never listens for visibility and instead retries once after `stale-raster` (163).
- **Status:** marketing writes the handle's `lifecycle` into `data-status`. The lab writes its own states and raw reason codes into `data-status`, and `error.message` into `data-reason`.
- **Back/forward cache:** the lab disposes on `pagehide` (309) and has no `pageshow` re-init. `marketing.ts` (918–923) and `docs-search.ts` both have one, so the lab is likely inert after a back/forward-cache restore. This is inferred from the code and not yet reproduced.

#85 concentrated this ownership in `apps/web/src/scripts/effect-targets.ts`, with direct node tests. #122's redesign deleted both, so `apps/web` currently has no unit tests. Under #125 the docs lab moves to `apps/docs`, so both apps need the same lifetime behaviour.

## Decisions

These were agreed with the maintainer in an architecture review. A deep module here means a small interface hiding the ordering and race handling.

1. **The slot owns one effect instance's lifetime, and nothing else:**
   - supersession of older requests and rejection of late completions
   - the lazy browser-package load
   - font and image readiness (the target plus descendant `img` elements, as #85's `prepareTarget` did)
   - the render gate
   - disposal
   - one status value

   Callers keep External control (time/intensity writes, the pattern cycle) and every piece of visible UI: status sentences, buttons, zoom.

2. **One slot per host.** The card grid keeps its own IntersectionObserver and holds a `Map<target, slot>`. There is no slot set.
3. **Hidden-page policy:** dispose when the page is hidden, and re-run the last `show()` when it is visible again. This is the homepage's current behaviour, and the lab adopts it. The lab's one-shot stale retry is removed. The library's `retry()` is not adopted here.
4. **Reduced-motion latches stay with callers.** Each Resume latch is part of a caller-built environment (see 7). Today the page has two: patterns/cards, and the dialog. The lab has none.
5. **One status vocabulary on the host:**
   - `data-status`: one of `initializing | active | suspended | unavailable` (the effect instance lifecycle, not Capture status)
   - `data-reason`: only a library `EffectReason` code
   - no WebGPU → `unavailable` + `no-webgpu`; gated motion → `unavailable` + `reduced-motion`
   - the lab's `paused` state moves to a separate attribute, because pause is a control rather than a status

   Update the CSS selectors (`documentation.css` 614–624, or their moved copy) and the spec assertions to match.

6. **Interface (shape agreed; names may be refined in implementation):**
   ```ts
   const slot = createEffectSlot({ host, environment, loader });
   slot.show(target, effect, () => options); // replaces any current or pending instance
   slot.clear();                              // releases; late completions are dropped
   slot.handle;  // committed EffectHandle after ready, else undefined
   slot.status;  // { lifecycle, reason?: EffectReason }
   slot.dispose();
   ```
   - `options` is evaluated on every (re)attach, so a re-attach after the page was hidden reads the caller's current Effect time. The slot holds no time of its own, which replaces the dialog's grab of `dialogHandle.time` before disposal (marketing.ts 826).
   - Callers use `slot.handle` for the library's own controls (pause, time, intensity).
7. **Environment port:** `{ canRender(): boolean; onChange(cb): unsubscribe }`.
   - Each environment combines GPU presence, the reduced-motion query, `document.hidden` and its own Resume latch.
   - The slot disposes when `canRender()` turns false and re-runs its last `show()` when it turns true.
   - Two adapters: the browser environment in production and a fake with a manual `emit()` in tests. The loader port likewise has two adapters: the real lazy `@domfx/browser` import, and a recording/deferred fake.
8. **Location:** the private shared site package created by #125, not `@domfx/browser`. The slot's policies are website choices rather than library contracts. A small page-lifetime helper (`pagehide` disposes; a persisted `pageshow` re-initializes) lives there too. Marketing, the lab and site search use it, and the pass-through `docs-search.ts` is deleted.
9. **Delivery:** one ticket. Migrating only half the call sites would leave two policies in place.

## Acceptance checks

- [ ] One slot module in the shared site package owns everything in decision 1. The header, closing wordmark, cards, dialog and docs lab no longer manage revisions, pending flags, readiness waits or handle disposal themselves. Moving the existing closures unchanged does not satisfy this check.
- [ ] Hidden-page, reduced-motion and back/forward-cache behaviour follows decisions 3, 4 and 8 on both the homepage and the docs lab. A docs lab restored from the back/forward cache returns to `active`.
- [ ] The status attributes follow decision 5 everywhere. User-facing text, approved appearance and controls are unchanged (DESIGN.md).
- [ ] Preserved behaviour:
  - one shared pattern cycle for header and closing, with independent attachments
  - the card grid attaches only visible cards and releases cards while the dialog or search is open
  - the dialog keeps its Effect time across hide/show
  - one failing target leaves the others usable
  - lazy loading happens only when rendering is permitted
  - the effect package is never imported during Astro rendering
- [ ] Node tests (`node --experimental-strip-types --test`, wired into `pnpm -r test`) exercise the slot through its interface with fake loader and environment adapters:
  - supersession and late completion
  - delayed readiness
  - failure isolation
  - hide/show re-attach reading fresh options
  - latch clear/set
  - clear and dispose
- [ ] Existing Playwright coverage still passes: homepage `site.spec.ts`/`homepage.spec.ts`, and the docs lab specs moved by #125. These cover real GPU output, accessibility, unavailable behaviour and the back/forward-cache restore. Fake-adapter tests do not count as browser or GPU evidence.
- [ ] `workspace-boundaries.mjs` and dependency-cruiser stay satisfied. There is no new public export from `core`, `domfx` or `gsap`.
- [ ] Run `pnpm agent:brief`, focused checks, `pnpm agent:verify` (including `pnpm check`) and `pnpm test:web`, plus the docs app's browser suite from #125. Record the browser/GPU, viewport, DPR and motion conditions.

## Non-goals

- Adopting the library's `retry()`, or any change to `@domfx/browser` behaviour
- A visibility-driven slot set, or a generic controller framework
- Extracting the pattern cycle or the zoom/pan math out of `marketing.ts`
- Unifying code snippets, or changing effect-catalog records
- SEO/metadata (#124) and the docs platform move itself (#125)
- Performance claims; #86 owns measurement

## Blockers and coordination

- Blocked by #125: specifically its shared-site-package slice and its content-migration slice, which moves the docs lab into `apps/docs`. Link those slice issues here once #125 is split into tickets. The old `apps/web` lab is deleted at #125's cutover, so migrate only the `apps/docs` copy.
- #125's content-migration slice should not copy the lab's missing `pageshow` handling. This ticket fixes it through the shared helper.
- Coordinate `marketing.ts` edits with #86, which may touch per-frame work in the same file.
- Prior art: #85's acceptance checks and its deleted `effect-targets.ts` and `apps/web/test/effect-targets.test.mjs` at `7ba013e^`.
