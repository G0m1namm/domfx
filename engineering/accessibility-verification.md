# Underlying interaction and accessibility

[Issue #28](https://github.com/G0m1namm/domfx/issues/28) verifies that the original
DOM remains the source of content and input. This is a bounded fixture audit,
not a certification of a host application's accessibility or universal assistive
technology support.

## Reproduce

Run `pnpm --filter @domfx/gpu-tests exec vite --host 127.0.0.1` and open
`/accessibility.html`; build with `pnpm build:gpu`, then use `vite preview` for production. The page starts with **no attachment**. A
single composite target contains a button with both an `onclick` handler and an
event listener, a described button, a native link, a labeled input and selectable
text. Before/after buttons bracket its natural tab order. The effect uses the
public `attachFire` and `bindFire` exports, real capture and WebGPU.

1. Start at **Before target**. Tab through Activate original → Original link →
   Original input → After target, then reverse with Shift+Tab. Check visible focus.
2. Activate the button with pointer, Enter and Space. Both counters must advance
   once per activation. Open the link with pointer and Enter; edit and select text
   in the input. Drag across “Select this original text.”
3. Choose **Attach effect** and repeat. Inspect the browser accessibility tree:
   the original names, roles and button description remain; the canvas has no
   accessible content or tab stop.
4. Repeat after **Revert borrowed context** (effect remains active), **Revert owned
   context** (effect is disposed), and explicit **Dispose effect**. Reload/attach
   between independent cases.
5. With an active attachment, emulate `prefers-reduced-motion: reduce` in browser
   developer tools and repeat. The state must become suspended and the layer must
   disappear. The automated unavailable case removes `navigator.gpu` before page
   startup; it is controlled missing-capability input, not a physical GPU failure.

## Automated evidence

`pnpm test:gpu:full` includes
[`accessibility.spec.ts`](../tests/gpu/browser-tests/accessibility.spec.ts) in both
development and production. A focused run against current builds is:

```sh
pnpm --filter @domfx/gpu-tests exec playwright test accessibility.spec.ts
```

Each of five lifecycle cases first records its own no-effect baseline, repeats
under an active layer (except initial unavailability), and repeats after the
transition. Assertions cover native pointer/keyboard activation, link navigation,
forward/reverse Tab order, retained focus through transitions, input editing and
keyboard selection, pointer-drag selection anchored in the original text nodes,
accessible snapshots, unique accessible controls, the button description, original
element/handler identity, and unchanged target markup. Empty `style=""` attributes
left on form controls by capture are ignored; nonempty styles and all other
attributes/content are compared. Focus outline styles must match the baseline.

Active canvases must be visible, outside the target subtree, `aria-hidden="true"`,
pointer-transparent, empty and outside the tab order. Lifecycle assertions prevent
an unavailable renderer from passing an active-overlay test. Existing website,
manual and GSAP tests continue to verify their real GPU output and interactions;
this fixture adds the baseline and lifecycle comparisons without replacing them.

Each phase attaches `*-input.json`, `*-focus.png` and `*-selection.png` to the
Playwright report. `accessibility-environment.json` records the browser version,
project, viewport, DPR, visibility, motion preference, adapter information and final
state. GPU fixture evidence lives under `.scratch/browser/`. Screenshots support visual inspection and are not image
diff assertions. The accessible snapshot is browser-derived test evidence, not a
screen reader's spoken output.

## Recorded manual observations — 2026-09-15

An agent drove the visible Chrome browser on macOS through the UI, separately from
the Playwright assertions. This was not a human assistive-technology session.
The development fixture used its manual clock, with an active, fresh fire layer.
The visible browser was narrow enough to clip the fixture's right edge; observations
below cover the visible controls, not responsive-layout conformance.

| Observation                                       | Result                                                                                                   |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| No-effect button focus and Enter                  | Blue focus outline visible; both caller counters advanced once.                                          |
| Active layer, button focus and Enter              | Same visible outline; both counters advanced once.                                                       |
| Active layer, text drag                           | Original text showed the browser's selection highlight beneath the effect.                               |
| Borrowed context revert                           | Effect remained active; pointer activation advanced both counters and Tab reached Original link.         |
| Owned context revert                              | Layer disappeared; keyboard focus/Enter still worked, with both counters advancing once.                 |
| Native browser accessibility tree in those states | One original button, link and labeled input; no decorative canvas or duplicated target content appeared. |

Reduced-motion and missing-WebGPU input comparisons are automated in both projects;
no separate manual OS-preference or physical GPU-failure session was performed.
Saved focus/selection images provide phase-specific visual evidence for follow-up.

**Untested assistive technology:** VoiceOver speech/rotor, NVDA, JAWS, TalkBack,
braille displays, switch control and voice control. Native accessibility-tree
inspection does not establish any of these. Safari/Firefox, touch selection and
additional host layouts also remain outside this run. Record browser/OS/AT versions,
navigation commands, expected/actual announcements and lifecycle state when adding
such coverage; do not mark them passed from these automated results.
