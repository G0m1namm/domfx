# Effect API and documentation conventions

Each effect has an individual reference page derived from the website effect
catalog. Shared creation options and instance controls have canonical reusable
tables; effect pages include them rather than maintaining separate copies.
Each effect reference opens with its own live preview; the Standalone guide reuses
the same preview to tune Fire.

For every effect behavior, option or default change, update and verify the marketing
Home and `/effects/` previews, copied code, and EN/ES docs together. Reuse shared
creation-control metadata so both sites expose the same supported settings. Preserve
authored showcase sizing and synchronized animations unless the change requires
otherwise. Final review must check these surfaces, including keyboard and narrow
layouts.

Describe appearance and intensity per effect. Separate creation options, writable
controls, read-only state and methods. Record types, defaults, units, ranges and
whether changing a value requires a replacement instance. Keep code identifiers
literal; use the reader-facing terminology in GLOSSARY.md around them.

## Website control presentation

Marketing and docs share compact controls for all 21 effects. Use continuous
percentage sliders for `intensity` and geometric fractions; identify whether a
fraction is relative to element height or its shorter side. Playback time uses
seconds and preview zoom uses percentages. Do not present a normalized artistic
parameter as an exact count or measured percentage.

Fire uses height-relative `flameReach`; Frost, Slime and Burned paper pair
shorter-side coating/scorch depth with height-relative mist/drip/ash travel.
Electricity's `contourSpread` and Kinetic bloom's `fragmentTravel` use the shorter
side. The 13 flowing patterns pair height-relative `plumeReach` with shorter-side
`bandDepth`; Contour echoes and Brush fringe instead use shorter-side `echoReach`
and `fringeReach`. All retain continuous size controls and separate `intensity`.
The GSAP lesson's read-only `time` and `intensity` outputs show the exact API
values used in its source; its editable timeline position uses seconds.

Slime's `dripDensity` uses four website presets: None (`0`), Low (`0.2`), Medium
(`0.56`, the default) and High (`1`). These are presentation labels, not new API
enum values. The package continues to accept numeric values throughout 0–1.
Copied examples contain the numeric value.

Keep property names, identifiers, types and API string literals unchanged in every
locale, including control labels that name properties. Translate explanatory text
and preset display labels only; never translate the values passed to an effect.

## Animation and GSAP

Use ordinary GSAP property tweens on externally controlled effect instances for
sequencing. Setters are the integration boundary, including callback-suppressed
seeks; no extra frame loop or onUpdate copy is required. Keep GSAP outside core
and browser. Resource ownership remains explicit: a tween's lifetime is not its
target's lifetime. Register teardown before asynchronous initialization settles.

For `color`, first assign an explicit supported opaque color string, then interpolate
between explicit opaque color strings. An unset color is `undefined` and preserves
the authored palette; it is not a tween endpoint. Use `fromTo()` with the initialized
first color, then native `.to()` calls can read the current color. Stop color tweens
before resetting to `undefined`. Color writes retain the existing capture, geometry
and GPU resources.

The optional snapshot bindings preserve their existing starts and proxy targets
under both generic and Fire-named exports. They add scoped disposal and cancellation
of late results. They are not registered property plugins. Do not change these
semantics as a naming cleanup. A plugin is warranted only by a concrete conversion
or interpolation requirement that native properties cannot meet.

## Adding future controls

The following are design checks, not promised options or implemented features.
Keep effect-specific options on that effect's options type, following FireOptions
extending AttachmentOptions. Do not add a universal settings bag or put shader
details into core. Update the effect's reference and packed contracts with its API.

- Height or reach needs a coordinate space, units and a defined relationship to
  capture padding and resource budgets. Distinguish artistic scale from maximum
  geometric extent.
- Color needs an accepted format, alpha behavior, color space and interpolation
  contract. Gradients additionally need stops, positions and spatial or temporal
  meaning; a boolean does not specify a gradient.
- Particle count, density, emission rate and brightness are distinct. Name the
  quantity actually controlled; a procedural shader need not simulate particles.
- Whole-element processing must distinguish the visible shape, rectangular bounds
  and changing original content. Preserve the current decorative-output contract
  until a separately specified API deliberately changes it.
- A writable value is not necessarily smoothly animatable. Enums, booleans and
  gradient structures need explicit update and interpolation rules.

Document supported controls only. Keep proposals out of the current API tables.
