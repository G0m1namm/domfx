# @domfx/browser

Experimental DOM capture and internal TypeGPU renderer for domfx.

Private workspace package with a provisional name. The `/experimental` entry is
a feasibility-test interface, not a stable public API. There is no supported npm
installation command yet. Browser/GPU requirements and broader lifecycle support
are still being verified.

## Packed ESM consumption

The supported experimental build path is Node 22+ with pnpm, a package-side Vite
library build targeting ES2022, and an ESM Vite consumer. Import only
`@domfx/browser` or `@domfx/browser/experimental` through package exports.
The browser package runs `unplugin-typegpu` when building: its emitted JavaScript
includes TypeGPU callback metadata and inline fire WGSL. No separate shader files,
runtime asset copy, source aliases or consumer TypeGPU plugin are required.
Runtime dependencies (`@domfx/core`, TypeGPU, SDF and SnapDOM) remain external and
must be installed with the package. CommonJS, SSR and other bundlers are not
verified by this path.

From the repository, run `pnpm exec playwright install chromium` once, then
`pnpm test:packed` on a machine with a display and WebGPU. This packs both private
libraries and installs their tarballs in fresh temporary consumers outside the
workspace. A local pnpm override resolves the unpublished core dependency to its
tarball; it does not alias source. The consumers use plain Vite without a config.

The test copies the lab fixtures and test-only oracle, runs development and
production GPU distance/fire checks, exercises controls and disposal, and requires
an intentionally untransformed package to fail with TypeGPU's missing-metadata
error in both modes. A missing GPU is a failure, never a CPU fallback or skipped
pass. Chromium runs headed with reduced motion disabled at 1280 × 720 and DPR 2.
The printed temporary directory retains tarballs, consumers, JSON environment and
readback reports, and screenshots for inspection; remove it when finished.
This is a local hardware gate separate from `pnpm check`, not registry publication.

Local verification on 2026-09-08 passed both modes in Chromium 153 on Apple
Metal 3. Five numerical masks and seven DOM captures had maximum distance error
0.276917 raster px, zero wrong signs and zero contour-crossing error. Fixed-time
fire and GSAP seeking reproduced their hashes; disposal left zero managed GPU
bytes. Both untransformed consumers were rejected during shader resolution.
These results cover this machine and build path, not broad browser support.

See the [project README](https://github.com/G0m1namm/domfx#readme) for development
instructions. MIT licensed; dependencies retain their own licenses.
