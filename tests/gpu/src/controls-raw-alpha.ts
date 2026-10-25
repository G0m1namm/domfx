import { GpuExperiment } from '@domfx/browser/experimental';

type ControlMode = 'legacy' | 'relative';
type ControlName = 'mistOpacity' | 'emberDensity' | 'emberGlow';
type SelectedEffect = 'frost' | 'fire' | 'burned-paper';
type ColorEffect = 'electricity' | 'fire' | 'frost' | 'kinetic' | 'slime' | 'dither' | 'halftone';

interface ControlSample {
  readonly control: ControlName;
  readonly value: number;
  readonly nontransparentPixels: number;
  readonly coloredPixels: number;
  readonly rgbWithinAlpha: boolean;
  readonly transparentRgbZero: boolean;
}

const controls: readonly {
  readonly control: ControlName;
  readonly effect: SelectedEffect;
  readonly values: readonly number[];
}[] = [
  { control: 'mistOpacity', effect: 'frost', values: [0, 0.5, 1] },
  { control: 'emberDensity', effect: 'fire', values: [0, 0.5, 1] },
  { control: 'emberGlow', effect: 'burned-paper', values: [0, 0.5, 1] },
];

const colorEffects: readonly ColorEffect[] = [
  'electricity',
  'fire',
  'frost',
  'kinetic',
  'slime',
  'dither',
  'halftone',
];

const selectedColors = [
  { name: 'black', red: 0, green: 0, blue: 0 },
  { name: 'red', red: 1, green: 0, blue: 0 },
  { name: 'white', red: 1, green: 1, blue: 1 },
] as const;

function silhouette(dpr: number) {
  const padding = 32;
  const contentWidth = 128;
  const contentHeight = 80;
  const width = (contentWidth + padding * 2) * dpr;
  const height = (contentHeight + padding * 2) * dpr;
  const pixels = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const localX = (x + 0.5) / dpr - padding;
      const localY = (y + 0.5) / dpr - padding;
      const body = localX >= 12 && localX < 116 && localY >= 12 && localY < 68;
      const hole = localX >= 48 && localX < 80 && localY >= 28 && localY < 52;
      const stripe = localX >= 4 && localX < 8 && localY >= 20 && localY < 60;
      if ((body && !hole) || stripe) {
        pixels[(y * width + x) * 4 + 3] = 255;
      }
    }
  }
  return {
    width,
    height,
    pixels,
    pixelToLocal: { a: 1 / dpr, d: 1 / dpr, e: -padding, f: -padding },
  };
}

/** Raw RGBA8unorm output before presentation; conversion hides any pre-readback NaN detail. */
export async function qualifyRawAlphaControls(mode: ControlMode, dpr: number) {
  const gpu = await GpuExperiment.create();
  const frame = silhouette(dpr);
  let prepared: Awaited<ReturnType<typeof gpu.prepare>> | undefined;
  const samples: ControlSample[] = [];
  let errors: string[] = [];
  let releasedBytes = -1;
  try {
    prepared = await gpu.prepare(frame);
    const geometry = {
      pixelToLocal: frame.pixelToLocal,
      directionalReach: 24,
      inwardDepth: 10,
    };
    for (const selection of controls) {
      for (const value of selection.values) {
        prepared.render(
          1.5,
          314,
          1,
          dpr,
          undefined,
          24,
          selection.effect,
          mode === 'relative' ? geometry : undefined,
          0.56,
          {
            mistOpacity: selection.control === 'mistOpacity' ? value : 1,
            emberDensity: selection.control === 'emberDensity' ? value : 1,
            emberGlow: selection.control === 'emberGlow' ? value : 1,
            color: undefined,
          },
        );
        const pixels = await prepared.readFire();
        let nontransparentPixels = 0;
        let coloredPixels = 0;
        let rgbWithinAlpha = true;
        let transparentRgbZero = true;
        for (let offset = 0; offset < pixels.length; offset += 4) {
          const alpha = pixels[offset + 3]!;
          const red = pixels[offset]!;
          const green = pixels[offset + 1]!;
          const blue = pixels[offset + 2]!;
          nontransparentPixels += Number(alpha > 0);
          coloredPixels += Number(red > 0 || green > 0 || blue > 0);
          rgbWithinAlpha &&= red <= alpha && green <= alpha && blue <= alpha;
          transparentRgbZero &&= alpha !== 0 || (red === 0 && green === 0 && blue === 0);
        }
        samples.push({
          control: selection.control,
          value,
          nontransparentPixels,
          coloredPixels,
          rgbWithinAlpha,
          transparentRgbZero,
        });
      }
    }
    errors = [...gpu.errors];
  } finally {
    prepared?.destroy();
    releasedBytes = gpu.managedBytes;
    gpu.destroy();
  }
  return { samples, errors, releasedBytes };
}

function recolorMismatches(
  source: Uint8Array,
  recolored: Uint8Array,
  selected: (typeof selectedColors)[number],
) {
  let mismatches = 0;
  let alphaExact = true;
  for (let offset = 0; offset < source.length; offset += 4) {
    const alpha = source[offset + 3]!;
    alphaExact &&= alpha === recolored[offset + 3]!;
    if (alpha === 0) {
      continue;
    }
    const channels = [source[offset]!, source[offset + 1]!, source[offset + 2]!];
    const lightness = (Math.max(...channels) + Math.min(...channels)) / (2 * alpha);
    const expected = [selected.red, selected.green, selected.blue].map(
      (channel) =>
        (lightness <= 0.5
          ? channel * 2 * lightness
          : channel + (1 - channel) * (2 * lightness - 1)) * alpha,
    );
    for (let channel = 0; channel < 3; channel++) {
      if (Math.abs(recolored[offset + channel]! - expected[channel]!) > 3) {
        mismatches += 1;
      }
    }
  }
  return { alphaExact, mismatches };
}

/** Raw RGBA8unorm output before presentation for representative color shader families. */
export async function qualifyRawEffectColors(dpr: number) {
  const gpu = await GpuExperiment.create();
  const frame = silhouette(dpr);
  let prepared: Awaited<ReturnType<typeof gpu.prepare>> | undefined;
  const samples: {
    effect: ColorEffect;
    color: (typeof selectedColors)[number]['name'];
    alphaExact: boolean;
    recolorMismatches: number;
  }[] = [];
  let errors: string[] = [];
  let releasedBytes = -1;
  try {
    prepared = await gpu.prepare(frame);
    for (const effect of colorEffects) {
      prepared.render(1.5, 314, 1, dpr, undefined, 24, effect, undefined, 0.56, {
        mistOpacity: 1,
        emberDensity: 1,
        emberGlow: 1,
        color: undefined,
      });
      const authored = await prepared.readFire();
      for (const color of selectedColors) {
        prepared.render(1.5, 314, 1, dpr, undefined, 24, effect, undefined, 0.56, {
          mistOpacity: 1,
          emberDensity: 1,
          emberGlow: 1,
          color: {
            css: `rgb(${color.red * 255}, ${color.green * 255}, ${color.blue * 255})`,
            red: color.red,
            green: color.green,
            blue: color.blue,
          },
        });
        const recolored = await prepared.readFire();
        const { alphaExact, mismatches } = recolorMismatches(authored, recolored, color);
        samples.push({ effect, color: color.name, alphaExact, recolorMismatches: mismatches });
      }
    }
    errors = [...gpu.errors];
  } finally {
    prepared?.destroy();
    releasedBytes = gpu.managedBytes;
    gpu.destroy();
  }
  return { samples, errors, releasedBytes };
}
