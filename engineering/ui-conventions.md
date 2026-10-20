# UI conventions

Read this before implementing or reviewing UI in `apps/web`, `apps/docs` or
`packages/site`, including inline styles. Apply the rules to changed declarations;
record unrelated existing violations as follow-up work. This guide does not migrate
existing CSS. [DESIGN.md](../DESIGN.md) owns appearance and approved dimensions.

## Choose units by purpose

These are project conventions, not a claim that accessibility requires one unit.
A CSS `px` is a reference pixel, not necessarily a device pixel; page zoom enlarges
pixel-sized content too. Relative units help respect font preferences, but units
alone do not ensure responsive or accessible UI.
Source guidance reviewed 2026-10-20; see [CSS lengths](https://www.w3.org/TR/css-values-4/#lengths).

| Purpose                                          | Use                                  | Rule                                                                                                |
| ------------------------------------------------ | ------------------------------------ | --------------------------------------------------------------------------------------------------- |
| Text                                             | `rem`, or inherited size             | Keep sizes relative to the user's root font preference.                                             |
| Shared spacing, gutters, radii, layout limits    | `rem`                                | Keep the approved scale consistent as text grows; use flexible widths inside limits.                |
| Text-sized icons, button padding, letter spacing | `em`                                 | Scale with the local text. On `font-size`, `em` refers to the parent and can compound.              |
| Line height                                      | Unitless number                      | Inherit a multiplier, not a fixed length. Keep DESIGN's ratios.                                     |
| Reading width                                    | `ch`                                 | An approximate measure based on the font's zero glyph, not an exact character count.                |
| Layout tracks and available space                | `%`, `fr`, `auto`, `minmax()`        | Let content wrap and shrink; use `min-inline-size: 0` where flex/grid content would force overflow. |
| Control targets                                  | `rem` minimum plus a CSS-pixel floor | Preserve DESIGN's 44 CSS-pixel target at small font settings; let labels increase height.           |
| Fine borders, outlines and decorative details    | `px`                                 | Keep deliberate stroke thickness; do not convert mechanically.                                      |
| Viewport-filling surfaces                        | `svh` or `dvh`                       | Choose stable small-viewport height or height that follows browser chrome, respectively.            |
| Container-dependent components                   | Container layout, optionally `cqi`   | Use an explicit query container; keep text font-relative and test resizing.                         |
| Measured DOM/capture/canvas geometry             | The API's coordinate units           | Keep CSS-pixel measurements distinct from backing-store/device pixels.                              |

Font-relative and viewport definitions: [CSS Values](https://www.w3.org/TR/css-values-4/#relative-lengths).
Line-height inheritance: [MDN line-height](https://developer.mozilla.org/en-US/docs/Web/CSS/line-height).

## Text and design dimensions

- Leave the root font size at the browser default, or `100%`. Avoid pixel root sizes
  and percentage tricks that redefine `1rem` for convenient arithmetic. Controls
  should inherit the intended font rather than retain browser widget defaults.
- Convert a design reference at its documented baseline, not at runtime: at the
  usual 16px default, 17px is `1.0625rem` and 24px is `1.5rem`. The actual root may
  differ. Preserve DESIGN's scale, fonts and proportions.
- For fluid text, use font-relative bounds and a preferred value that includes a
  font-relative term, such as `calc(1rem + 1vw)`. Choose values for the approved
  scale. Pure viewport text sizes can counteract zoom; even mixed `clamp()` values
  and `rem` bounds require actual resizing checks. No formula guarantees a pass.
- Prefer padding and minimum sizes over fixed heights on text-bearing controls.
  Labels must wrap or reflow without clipping, overlap or lost actions.

Rationale: [MDN font-size](https://developer.mozilla.org/en-US/docs/Web/CSS/font-size)
and [W3C viewport-font failure guidance](https://www.w3.org/WAI/WCAG22/Techniques/failures/F94).

## Responsive layout and breakpoints

1. Start with a usable narrow layout and enhance it as space becomes available.
   Use normal flow, wrapping flex rows or intrinsic grid tracks before adding a
   query. Constrain media to their container and let text determine block size.
   Percentages depend on the containing block and property; percentage heights need
   a definite reference. Reserve fixed sizes for content that requires them.
2. Add a breakpoint where actual content stops fitting: navigation collides, controls
   lose room or reading width becomes unsuitable. Check long labels and larger
   default fonts. Choose the threshold for that behavior, not a named device or a
   fixed list of phone/tablet/desktop widths. Keep shared behaviors coordinated;
   unrelated components need not share a breakpoint.
3. Use viewport media queries for page structure, such as navigation and sidebars.
   Prefer `em` thresholds and ascending `min-width` overrides for new authored CSS.
   In media queries, `em` and `rem` use the initial font size, not an authored `html`
   size. Classic `(min-width: 50em)` syntax reaches older engines than range syntax.
   Preserve upstream Starlight breakpoints when an override must match them;
   explain that dependency beside the override. Avoid gaps between paired min/max
   conditions at fractional CSS-pixel widths.
4. Use container size queries when a reusable component must adapt to its allocated
   space, independent of the viewport. Establish `container-type: inline-size` on
   the intended ancestor; keep a usable ordinary-flow layout outside the query.
   Without an eligible container, container units fall back to the small viewport.
   Unlike media queries, `em` in container conditions follows the container's font.
5. Use input capabilities such as `hover` and `pointer` for optional interaction
   enhancements. Width does not identify touch or mouse input. Keep actions usable
   with keyboard and touch without relying on hover, including on hybrid devices.

An intrinsic card grid can adapt without a viewport breakpoint:

```css
.cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 18rem), 1fr));
  gap: 1.5rem;
}
```

The `18rem` value is illustrative. Choose the minimum from the actual card content;
the inner `min()` lets a single card fit a container narrower than that minimum.

Rationale: [responsive design basics](https://web.dev/articles/responsive-web-design-basics),
[intrinsic grid layouts](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Grid_layout/Common_grid_layouts),
[container queries](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@container), and
[input capabilities](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/pointer).

### Viewport and rendering boundaries

- Use viewport units only when the viewport is the intended reference. Prefer `%`
  to `100vw` for ordinary page width. `svh` stays stable as browser chrome changes;
  `dvh` can resize during scrolling. Let content scroll rather than clipping it into
  a fixed-height panel. Neither choice alone proves virtual-keyboard behavior.
- DOM rectangles and pointer coordinates are CSS-pixel geometry; canvas backing
  dimensions and GPU textures have separate contracts. Preserve those conversions
  and numeric SVG coordinates. This guide does not change library distances or
  regression fixtures merely because they use pixels.

Sources: [media-query units](https://www.w3.org/TR/mediaqueries-4/#units),
[viewport units](https://www.w3.org/TR/css-values-4/#viewport-relative-lengths),
[container units](https://www.w3.org/TR/css-contain-3/#container-lengths), and
[canvas resolution](https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio#correcting_resolution_in_a_canvas).

## Browser compatibility

For essential UI, prefer **Baseline widely available** features: interoperable in
the Baseline core browsers for at least 30 months. This covers Chrome and Firefox
on desktop/Android, Edge on desktop, and Safari on macOS/iOS. It does not cover
every older release, embedded WebView or assistive technology. Check the exact
feature's compatibility data when adding it; a broad feature badge does not cover
every subfeature. See [Baseline's definition](https://developer.mozilla.org/en-US/docs/Glossary/Baseline/Compatibility).

Choose the simplest mechanism that fits the behavior:

| Mechanism                                                                                    | Convention                                                                                    |
| -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Flexbox/Grid, wrapping, `gap`, `minmax()`, `min()`/`max()`/`clamp()`, logical sizing         | Default tools for fluid, content-driven layout.                                               |
| Classic `min-width` media queries                                                            | Default for page-level changes; preserve coordinated existing framework thresholds.           |
| Size container queries and `cqi`, `svh`/`dvh`, subgrid, range media syntax, ordinary nesting | Widely available in current core browsers; adopt when useful and check older target versions. |
| Container style queries, their range syntax, and scroll-state queries                        | Check each exact feature; support differs. Essential layout must remain usable without them.  |

Compatibility snapshot checked 2026-10-20 using
[versioned Baseline feature data](https://unpkg.com/web-features@3.43.0/data.json) and
[pinned MDN query compatibility data](https://github.com/mdn/browser-compat-data/blob/5da921db97989a173e1d94bd8de48dae268e5738/css/at-rules/container.json).
Recheck when adopting a feature; these are availability findings, not app-tested
minimum browser versions.

Keep the readable, operable base outside optional rules; add enhancements with
`@supports` or a query only after checking its specific support. Unsupported query
rules must not hide essential content or actions. `@supports` checks feature
support, not correct layout behavior. Where an older browser is a task requirement,
document its version and the working fallback; do not infer universal support from
current-browser availability.

This is a CSS authoring policy, not a new domfx runtime support claim. The
[browser support record](browser-support.md) owns measured runtime evidence.
Our [web](../apps/web/playwright.config.ts) and [docs](../apps/docs/playwright.config.ts)
automation currently use Chromium; they do not establish Firefox or Safari passes.

## Example

These values illustrate unit roles; reuse the approved design scale in actual UI.

```css
.page {
  box-sizing: border-box;
  inline-size: 100%;
  max-inline-size: 82.5rem;
  margin-inline: auto;
  padding-inline: 1rem;
}

.prose {
  max-inline-size: 65ch;
  font-size: 1.0625rem;
  line-height: 1.6;
}

.button {
  min-inline-size: max(2.75rem, 44px);
  min-block-size: max(2.75rem, 44px);
  padding: 0.5em 1em;
  border: 1px solid var(--control-border);
  font: inherit;
}

@media (min-width: 50em) {
  .page {
    padding-inline: 2rem;
  }
}
```

## Final UI review

For every UI change, review each applicable item and record results, environment
and any untested cases in the PR or handoff. A docs-only change can mark UI checks
not applicable. Static checks cannot establish resizing or reflow success.

- Check changed declarations against the table, including tokens, inline styles,
  fixed heights and min/max bounds. Explain exceptions outside the listed uses;
  preserve measured rendering contracts and approved visual direction.
- Resize continuously and check just below, at and above each changed viewport or
  container threshold. Check fractional widths, long labels and both narrow and
  wide component placements; a few fixed screenshots do not cover the transitions.
- Test affected routes and controls at DESIGN's 360, 768 and 1440 CSS-pixel layout
  widths, and at 320 CSS pixels for reflow. Text and actions remain visible and
  operable without page-wide horizontal scrolling. Essential two-dimensional
  content, such as a data table, may scroll within its own region.
- Test page zoom through 200% and separately increase the browser's default font
  (for example, from 16px to 32px). Where supported, also test text-only resizing
  through 200%. Check intermediate steps, controls, menus, dialogs, code and form
  errors for clipping or lost functionality; record the methods actually used.
- Check reflow at 400% page zoom from a 1280 CSS-pixel-wide viewport (equivalent
  to 320 CSS pixels), or an equivalent reduced viewport. Resizing text to 200%
  and reflow at 320 CSS pixels are distinct checks.
- For viewport/container-dependent UI, test the actual container sizes and mobile
  browser chrome/keyboard states used by the feature. Complete the remaining
  [DESIGN acceptance checks](../DESIGN.md#acceptance-for-a-ui-implementation).
- For changed responsive behavior, check Chrome/Edge, Firefox and Safari, plus
  Android/iOS browsers when affected. Record browser versions and any unavailable
  coverage explicitly. Check the base layout with optional enhancements disabled;
  a compatibility table or Chromium-only run is not a cross-browser result.

These checks apply [WCAG 1.4.4 Resize Text](https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html)
and [WCAG 1.4.10 Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html)
to our workflow. The unit choices and 44px control floor are project conventions,
not additional WCAG claims. Automated tests or this checklist alone do not prove
WCAG conformance.
