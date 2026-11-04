# Hosted GPU CI options (#209)

Question: which hosted options can run real WebGPU checks in CI, and are they reliable and cheap enough to adopt?
Researched 2026-11-03 against `main` at `40c114e`. Prices are list prices read from vendor pages that day; nothing was purchased or signed up for.

## Recommendation

**Defer.** Beta does not depend on this. No option is clearly good:

- Hosted macOS (the only Metal match for the local baseline) has no usable GPU.
- GitHub GPU runners are not available to this repo (personal account).
- Third-party T4 runners are cheap, but they test Vulkan on Linux, which Chrome treats as flag-gated, and the repo has never run a passing Linux/GPU job.
- Linux/SwiftShader has not passed.

If revisited, the cheapest experiment is a manual `workflow_dispatch` job on a RunsOn T4 (see "If revisited"). Keep release reliance on local Metal runs, as [#41](https://github.com/G0m1namm/domfx/issues/41) and [#91](https://github.com/G0m1namm/domfx/issues/91) already do.

## Verified facts

### Baseline in this repo

- `check.yml` runs on `ubuntu-latest` with Playwright Chromium. It runs only the no-GPU smoke suites (`test:web:smoke:built`, `test:docs:smoke:built`). `HARNESS.md` reports GPU correctness as `not-run`.
- `pnpm test:gpu:full` runs `build:gpu` then `test:gpu:built`; the recorded passes are on Chromium 153 with a native Apple `metal-3` adapter (`engineering/browser-support.md`).
- The Playwright configs already support `DOMFX_GPU_BACKEND=swiftshader`. They add `--enable-unsafe-webgpu --use-angle=swiftshader --use-webgpu-adapter=swiftshader`. `apps/web` can also use `--use-angle=vulkan --use-vulkan=swiftshader`.

### The failed SwiftShader run

[Run 36828639144](https://github.com/G0m1namm/domfx/actions/runs/36828639144) (Check workflow, `cf5363e`, 2026-10-01, `ubuntu-24.04` image 20260920.314.1, `DOMFX_GPU_BACKEND=swiftshader`, `libvulkan1 mesa-vulkan-drivers` installed). Conclusion: cancelled, with failed `website`, `browser (2)`, `browser (3)` and `workspace` jobs and cancelled `browser (1)` and `(4)`.

- `browser (3)`: 107 passed, 3 failed (7.9 min). Two `lab.spec.ts` cases failed with fire `alphaPixels` equal to 0 ("target live fire") while the adapter reported `architecture: swiftshader`. A layout case hit its 180 s timeout.
- `browser (2)`: a case saw `reason: "no-adapter"` and the status text never matched.
- `website`: several `toHaveCount` failures, and the "rapid replacement, partial image failure and teardown" case failed in both dev and production.
- Meaning: SwiftShader exposed an adapter and passed many injected-negative and lifecycle cases, but rendered output was empty in at least two cases, and adapter availability was inconsistent. It is slow: one shard took about 8 minutes, so about 32 runner-minutes on a 4-way split. I did not diagnose the root cause; the evidence does not separate a SwiftShader limitation from a repo or flag issue.

### GitHub-hosted runners

| Option                        | Facts (source)                                                                                                                                                                                                                                                                                                                                                                                 |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Standard Linux, macOS         | Free and unlimited on public repos ([runners reference](https://docs.github.com/en/actions/reference/runners/github-hosted-runners)). macOS arm64 (M1) is 3 vCPU, 7 GB. The page says nothing about GPU or Metal.                                                                                                                                                                              |
| macOS arm64 GPU               | Runner-images maintainers call a non-working Metal/MPS device "expected behaviour for macOS arm64 runners" and attribute it to Apple's Virtualization Framework ([runner-images#9918](https://github.com/actions/runner-images/issues/9918)). This was a PyTorch report; no one has shown WebGPU/Metal working on these VMs.                                                                   |
| Larger "GPU-powered" runner   | 4 vCPU, 1x Tesla T4, 28 GB RAM, 16 GB VRAM, Ubuntu or Windows ([larger runners reference](https://docs.github.com/en/actions/reference/runners/larger-runners)). Needs a card on file and a spending limit above zero. $0.052/min (`linux_4_core_gpu`, [pricing](https://docs.github.com/en/billing/reference/actions-runner-pricing)). Larger runners are "not free for public repositories". |
| Availability here             | Larger runners are for organizations and enterprises on Team or Enterprise Cloud. `G0m1namm` is a personal user account (`gh api users/G0m1namm` type `User`), and the repo is not in an org. So this option is **unavailable without moving the repo to a paid org**.                                                                                                                         |
| Larger macOS (M2 Pro, 5 vCPU) | $0.102/min (pricing page). Same Metal-in-VM problem expected; not confirmed.                                                                                                                                                                                                                                                                                                                   |

### Third-party runners (vendor pages)

| Vendor                                                            | GPU facts                                                                                                                               | Price (as published)                                                                                                            | macOS                                                |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| [RunsOn](https://runs-on.com/pricing/) (runs in your AWS account) | T4 (g4dn.xlarge, 4 vCPU) $0.0048/min spot, vs $0.0520 on GitHub; g4dn.2xlarge $0.0052; A10 (g5.4xlarge, 16 vCPU) $0.0134; 4xT4 $0.0232. | License EUR 300/yr starter, "free for non-commercial open source". AWS compute is billed to you. Spot interruption is possible. | Not listed.                                          |
| [Cirrus Runners](https://cirrus-runners.app)                      | "GPU runners" named; no model or price on the page.                                                                                     | $150/month per concurrent runner, unlimited minutes.                                                                            | M4 Pro named; no specs.                              |
| [WarpBuild](https://www.warpbuild.com/docs/ci/cloud-runners)      | GPU page returned 404; no GPU data confirmed.                                                                                           | n/a                                                                                                                             | arm64 macOS $0.08/min (6 vCPU), $0.16/min (12 vCPU). |
| [Blacksmith](https://www.blacksmith.sh/pricing)                   | No GPU runners on the pricing page.                                                                                                     | n/a                                                                                                                             | macOS M4 $0.08/min; 3,000 free min/month.            |
| Namespace, Ubicloud, Depot                                        | Could not confirm GPU offerings or prices from primary pages.                                                                           | n/a                                                                                                                             | n/a                                                  |

I found no primary source showing any macOS runner (GitHub or third-party) passing GPU work through to Metal. Vendors' macOS pages do not claim it.

### Chromium and Dawn on Linux

- Google's [implementation status](https://github.com/gpuweb/gpuweb/wiki/Implementation-Status) lists Linux WebGPU as shipped for Intel Gen12+ (Chrome 144) and NVIDIA on Wayland with driver 535.183.01+ (Chrome 147). "Others" are behind `--enable-unsafe-webgpu --ozone-platform=x11 --use-angle=vulkan --enable-features=Vulkan,VulkanFromANGLE`. A T4 on headless Ubuntu is therefore in the flag-gated bucket. (The page was fetched flattened; the Linux column was inferred from table layout.)
- Chrome's [troubleshooting tips](https://developer.chrome.com/docs/web-platform/webgpu/troubleshooting-tips) say WebGPU "requires a GPU (either hardware or software-emulated)". `chrome://gpu` shows "Software only, hardware acceleration unavailable" when hardware is missing. They do not document a SwiftShader adapter flag.
- Chrome's [headless-GPU article](https://developer.chrome.com/blog/supercharge-web-ai-testing) says headless Chrome disables the GPU by default. It shows a T4 silently falling back to SwiftShader until the matching driver was installed (`libnvidia-gl-*`, `vulkan-tools`). It warns that "some combinations of flags allow detection of the GPU, but don't allow you to actually use the GPU", and says to verify through `vulkaninfo --summary` and `chrome://gpu`.
- I did not find a primary Chromium or Dawn document that defines `--use-webgpu-adapter=swiftshader`. The flag is used in this repo; its supported status is **unverified**.

## Comparison

| Criterion                            | Linux SwiftShader (existing runner)                                 | GitHub GPU runner (T4)                                                  | RunsOn T4 (self-hosted on AWS)                                  | Hosted macOS                              |
| ------------------------------------ | ------------------------------------------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------- | ----------------------------------------- |
| Reliability                          | Not yet: empty fire output and no-adapter in run above              | Unknown; flag-gated Chrome path                                         | Unknown; same Chrome path, plus spot interruptions              | GPU not exposed to VM (per runner-images) |
| Cost per run                         | Free (public repo). About 32 min on the failed run's 4-shard split. | $0.052/min: about $1.7 for 32 min (my estimate; real GPU speed unknown) | $0.0048/min: about $0.15 per 32 min, plus license and AWS setup | $0.062 to $0.10/min, no benefit           |
| Backend coverage                     | Vulkan on CPU                                                       | Vulkan (Linux) or D3D12 (Windows image)                                 | Vulkan                                                          | Would be Metal, if it worked              |
| Maintenance                          | Flag and driver tuning                                              | Low once available, but blocked by account type                         | AWS account, IAM, runner stack upgrades, license                | n/a                                       |
| Matches local baseline (Apple Metal) | No                                                                  | No                                                                      | No                                                              | Only in principle                         |

Cost estimates multiply published rates by the SwiftShader shard minutes; a real GPU may be faster or may need a different test split. They are rough and unmeasured.

## Judgement

- Coverage gap: even a perfect T4 pass would add Linux/Vulkan (and Windows/D3D12 on GitHub's image). It would not replace the Apple Metal runs that the support matrix uses as evidence.
- Fidelity risk: SwiftShader already produced a rendering failure. Adding a hardware path on a Chrome/Linux/NVIDIA combination that Google does not list as shipped adds a second source of flakiness before the first is understood.
- Cost is not the blocker. Reliability and account eligibility are.

## If revisited

1. Prefer a manual-only `workflow_dispatch` job so a flaky GPU run cannot gate merges or releases.
2. Use RunsOn with a T4 spot instance (cheapest, AWS-controlled; confirm the open-source exemption with the vendor). Alternatively, move the repo to a GitHub org for first-party GPU runners.
3. Install the NVIDIA GL/Vulkan packages, then record `vulkaninfo --summary` and the `chrome://gpu` WebGPU line as the first job step, so a silent SwiftShader fallback is visible.
4. Run the existing `test:gpu:built` subset with `DOMFX_GPU_BACKEND=native` and compare to the Metal baseline pixel results. Record it as a new row in `engineering/browser-support.md`, not as a replacement for Metal.
5. Separately, diagnose the SwiftShader fire-alpha-0 failure; if SwiftShader passes, it is the free option on existing runners.

## Limits of this research

- Prices change; re-check before acting.
- No third-party runner was tried; nothing was measured on GPU hardware.
- Namespace, Ubicloud, Depot and WarpBuild GPU details were not obtainable from primary pages.
- The SwiftShader failure cause was not diagnosed.
