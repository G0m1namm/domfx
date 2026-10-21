# Underlying interaction and accessibility

[Issue #28](https://github.com/G0m1namm/domfx/issues/28) verifies that the original
DOM remains the source of content and input. This is a bounded fixture audit,
not a certification of a host application's accessibility or universal assistive
technology support.

## Current-site observations — 2026-10-20 UTC

For [#87](https://github.com/G0m1namm/domfx/issues/87), the current site was checked
on unchanged runtime source `fcf753206814a77d16f3709e3eacd13165c765ea`. The
[support record](browser-support.md#current-site-verification--2026-10-20-utc)
pins host, browser versions, build/lock identities, automated outcomes and local
evidence paths. Earlier observations below belong to their original layouts and
revisions; they are not current-site passes.

| Scenario                                                            | Current result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Original text through an active effect                              | **PASS, bounded:** installed Chrome 155, 100% native page zoom, actual 1672×947 CSS viewport, DPR 2, visible, reduced motion off. Pointer drag selected the original standalone lab's `domfx` text while its Fire lab reported `active` with one canvas; both selected text and its native highlight were observed. This is agent-driven pointer evidence, not VoiceOver or touch evidence.                                                                                                                                                                                                    |
| Native page zoom                                                    | **PASS, bounded Chrome controls/reflow:** the native View menu/zoom control confirmed 200%; gallery preview and docs were checked at actual 836×473, DPR 4. Target replacement, Pause/Resume and lower preview controls remained reachable; closing returned focus to Try Frost. The Image target's `capture-budget` fallback retained its original content. Safari's page menu likewise confirmed 200%, but scrolling failed at the tool boundary, so its complete zoomed usability is **UNTESTED**. Both browsers were restored to 100%.                                                     |
| Larger browser default text                                         | **FAIL: sampled body text does not grow.** Fresh Chrome profiles confirmed computed roots 16px and 24px, but sampled paragraphs stayed 13px on narrow home, 15px in the gallery and 18px in the two docs routes. All sampled pages/controls fit at 360/768/1440×900, DPR 2; this reflow observation does not establish text resizing. [#143](https://github.com/G0m1namm/domfx/issues/143) records scope, exact reproduction and acceptance.                                                                                                                                                   |
| Browser-generated docs hide/return                                  | **PASS: six cycles**, three each in standalone and Frost docs, in fresh installed Chrome over CDP with `noDefaults: true`; actual 1200×863, DPR 2, reduced motion off. Each lab changed active→suspended→active, one→zero→one canvases, trusted hidden/visible event pair, with explicit pause preserved. Native OS minimization remains **UNTESTED**.                                                                                                                                                                                                                                         |
| Website/docs keyboard, fallback, no-JavaScript and history behavior | Existing suites ran on bundled Chromium and installed headed Chrome; see the support record for exact results. Docs drawer/Escape, code/table keyboard scrolling, search results/focus return, rendered standalone/GSAP examples, lab target/setting changes and BFCache checks passed in their declared automated scenarios. These are automated keyboard checks, not a complete native human keyboard audit. The bundled-Chromium website run had one unresolved reduced-motion control failure: [#144](https://github.com/G0m1namm/domfx/issues/144); later focused passes do not erase it. |
| Installed Safari original UI                                        | **PASS, bounded fallback/navigation:** Text→SVG selected state, Pause→Resume and the original reference link to `/docs/api/effects/frost/` worked while the preview reported `Static content · target-not-visible`. This does not prove an active effect, rendered effect target replacement, native lifecycle restoration, mobile drawer behavior or actual spoken announcements.                                                                                                                                                                                                             |
| Actual VoiceOver announcements and navigation                       | **Initial attempt UNAVAILABLE; later bounded passes.** Native app inspection could not recover speech on October 20. The [October 21 scripting continuation](#voiceover-scripting-continuation--2026-10-21-utc) recovered actual VoiceOver output with installed Safari. Only its named scenarios pass; full AT acceptance remains open.                                                                                                                                                                                                                                                       |
| Physical mobile, another OS/GPU and other screen readers            | **UNAVAILABLE** for this run. The maintainer must provide a real device/session and a named operator before held checks can run. Desktop viewport/DPR emulation does not fill these rows.                                                                                                                                                                                                                                                                                                                                                                                                      |

The native Safari scroll attempt returned `noWindowsAvailable`. Its page content
and native zoom controls were inspectable, but CSS viewport, DPR, browser adapter,
motion and document visibility could not be read through that surface. Keep those
identities **UNTESTED**, rather than deriving them from screenshot dimensions or
the host GPU. Native screenshots were shown in the implementation conversation;
they were not retained as files. Local automated PNGs belong to their separately
identified profiles, not Safari or VoiceOver.

### Native Safari continuation — 2026-10-20 UTC

An agent used installed Safari 26.6.2 on the same Mac and unchanged runtime/build
identified above, served at `http://127.0.0.1:4387/`. These observations extend only
the named scenarios; Safari's CSS viewport, DPR, adapter, motion preference and
document visibility remain **UNTESTED**.

- **PASS, bounded rendering and controls:** Page Down visibly scrolled the home
  page. Opening Try Frost showed a visible frost edge around Text, then around
  the replacement SVG; both reported `Live preview · WebGPU`. Pointer interaction
  changed intensity from 70% to 50%. Pause→Resume→Pause labels changed, preview
  zoom changed 100%→150%, and Escape closed the preview with focus on Try Frost.
  The Image target also showed a visible frost edge, and its original reference
  link opened the Frost documentation. These are native UI observations, not a
  complete keyboard, placement or lifecycle pass.
- **PASS, bounded native 200% docs zoom:** Safari's own page menu confirmed 200%
  on the Frost reference. Its layout visibly reflowed to the Docs drawer and
  collapsed table of contents. Page Down reached the original lab content and
  subject controls; the drawer opened and Escape closed it. Shared search
  accepted native input `frost`, returned nine results, and Escape returned focus
  to its trigger. Tab reached On this page and Return expanded it. Full drawer
  focus order, code/table keyboard scrolling and lab playback at this zoom remain
  **UNTESTED**. Safari's page menu confirmed restoration to 100%.
- **VoiceOver speech remains UNTESTED:** a startup welcome prompt was found and
  dismissed with Use VoiceOver; the actual VoiceOver process then ran. The native
  copy-last-phrase shortcut still inserted U+0003 into a focused input, and native
  paste returned the prior test URL rather than speech. App inspection timed out.
  Browser-tool clipboard reads were separately shown to be session-local, so they
  cannot supply native speech evidence. VoiceOver was turned off afterward;
  AppleScript control remained disabled. A prepared scripting probe was not run.

Local method notes are in `.scratch/browser-accessibility-87/native-continuation.md`;
native screenshots were shown in the task conversation, not retained as files.
Physical mobile, a second OS/GPU and the held Linux checks remain unchanged.

### VoiceOver scripting continuation — 2026-10-21 UTC

An agent drove **VoiceOver 10 with installed Safari 26.6.2** on the same Mac,
runtime and composed build identified above, at `http://127.0.0.1:4387/`.
User-approved temporary AppleScript control recovered actual speech output after
Safari was activated in the foreground. Qualifying site observations ran from
02:38 to 02:50 UTC. This was agent-driven AT verification, not a human listening
session or a complete browser/AT pass. Safari viewport, DPR, adapter, motion and
document visibility remain unmeasured.

The probe read VoiceOver's `content of last phrase` separately from
`text under cursor of vo cursor`; only the former supplies speech evidence.
Navigation used `vo cursor` move/action commands and named `commander` commands.
Native keyboard input changed sliders and entered search text. Empty, stale and
timed-out reads were excluded from passes.

| Scenario                      | Observed speech and result                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Home reading order            | **PASS, bounded:** main heading, explanatory text, navigation links and the five Try buttons were spoken. The sampled card sequence added no decorative-canvas reading stop; this is not an exhaustive focus audit.                                                                                                                                                                                                                                |
| Frost preview from home       | **PASS, bounded:** activation announced “Frost web dialog with 16 items Close preview button”. Text/SVG/Image selected states were spoken; Right changed intensity 70→71 and speech included “Intensity 71%”. Pause/Resume actions spoke “Resume animation”/“Pause animation”. Escape spoke “Try Frost button main” and returned the VO cursor to Try Frost. Image selection also produced “Live preview · WebGPU”.                                |
| Shared search from home       | **PASS, bounded reading/navigation:** opening announced the search dialog and field. Entering `frost` produced ten results, read as “10 results” during VO navigation; the Frost effect button and first documentation link were spoken. Escape returned to the search trigger. An automatic result-count announcement was not established.                                                                                                        |
| Gallery filters and rotor     | **PASS, bounded:** All/Energy/Material/Patterns controls were spoken. Activating Patterns spoke “selected”; rereading spoke “Patterns selected toggle button”, followed by pattern Try buttons. The heading rotor enumerated headings; selecting the gallery heading spoke “heading level 1 Effects 15”.                                                                                                                                           |
| Standalone Fire lab           | **PASS, bounded:** the heading rotor reached Tune the attachment. Subject radios spoke their selected states; switching SVG produced “Preparing the live preview…” and Image produced “Live”. Right changed intensity 80→81, spoken as “81 Fire intensity slider”. Pause/Resume produced “Paused”/“Live”, with “Resume effect selected toggle button” readable while paused.                                                                       |
| Frost reference lab and table | **PASS, bounded:** Skip to content reached the Frost heading. VO read original `domfx` text once, “Live” and Pause effect, without a decorative-canvas stop in that sequence. SVG/Image selected states, intensity 80→81 and Pause/Resume were spoken. The API table announced “3 columns, 7 rows”, column headings and the host row position.                                                                                                     |
| Native 200% Frost docs        | **PASS, bounded:** Safari's page menu confirmed 200%, and the layout reflowed. VO read “Docs expanded button”, navigation links, expanded TOC and its links. Following Shared options spoke its heading; native Tab focused the Shared creation options region with a visible outline. Escape closed the docs drawer, but speech/focus return was inconclusive. Horizontal table/code scrolling and complete zoomed lab usability remain untested. |

To repeat, enable VoiceOver and its General → Allow VoiceOver to be controlled
with AppleScript setting with the operator's approval, foreground Safari, and read
the last phrase through `tell application id "com.apple.VoiceOver"`.
Use move right/left and move into item on `vo cursor`, then perform action on a
named control. For the heading rotor, the working commander sequence was `rotor`,
`move right` to change category, `move down`/`move up`, then `perform action for item`.
The `next rotor item` probe returned empty speech; `open web menu` returned error 3.
Neither attempt qualifies as rotor evidence.

Local scripts and timestamped phrase/cursor pairs remain in ignored
`.scratch/browser-accessibility-87/voiceover-step.mjs` and `voiceover-speech.jsonl`.
Native screenshots were shown in the task conversation, not retained as files.
AppleScript control and VoiceOver were confirmed off afterward; Safari's page menu
confirmed restored 100% zoom. The owned Safari test window and preview server were
closed. No Guidepup preference replacement or Safari remote automation was used.

The following continuation supplies unavailable/reduced-motion speech, explicit
Start recovery, drawer focus return and additional native keyboard/history evidence.
The failures in #143/#144 and the hardware/Linux holds are unchanged.

### VoiceOver and native follow-up — 2026-10-21 UTC

The same agent, Mac, Safari 26.6.2, VoiceOver 10 and unchanged runtime/build were
used from 02:59 to 03:24 UTC. Actual speech was read with the approved probe above.
These are individual scenario results, not complete Safari/AT acceptance.

- **PASS, native preference and speech on the unmodified preview:** enabling
  macOS Accessibility → Motion → Reduce motion produced “Reduced motion keeps
  this preview still.” and “Reduced motion dimmed toggle button” in the Frost
  and standalone Fire labs. Turning the native preference off left the preview
  stopped: “Choose Start effect to restart this preview.” and “Start effect toggle
  button”. Explicit activation spoke “Live”. No emulated media preference was used.
- **PASS, bounded native minimize/restore on the unmodified preview:** the Fire
  lab was explicitly paused, its Safari window minimized, then that named window
  restored through Safari's Window menu. The paused UI remained; VoiceOver spoke
  “Resume effect selected toggle button”. Visibility events, canvas cleanup and
  internal resource release were not measured in this scenario. CSS viewport/DPR
  and adapter remain unmeasured for both unmodified-preview scenarios.
- **PASS, controlled unavailable speech:** a separate local proxy masked
  `navigator.gpu` before application startup, only for `?__qa_no_gpu=1`. Frost's
  original `domfx` remained readable, followed by “Effects are unavailable in this
  browser. The original content stays visible.” and “Effects unavailable dimmed
  toggle button”. The diagnostic reported 1324×888 CSS px, DPR 2, visible, native
  100% zoom and reduced motion off. This is fault injection, not a physical GPU
  failure or a rendering pass.
- **PASS, drawer focus return with VoiceOver:** at confirmed native 200% zoom on
  the normal proxy route, actual 662×444 CSS px/DPR 4, visible, motion off and
  `navigator.gpu` present, the Docs invoker received keyboard focus before opening.
  Focus moved to Installation inside the drawer. Escape spoke “Docs collapsed
  button”; moving the VO cursor to keyboard focus spoke the same invoker. This
  resolves the earlier inconclusive return, not the entire drawer focus order.
- **PASS, bounded native horizontal scrolling with VoiceOver off:** at native
  200%, narrowing the owned Safari window produced 432×471 CSS px/DPR 4. Safari's
  Option-Tab reached Shared creation options with a visible outline. A trusted
  Right-arrow event reached that region; after raising the window, `scrollLeft`
  increased 0→171 (client width 391, content width 560). In the GSAP guide, clicking
  the full lifecycle code block then pressing Right moved its enclosing region
  0→131 (391/545). Both measured scroll results reported document visibility
  `hidden`; they establish native keyboard scrolling in that state, not a visible
  foreground or VoiceOver scrolling pass. Earlier nonmoving attempts are not
  classified as app failures. Arrow-key and single-key Quick Nav were inspected
  as off; no successful Quick Nav transition was established.
- **PASS, bounded actual BFCache recovery on the proxy:** standalone → GSAP via
  the footer link → native Back reported a trusted `pageshow` with `persisted:true`.
  At 662×444/DPR 4, native 200%, motion off, foregrounding Safari reported a trusted
  visible transition. Explicit Start then produced Live/Pause effect. This does
  not establish paused-state preservation across history or an AT history pass.

The unmodified preview used port 4387; the instrumented proxy used 4388 and is a
separate cohort. It forwarded the same built HTML/assets and injected an inert,
nonfocusable “QA environment, outside the application audit” panel. Its readings
were `innerWidth`/`innerHeight`, `devicePixelRatio`, motion/visibility, GPU API
presence, trusted lifecycle/key events, and region scroll offsets/dimensions.
It added no application controls or input cancellation. Exclude this helper from
original-app reading/focus judgments. Reproduce the unavailable case by masking
the API before startup; omit that mask for navigation/scroll/history checks.
Observe actual `pageshow.persisted` rather than assuming Back used BFCache.
GPU API presence does not identify a requested adapter.

Final local proxy SHA-256:
`0c1a57e846335d810ad879a4571226b55889938202c462211b290eae465a169e`.
Method notes, the evolving ignored proxy and timestamped speech remain in
`.scratch/browser-accessibility-87/`; native screenshots were shown in the task
conversation, not saved as files. VoiceOver and AppleScript control were confirmed
off, Reduce motion off, native zoom restored to 100%, and the owned window size
restored. The owned test window and both servers were closed; the pre-existing
Safari Start Page was preserved.

Complete native keyboard order, visible foreground code/table scrolling, complete
zoomed lab usability, Safari public-API refresh/disposal/reattachment, AT history
and other browser/AT/device pairings remain **UNTESTED**. Existing automated
fixtures retain their own passes; they do not fill these native/AT rows. Physical
mobile/second OS/GPU remain **UNAVAILABLE** and Linux/SwiftShader remains **held**.

### Remaining human verification for #87

Keep #87 open until missing evidence is supplied or its owner explicitly changes
the acceptance scope. Use a named operator and a named browser/AT pairing, recording
the runtime/build, OS/device/browser/AT versions, actual viewport/DPR, native zoom,
motion preference and visibility. Record individual PASS/FAIL/UNAVAILABLE/UNTESTED
results; do not mark the environment passed from a subset of controls.

1. On current `/` and `/effects/`, check actual headings/links, filters, search and
   preview dialogs, Text/SVG/Image selected states, intensity and Pause/Resume.
   Read actual spoken or captioned announcements, including unavailable status;
   verify decorative canvases add no duplicate reading or focus stop.
2. On `/docs/standalone/` and `/docs/api/effects/frost/`, check navigation/TOC,
   narrow drawer focus/Escape, code/API-table scrolling, shared search/focus return,
   and live-lab subject, intensity, Pause/Resume/Start and status announcements.
3. Exercise native keyboard order, visible focus, original links/input/selection,
   reduced-motion recovery with explicit Resume/Start, native hide/return and
   history restoration. Separate actual native preference transitions from
   automation's synthetic events and emulated media. Check refresh/disposal and
   reattachment in the existing rendered examples/private fixtures where needed.
4. Check native 200% page zoom, larger default fonts and narrow reflow under the
   [UI conventions](ui-conventions.md). Preview zoom is a separate feature.
   Report #143's text-preference defect and any new reproducible failure separately.
   Execute touch/pan/selection only on real hardware; hold missing hardware rows.

Retain raw recordings/captions/screenshots locally, and publish the exact observed
announcements, scenario results and limitations in this record. An accessibility
tree, a running VoiceOver process or an enabled caption preference is not speech
evidence.

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
