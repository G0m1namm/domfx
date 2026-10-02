---
layout: ../../layouts/Documentation.astro
---

domfx is experimental and unpublished. There is no registry upgrade command yet.
Use matching verified artifacts from the [installation guide](/docs/installation).

## Upgrade compatible packages

Libraries have independent versions. Read each package's changelog and the release
notes before updating; the browser package's core dependency range and the GSAP
binding's peer range determine compatibility. Do not assume equal version numbers.
Pin the exact versions or tarballs you verified and commit your app's lockfile.

For local artifacts, replace the browser/core tarballs and the core override together.
Update the optional GSAP artifact when its compatibility or behavior changes; the
standalone integration needs no GSAP dependency. Run your package manager's install,
then the app's build and type checks.

## Check migration notes

Public testing will use the opt-in `alpha` tag rather than `latest`. During `0.x`,
breaking changes require a minor release with explicit migration notes. Alpha APIs
may change; a compatible patch should preserve the documented contract.

Test your own target and timeline: forward/backward seek, original text selection
and controls, reduced-motion/unavailable fallback, refresh, teardown and remount.
Remove obsolete attachments and bindings before creating replacements. Correct an
unavailable condition before explicit retry; do not add a second binding to recover.

Keep the previous lockfile for rollback. If an update fails, report the package
versions, environment, typed reason and reasonDetail with a small reproduction.
See [troubleshooting](/docs/troubleshooting).
