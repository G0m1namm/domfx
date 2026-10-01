import type { GpuExperiment } from '@domfx/browser/experimental';

/** A flat silhouette makes upward reach and tongue variation independently measurable. */
export async function verifyFireShape(gpu: GpuExperiment, dpr: number) {
  const width = 192 * dpr;
  const height = 128 * dpr;
  const pixels = new Uint8Array(width * height * 4);
  for (let y = 56 * dpr; y < 96 * dpr; y++) {
    for (let x = 32 * dpr; x < 160 * dpr; x++) {
      pixels[(y * width + x) * 4 + 3] = 255;
    }
  }
  const frame = await gpu.prepare({ width, height, pixels });
  try {
    const samples = [];
    for (const [time, intensity] of [
      [0, 0.85],
      [0.75, 0.85],
      [1.5, 0.85],
      [2.5, 0.85],
      [1.5, 1],
      [1.5, 0.35],
    ]) {
      frame.render(time, 314, intensity, dpr);
      const fire = await frame.readFire();
      const reaches = [];
      for (let x = 40; x < 152; x += 2) {
        let reach = 0;
        for (let y = 0; y < 56 * dpr; y++) {
          // Count translucent wisps at 12.5% opacity, not just the opaque core.
          if (fire[(y * width + x * dpr) * 4 + 3] >= 32) {
            reach = 56 - (y + 0.5) / dpr;
            break;
          }
        }
        reaches.push(reach);
      }
      let interiorMaxAlpha = 0;
      let exteriorMaxAlpha = 0;
      let boundaryMaxAlpha = 0;
      let paddingMaxAlpha = 0;
      let hotCorePixels = 0;
      let orangePixels = 0;
      let highEmberPixels = 0;
      let premultiplied = true;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const offset = (y * width + x) * 4;
          const alpha = fire[offset + 3];
          const cx = (x + 0.5) / dpr;
          const cy = (y + 0.5) / dpr;
          if (cx > 40 && cx < 152 && cy > 64 && cy < 88) {
            interiorMaxAlpha = Math.max(interiorMaxAlpha, alpha);
          }
          if (cy > 104) {
            exteriorMaxAlpha = Math.max(exteriorMaxAlpha, alpha);
          }
          if (cy <= 24) {
            paddingMaxAlpha = Math.max(paddingMaxAlpha, alpha);
          }
          if (cy < 56 && alpha >= 32) {
            hotCorePixels += Number(
              fire[offset + 1] >= fire[offset] * 0.8 && fire[offset + 2] >= fire[offset] * 0.2,
            );
            orangePixels += Number(fire[offset + 1] < fire[offset] * 0.6);
            // Gold points well above the base distinguish embers from red flame tips.
            highEmberPixels += Number(
              cy < 40 &&
                fire[offset + 1] > fire[offset] * 0.7 &&
                fire[offset + 2] > fire[offset] * 0.15,
            );
          }
          if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
            boundaryMaxAlpha = Math.max(boundaryMaxAlpha, alpha);
          }
          premultiplied &&=
            fire[offset] <= alpha && fire[offset + 1] <= alpha && fire[offset + 2] <= alpha;
        }
      }
      samples.push({
        time,
        intensity,
        maxReach: Math.max(...reaches),
        tongueVariation: Math.max(...reaches) - Math.min(...reaches),
        interiorMaxAlpha,
        exteriorMaxAlpha,
        boundaryMaxAlpha,
        paddingMaxAlpha,
        hotCorePixels,
        orangePixels,
        highEmberPixels,
        premultiplied,
      });
    }
    return {
      dpr,
      dimensions: [width, height],
      samples,
      // Flames ebb and grow over time; full intensity must reach 18 CSS px, and
      // every strong frame must exceed the previous <=12 px stretch.
      pass:
        samples.some((sample) => sample.intensity === 1 && sample.maxReach >= 18) &&
        samples.some((sample) => sample.highEmberPixels > 0) &&
        samples.every(
          (sample) =>
            sample.maxReach >= (sample.intensity < 0.5 ? 4 : 13) &&
            sample.maxReach < 32 &&
            sample.tongueVariation >= (sample.intensity < 0.5 ? 2 : 6) &&
            sample.interiorMaxAlpha === 0 &&
            sample.exteriorMaxAlpha === 0 &&
            sample.boundaryMaxAlpha === 0 &&
            sample.paddingMaxAlpha === 0 &&
            sample.hotCorePixels > 0 &&
            sample.orangePixels > 0 &&
            sample.premultiplied,
        ),
    };
  } finally {
    frame.destroy();
  }
}
