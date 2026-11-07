---
title: "Upgrading"
description: "Update compatible packages and check migration notes."
---

The experimental `%DOMFX_BROWSER_VERSION%` release is available on npm.
See the [installation guide](/docs/installation) for exact versions.

## Upgrade compatible packages

Packages have independent versions. Check each changelog and release note, the
browser package's core dependency range, and the GSAP adapter's peer ranges.
Matching version numbers alone do not establish compatibility.

Pin the versions you verified and commit your app's lockfile. Update the optional
GSAP adapter only when needed; standalone effects do not depend on it. Reinstall,
then run your app's build and type checks.

## Check migration notes

npm distribution tags can change; a `latest` tag does not guarantee a stable API.
Pin exact versions rather than relying on a moving tag. During `0.x`,
breaking changes require a minor release with explicit migration notes. Alpha APIs
may change; a compatible patch should preserve the documented contract.

Test your own target and timeline: forward/backward seek, original text selection
and controls, reduced-motion/unavailable fallback, refresh, teardown and remount.
Remove obsolete attachments and bindings before creating replacements. Correct an
unavailable condition before explicit retry; do not add a second binding to recover.

Keep the previous lockfile for rollback. If an update fails, report the package
versions, environment, reason code and diagnostic message with a small reproduction.
See [troubleshooting](/docs/troubleshooting).

## Removed options

The next release removes two options. Both now throw at creation in JavaScript and
fail type checking in TypeScript.

- **`clock: 'ambient'`:** use `clock: 'auto'`, which has identical timing. The old
  value throws `invalid-clock-mode`.
- **Fire's `flameHeight`:** omit it for the Default appearance, which is the old
  default of `24`, or use `flameReach` to size flames relative to the target. Custom
  pixel-sized flames are no longer possible. The old option throws
  `invalid-fire-parameter`.

## Relative effect sizing

Relative sizing is available in `0.1.0-alpha.2`. Choose the fields in your [effect's reference](/docs/api/effects). Omitting them keeps the
Default appearance.
For paired options, an omitted partner is zero.

In relative mode, intensity changes strength without changing the configured
reach or depth. Sizing options are set at creation: dispose and recreate the
effect to change them. Check its capture limits before switching.

Slime also offers `dripDensity` (0–1, default 0.56). Higher values add more drips
without changing their size, travel or timing. It is set at creation and does not
enable relative sizing by itself. See the [Slime options](/docs/api/effects/slime#effect-options).

## Animation and binding names

Use `clock: 'auto'` for automatic animation. The default remains `'manual'` for
external control.

The next release removes the Fire-named bindings. Rename `bindFire` to `bindEffect`,
`bindFireAsync` to `bindEffectAsync`, `FireBindingOptions` to `EffectBindingOptions`,
`FireBinding` to `EffectBinding` and `AsyncFireBinding` to `AsyncEffectBinding`.
Behavior does not change: bindings keep fixed starting values, linear interpolation
and private animation targets. See [snapshot bindings](/docs/api/gsap#snapshot-bindings).

For chained GSAP sequences, use native `.to(effect, ...)` calls so each segment
starts from the preceding values. Switching from bindings changes this behavior
and makes `killTweensOf(effect)` and property overwrite address the instance
directly. Register cleanup before setup finishes; see the [GSAP guide](/docs/gsap).

## Capture exports

The next release narrows the capture exports.

- **`captureElement` and `CaptureFrame`:** import them from
  `@domfx/browser/experimental`. They are no longer exported from `@domfx/browser`,
  and `CaptureFrame` is no longer exported from `@domfx/core`.
  `@domfx/browser/experimental` is unstable and can change in any release.
- **`classifyAlpha`:** removed from `@domfx/core`. Compare a frame's alpha yourself:
  `frame.pixels[index * 4 + 3] >= 128`.
- **`CaptureError` and `CaptureErrorCode`:** unchanged. `refresh()` still rejects with
  `CaptureError`, so branch on its `code`.
