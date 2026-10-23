---
title: "Upgrading"
description: "Update compatible packages and check migration notes."
---

The experimental `%DOMFX_BROWSER_VERSION%` release is available on npm.
See the [installation guide](/docs/installation) for exact versions.

## Upgrade compatible packages

Libraries have independent versions. Read each package's changelog and the release
notes before updating; the browser package's core dependency range and the GSAP
binding's peer range determine compatibility. Do not assume equal version numbers.
Pin the exact versions or tarballs you verified and commit your app's lockfile.

Update browser and core to compatible versions.
Update the optional GSAP package when its compatibility or behavior changes; the
standalone integration needs no GSAP dependency. Run your package manager's install,
then the app's build and type checks.

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

`bindEffect` and `bindEffectAsync` plus their generic types are compatible aliases
of the Fire-named bindings. Existing calls need no migration. Both names preserve
creation-time starts, linear interpolation and private proxy targets.

For normal GSAP sequencing, use native `.to(effect, ...)` calls instead. This is a
behavioral choice: chained `.to()` calls inherit preceding values, and overwrite
or `killTweensOf(effect)` addresses the actual instance. Register explicit effect
cleanup before setup finishes. See the [GSAP guide](/docs/gsap).
