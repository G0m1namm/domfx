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
inspection does not establish any of these. Safari/Firefox interaction coverage,
touch selection and additional host layouts remained outside the 2026-09-15 fixture
run. Record browser/OS/AT versions,
navigation commands, expected/actual announcements and lifecycle state when adding
such coverage; do not mark them passed from these automated results.

## Available-Mac continuation — 2026-10-18

On source `8d7eeecbf4faa1ea4609de19147b23abd09770d4`, installed Chrome
155.0.8059.80 was inspected at native 200% browser zoom on macOS 26.6.2.
The visible page had an 836 × 473 CSS-pixel viewport, DPR 4 and no reduced-motion
preference. Fire was unavailable in that state, and the original HTML remained
visible. Keyboard Enter opened Effect settings, Motion and Prompt; focus reached
the relevant controls. Motion's speed slider responded to Right and Left arrows
and was restored to 1×. The GSAP seek control reached a 2.0/4.0 s still frame
and was reset. The Docs navigation and browse menu were operable. The local
Reduce motion control produced a still background and disabled animation and
player playback; it was turned off again. Native zoom was restored to 100%.
These are bounded keyboard/visible-state observations, not spoken output or a
complete selected-browser result. Chrome's browser-reported GPU adapter was not
measured, so its environment-level acceptance remains **UNTESTED**.

For the selected native Chrome and Safari sessions, scrolling, lifecycle
(refresh/replacement, teardown/reattachment), native text selection and visibility
return remain **UNTESTED**. The Chrome observations above do not establish these
cases, and the earlier Safari 200% interaction observations remain limited to that
run. Safari's viewport, DPR, adapter and motion preference were not measured;
its environment-level acceptance also remains **UNTESTED**. VoiceOver actual speech,
physical mobile and a second OS/GPU remain **UNAVAILABLE**.

**VoiceOver: UNAVAILABLE.** Installed Safari 26.6.2 exposed semantic headings,
links, image descriptions, the Effect selector, intensity slider, Pause button
and panels through its accessibility tree. A single VoiceOver shortcut attempt
did not start an observable VoiceOver process or produce speech/captions in the
available capture surfaces. No actual announcement or VoiceOver navigation was
recorded, so none of the heading, link, panel, slider, status or decorative-canvas
speech checks passes. The next step is a human VoiceOver session on this Mac with
observable audio or captions, recording the commands and actual announcements
through the page and state changes. Accessibility-tree output alone cannot close
that gap. No macOS privacy, security or browser-automation setting was changed.

### Bounded native follow-up — 2026-10-19 UTC

On unchanged source `8d7eeecbf4faa1ea4609de19147b23abd09770d4`, Safari
26.6.2 exposed the built homepage's original Effect selector, intensity slider
and Pause button. Native accessibility actions changed Pause → Resume → Pause,
then Effect Fire → None → Fire. Intensity and Pause became disabled under None
and enabled again under Fire. Chrome 155's Effect selector likewise changed
Fire → None with intensity and Pause disabled. These are control-state
observations, not proof of rendered pixels or library `refresh()`/`dispose()`.

Chrome's homepage and Safari's separate diagnostic page reported
`document.visibilityState: hidden` during this session. Chrome's console
reported a 1421 × 1003 CSS-pixel viewport, DPR 2, reduced motion
false and a requested `apple` / `metal-3` adapter with empty device/description.
A separate local-only Safari diagnostic tab reported viewport 1324 × 850, DPR 2,
reduced motion false and requested adapter fields all `apple`; that page was
explicitly separate from the authored homepage and remained hidden across a tab
switch. Native scroll actions returned `noWindowsAvailable`, so placement,
selection and visibility return remain **UNTESTED**. The two new Chrome capture
files were byte-identical despite Fire/None control changes and support no new
pixel claim. The earlier Safari native Fire/None captures remain the bounded
visual observation described in the browser support record.

