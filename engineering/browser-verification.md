# Browser and GPU verification

The lab owns the Playwright suite and its pinned Chromium dependency. Tests consume
built package exports and exercise both Vite development and the production preview.
They run real capture and WebGPU code; no renderer mock supplies the successful result.

## Setup and commands

After `pnpm install --frozen-lockfile`, install the browser once, and again after a
Playwright version upgrade:

```sh
pnpm --filter @domfx/lab exec playwright install chromium
pnpm agent:verify
```

On Linux, use `playwright install --with-deps chromium` for browser prerequisites.
Software GPU execution also needs `libvulkan1` and `mesa-vulkan-drivers`.

| Command                                           | Result                                                                                                     |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `pnpm agent:verify`                               | Repository checks, production build, and both browser projects; isolated evidence for this source snapshot |
| `pnpm test:browser`                               | Rebuild packages/production lab and run both browser projects                                              |
| `pnpm test:browser:built`                         | Run both projects against existing builds; intended for the harness after its build gate                   |
| `DOMFX_GPU_BACKEND=swiftshader pnpm agent:verify` | Run the full harness with an explicitly selected software GPU                                              |

The default backend is `native`. Unsupported WebGPU or a missing adapter fails the
GPU scenario; it is not silently skipped. `swiftshader` runs real shaders on the CPU
and is the configured CI backend. The report identifies the requested backend and
the lab records the actual adapter. Neither mode establishes broad device support.

The runner owns loopback servers on ports 4173 and 4174 and shuts them down when
finished. Occupied ports fail explicitly; it never reuses an unrelated or stale lab.
Use the normal `pnpm demo` command for interactive development outside these runs.
Browser launch flags are restricted to the local test browser.

## Required scenarios

Each project runs the following scenarios at a 1280 × 900 viewport and device pixel ratio 2:

- **Normal rendering:** existing capture fixtures and GPU distance fields agree with
  the independent numerical oracle; fire reproduces at fixed time and changes with
  time; zero intensity is transparent; GSAP cleanup preserves its caller-owned sibling.
  Exercise Play, Seek, Reverse, pointer/keyboard interaction, overlay attributes, and
  Dispose. Disposal must remove the overlay and release accounted GPU allocations.
- **Reduced motion at startup:** complete without accessing the GPU, keep effect
  controls disabled, and preserve original DOM interaction.
- **Missing WebGPU:** inject the missing capability and require the lab's explicit
  unavailable report while preserving original DOM interaction. This negative test does
  not replace the successful real-GPU scenario.
- **Injected assertion failure:** finish the GPU fixtures, then require an explicit FAIL
  with the injected assertion message and verify that cleanup removes the overlay.

The `/manual.html` root-export consumer also checks deterministic control writes,
intensity bounds, ownership and numeric rejection, stale-paint hiding, scaled-host
placement, disposal before a late adapter result or during GPU preparation, repeated
disposal/reattachment, missing GPU, and startup/runtime reduced motion. Initial failure
checks inject missing adapters, capture decode failures, sub-threshold alpha and renderer
construction failures; an oversized target exercises the real capture budget. They require
canvas/device cleanup, preserved pointer/keyboard interaction, and successful reattachment
without disposing the failed handle. Invalid runtime options/hosts and both directions of
nested ownership also reject without leaving claims.

Unexpected page/console errors fail the tests. There are no automatic retries.
Each test has a three-minute deadline; the browser suite has a ten-minute deadline.
The harness also requires report evidence from both projects, with no skipped tests,
expected failures, retries, or reporter errors. A command exit code alone is insufficient.

## Evidence and interpretation

The harness writes browser evidence alongside its summary in
`.scratch/agent/run-*/browser/`. Standalone browser runs use `.scratch/browser/` and
replace that standalone result on the next run. `DOMFX_BROWSER_OUTPUT_DIR` selects
another directory; the harness always supplies its own unique run directory.

The Playwright JSON report contains per-case results, durations, browser version,
and attached lab reports/console errors. The normal-rendering case attaches a viewport
screenshot; failed cases retain screenshots and traces. Inspect a failed trace with
`pnpm --filter @domfx/lab exec playwright show-trace /absolute/path/to/trace.zip`.
CI uploads `.scratch/agent/` as `browser-gpu-evidence` for seven days, including failures.

Pixel readbacks establish shader output; screenshot attachments help diagnosis but
are not visual-diff assertions. Accounted bytes are not a driver-memory leak detector.
Performance observations, especially SwiftShader timings, are not release thresholds.
Other browsers, fractional DPR, expanded geometry, device loss, refresh races, and
runtime motion-preference changes need their own scenarios when relevant to a change.

The implementation follows Playwright's [web-server lifecycle](https://playwright.dev/docs/test-webserver)
and [Chromium channel guidance](https://playwright.dev/docs/browsers), with the Linux
software backend based on [Vercel's verified WebGPU preset](https://github.com/vercel-labs/agent-browser/blob/main/skill-data/core/references/webgpu.md).
See also Chromium's [SwiftShader documentation](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/docs/gpu/swiftshader.md).
