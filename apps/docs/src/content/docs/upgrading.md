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

## Animation and binding names

Prefer `clock: 'auto'` for automatic animation. Existing `clock: 'ambient'`
continues to work with identical timing; the read-only `clock` reports the spelling
supplied. The default remains `'manual'` for external control.

`bindEffect` and `bindEffectAsync` are compatible aliases of the Fire-named
bindings, including their types. Existing calls need no migration. Both names
keep fixed starting values, linear interpolation and private animation targets.
See [snapshot bindings](/docs/api/gsap#snapshot-bindings).

For chained GSAP sequences, use native `.to(effect, ...)` calls so each segment
starts from the preceding values. Switching from bindings changes this behavior
and makes `killTweensOf(effect)` and property overwrite address the instance
directly. Register cleanup before setup finishes; see the [GSAP guide](/docs/gsap).