No spoken or captioned VoiceOver output was captured in this follow-up; the
previous **UNAVAILABLE** status is unchanged. AX control names and states do not
establish what VoiceOver announces. Real mobile touch and another OS/GPU are also
still **UNAVAILABLE**.

The native observations and reproduction protocol are recorded in the Orca
supervised Dispatch `ctx_0d6d7a9e7420` transcript for worktree
`87-native-mac-evidence` and the ignored local protocol
`.scratch/native-mac-evidence-87.md`. The independent website run is recorded at
`.scratch/web/report.json` (124 passed, 0 skipped/failed/flaky); the attempted
rerun log `.scratch/issue-87-test-web.log` records a port-4322 conflict before
tests started. Native Safari/Chrome captures were not retained as files, so raw
pixels are unavailable for review; the local website test screenshots are
automated Playwright evidence, not native captures.

### Issue #87 native Mac continuation — 2026-10-19 UTC

The native-production-page observations used source
`c6805fea03845c26ff6993ff83eb513ebc9e1da5`, lockfile SHA-256
`9fd9ab1136ae32a42690f0ef80763d4a47cf468cc8f2343cab20991d2b1f8b89`, and built
`apps/web/dist/index.html` SHA-256
`f68815a55ad7b20cf82a9c7c2b7c1747bcc0e1ec5a0fec73d62f3f77ae2a9658`, served at
`http://127.0.0.1:4321/`. The host was macOS 26.6.2 (25G83), arm64, MacBook Pro
Mac17,8, Apple M5 Pro with 24 GB RAM; Safari was 26.6.2 and installed Chrome was
152.0.7977.76. CSS viewport, DPR, browser adapter, reduced-motion state and page
visibility were not exposed by the native inspection surface and are **UNTESTED**;
the host Metal 4 report is not a browser adapter claim.

| Scenario                                                          | Result                                                                                                                                                                                                                                                           | Evidence boundary                                                                                                                                                                                                                        |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Safari original native link and scroll                            | **PASS:** the original `Select the text. Try this link` navigated to `#integration`, moving the native Safari page to the integration section.                                                                                                                   | This was observed with None selected after Safari's Fire view failed visually; it is not active-layer selection evidence.                                                                                                                |
| Safari original text selection while Fire is selected             | **UNTESTED.**                                                                                                                                                                                                                                                    | The native session did not obtain a qualifying text-selection observation.                                                                                                                                                               |
| Chrome Fire versus fallback controls at 100%; native 200% zoom    | **PASS, bounded:** native views showed Fire around original content; None left original content visible and disabled Intensity/Pause. Chrome's native zoom control displayed `200%`.                                                                             | User control interrupted before native scroll, selection, links, hide/return or lifecycle checks. Those scenarios are **UNTESTED**.                                                                                                      |
| Safari Fire-selected visible output                               | **UNTESTED: Fire correctness.** Fire and None native views looked the same, showing the plain image, SVG and text, although the selector accepted Fire. **PASS: fallback controls.** None visibly disabled Intensity and Pause while retaining original content. | The visual observation does not establish effect availability or status, so no rendering pass/fail is assigned. This is not an accessibility-tree or assistive-technology conclusion.                                                    |
| Hide/return and public refresh/replacement, disposal/reattachment | **UNTESTED.**                                                                                                                                                                                                                                                    | The production page does not expose public lifecycle calls, and no qualifying visibility-return observation was obtained.                                                                                                                |
| Actual VoiceOver speech, navigation or announcements              | **UNTESTED.**                                                                                                                                                                                                                                                    | VoiceOver was not activated in this continuation and no actual spoken or captioned announcement was observed. Existing historical **UNAVAILABLE** rows remain preserved; neither AX names nor control states substitute for this result. |
| Real mobile touch, second OS/GPU, other screen readers            | **UNAVAILABLE.**                                                                                                                                                                                                                                                 | No real device, second host GPU/OS, or assistive-technology session was accessible; no emulation is device evidence.                                                                                                                     |
