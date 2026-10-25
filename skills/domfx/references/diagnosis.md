# Diagnose unavailable output

Inspect `lifecycle`, `raster`, `reason` and `reasonDetail` after `ready` or `retry()`.
Environmental unavailability can resolve readiness; invalid options and conflicting
targets can throw synchronously. Keep the original DOM usable in both cases.

| Observation                                            | Next check                                                                                                                                                                                                                                   |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `no-webgpu`, `no-adapter`, `canvas-webgpu-unavailable` | Check the actual browser/device and secure context or loopback address. Typechecking cannot establish GPU availability.                                                                                                                      |
| `reduced-motion`                                       | Respect the preference. `motion: 'static'` at creation allows a still decoration at time zero, never an animated override. After the preference changes back, explicitly retry.                                                              |
| `unsupported-placement`                                | Check connected, same-document elements, strict descendant target, positioned host and the CSS identified by `reasonDetail`.                                                                                                                 |
| `unsupported-composition`                              | Check target/intermediate opacity, filters (even `blur(0px)`), backdrop filters and blending. Fade the host so original content and decoration share opacity.                                                                                |
| `empty-mask`, `missing-exterior`                       | The capture needs visible opaque pixels and transparent space around the shape. Relative options also require contained descendant boxes, bounded paint without shadows/filters/outlines/generated pseudos, and the complete support margin. |
| `capture-budget`, `target-budget`, `aggregate-budget`  | Reduce capture size, DPR or simultaneous effects; dispose unused effects.                                                                                                                                                                    |
| `capture-failed`                                       | Inspect font, asset decode and CORS diagnostics. Wait for relevant fonts/assets before capture.                                                                                                                                              |
| `target-not-visible`, `stale-raster`                   | These can mean suspension. Visibility can resume fresh output, and observed re-entry refreshes a stale capture; unavailable or failed effects still need an explicit retry after correction.                                                 |
| `renderer-failed`, `device-lost`                       | Inspect GPU/shader diagnostics. Correct the cause before explicit retry; recovery is not guaranteed.                                                                                                                                         |
| `effect-target-owned`                                  | Dispose the existing effect on the target, ancestor or descendant before attaching again. Visual overlap alone is not the conflict.                                                                                                          |

Use `refresh()` for a changed captured appearance and `retry()` for a corrected
unavailable condition. Inspect state after retry rather than reporting recovery from
promise resolution alone. Dispose and recreate after unmount; a disposed instance
cannot recover. Avoid automatic retry loops.

For package/shader errors, verify installed versions and public imports. The npm
build includes the TypeGPU transform; adding a consumer shader plugin or importing
private source is not a repair. Read [troubleshooting](https://domfx.dev/docs/troubleshooting/)
for detailed recovery and [support limits](https://domfx.dev/docs/support/) for
capture/composition restrictions and measured environments. Keep support claims
within that evidence.

For relative output that retains an old raster after a DPR-only change, await
`effect.refresh()` and inspect state again. The resolution listener depends on
browser event delivery; Chromium CDP emulation can change DPR without that event.
This fallback does not establish automatic DPR handling in untested browsers.
