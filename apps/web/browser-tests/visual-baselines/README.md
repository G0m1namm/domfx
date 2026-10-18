# Local visual baselines

Platform/backend image directories are local and ignored. Do not commit these
screenshots or upload them to PRs. A fresh checkout must generate and review its
own samples before running comparisons.

The initial `darwin/native` images were inspected on Apple M5 Pro / Metal 3 with
Playwright 1.63.0 Chromium 153.0.8010.12, at DPR 1. Home images use reduced motion
and widths 360/1440; the Fire example uses the existing seed 314, time zero,
intensity 0.7 and 32px flame height with playback paused from startup.

`pnpm test:visual` compares production website screenshots. These images are not
universal baselines across GPUs/drivers. A new platform/backend needs its own
reviewed samples. To create candidate updates, run `pnpm test:visual --update-snapshots`,
inspect every changed image and run a comparison without updates afterward.
GPU unavailability fails the Fire case; never replace its baseline with empty output.
The test report includes the browser and actual adapter identity.
