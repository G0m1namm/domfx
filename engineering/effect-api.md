# Effect API and documentation conventions

Each effect has an individual reference page derived from the website effect
catalog. Shared creation options and instance controls have canonical reusable
tables; effect pages include them rather than maintaining separate copies.
The Standalone guide owns the single interactive documentation playground.

Describe appearance and intensity per effect. Separate creation options, writable
controls, read-only state and methods. Record types, defaults, units, ranges and
whether changing a value requires a replacement instance. Keep code identifiers
literal; use the reader-facing terminology in GLOSSARY.md around them.

## Animation and GSAP

Use ordinary GSAP property tweens on externally controlled effect instances for
sequencing. Setters are the integration boundary, including callback-suppressed
seeks; no extra frame loop or onUpdate copy is required. Keep GSAP outside core
and browser. Resource ownership remains explicit: a tween's lifetime is not its
target's lifetime. Register teardown before asynchronous initialization settles.

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
