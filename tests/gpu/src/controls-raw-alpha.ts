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
            colorRamp: undefined,
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
        colorRamp: undefined,
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
          colorRamp: undefined,
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

function smoothstep(low: number, high: number, value: number) {
  const unit = Math.max(0, Math.min(1, (value - low) / (high - low)));
  return unit * unit * (3 - 2 * unit);
}

/** Green channel of the authored three-stop ramp, monotonic in heat. */
function authoredGreen(heat: number) {
  const orange = 0.09 + (0.55 - 0.09) * smoothstep(0.1, 0.65, heat);
  return orange + (0.96 - orange) * smoothstep(0.65, 1, heat);
}

const heatLookup = Array.from({ length: 2049 }, (_, index) => authoredGreen(index / 2048));

function heatFromGreen(green: number) {
  let low = 0;
  let high = heatLookup.length - 1;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (heatLookup[middle]! < green) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }
  return low / (heatLookup.length - 1);
}

function opaque(red: number, green: number, blue: number) {
  return {
    css: `rgb(${red}, ${green}, ${blue})`,
    red: red / 255,
    green: green / 255,
    blue: blue / 255,
  };
}

/** Distance in 0-255 space from a color to the sRGB segment between two colors. */
function segmentDistance(
  point: readonly number[],
  start: readonly number[],
  end: readonly number[],
) {
  const span = end.map((value, channel) => value - start[channel]!);
  const length = span.reduce((sum, value) => sum + value * value, 0);
  const along =
    span.reduce((sum, value, channel) => sum + value * (point[channel]! - start[channel]!), 0) /
    length;
  const unit = Math.max(0, Math.min(1, along));
  return Math.hypot(
    ...point.map((value, channel) => value - (start[channel]! + span[channel]! * unit)),
  );
}

/**
 * Raw RGBA8unorm Fire output checked against the contract, independently of the shader:
 * a black-to-white pair exposes each pixel's ramp position, and the authored ramp's green
 * channel recovers heat, so `mix(tip, root, smoothstep(.1, 1, heat))` is predicted per pixel.
 */
export async function qualifyRawFireRamp(mode: ControlMode, dpr: number) {
  const tip = [0, 102, 255] as const;
  const root = [255, 153, 0] as const;
  const gpu = await GpuExperiment.create();
  const frame = silhouette(dpr);
  let prepared: Awaited<ReturnType<typeof gpu.prepare>> | undefined;
  const geometry = { pixelToLocal: frame.pixelToLocal, directionalReach: 24, inwardDepth: 10 };
  let errors: string[] = [];
  let releasedBytes = -1;
  const report = {
    alphaExact: true,
    pixels: 0,
    pairMismatches: 0,
    maxPairError: 0,
    opaquePixels: 0,
    formulaMismatches: 0,
    maxFormulaError: 0,
    positionRange: [1, 0],
    midpointPixels: 0,
    midpointAverage: [0, 0, 0],
    midpointMaxChroma: 0,
    emberPixels: 0,
    emberNonGreenPixels: 0,
    effectiveTipEmberPixels: 0,
    effectiveTipOffSegment: 0,
    effectiveTipMaxDistance: 0,
  };
  try {
    prepared = await gpu.prepare(frame);
    const render = async (
      time: number,
      emberDensity: number,
      colorRamp: { tip: ReturnType<typeof opaque>; root: ReturnType<typeof opaque> } | undefined,
    ) => {
      prepared!.render(
        time,
        314,
        1,
        dpr,
        undefined,
        24,
        'fire',
        mode === 'relative' ? geometry : undefined,
        0.56,
        { mistOpacity: 1, emberDensity, emberGlow: 1, color: undefined, colorRamp },
      );
      return prepared!.readFire();
    };
    const pair = { tip: opaque(...tip), root: opaque(...root) };
    const gray = { tip: opaque(0, 0, 0), root: opaque(255, 255, 255) };
    for (const time of [0.5, 1.5, 3.25]) {
      const authored = await render(time, 0, undefined);
      const position = await render(time, 0, gray);
      const output = await render(time, 0, pair);
      for (let offset = 0; offset < output.length; offset += 4) {
        const alpha = output[offset + 3]!;
        report.alphaExact &&= alpha === authored[offset + 3]! && alpha === position[offset + 3]!;
        if (alpha === 0) {
          continue;
        }
        report.pixels += 1;
        const shade = position[offset]!;
        for (let channel = 0; channel < 3; channel++) {
          const predicted =
            tip[channel]! * (alpha / 255) + (root[channel]! - tip[channel]!) * (shade / 255);
          const error = Math.abs(output[offset + channel]! - predicted);
          report.maxPairError = Math.max(report.maxPairError, error);
          // Each 8-bit input contributes at most half a level, plus the output's own rounding.
          report.pairMismatches += Number(error > 2);
        }
        if (alpha < 128) {
          continue;
        }
        report.opaquePixels += 1;
        const measured = shade / alpha;
        report.positionRange[0] = Math.min(report.positionRange[0]!, measured);
        report.positionRange[1] = Math.max(report.positionRange[1]!, measured);
        const heat = heatFromGreen(authored[offset + 1]! / alpha);
        const formulaError = Math.abs(measured - smoothstep(0.1, 1, heat));
        report.maxFormulaError = Math.max(report.maxFormulaError, formulaError);
        // The authored green is flat at heat .65, so 8-bit inversion resolves about .05 there.
        report.formulaMismatches += Number(formulaError > 0.07);
        if (Math.abs(measured - 0.5) <= 0.02) {
          const color = [0, 1, 2].map((channel) => (output[offset + channel]! * 255) / alpha);
          report.midpointPixels += 1;
          color.forEach((value, channel) => {
            report.midpointAverage[channel]! += value;
          });
          report.midpointMaxChroma = Math.max(
            report.midpointMaxChroma,
            Math.max(...color) - Math.min(...color),
          );
        }
      }
    }
    report.midpointAverage = report.midpointAverage.map(
      (value) => value / Math.max(1, report.midpointPixels),
    );

    const green = opaque(0, 255, 0);
    const defaultTip = [255, 23, 1] as const;
    const blueRoot = [0, 0, 255] as const;
    for (const time of [0.5, 1.5, 3.25]) {
      const flameOnly = await render(time, 0, { tip: green, root: green });
      const withEmbers = await render(time, 1, { tip: green, root: green });
      const rootOnlyFlame = await render(time, 0, {
        tip: opaque(...defaultTip),
        root: opaque(...blueRoot),
      });
      const rootOnly = await render(time, 1, {
        tip: opaque(...defaultTip),
        root: opaque(...blueRoot),
      });
      for (let offset = 0; offset < withEmbers.length; offset += 4) {
        const changed = [0, 1, 2, 3].some(
          (channel) => withEmbers[offset + channel] !== flameOnly[offset + channel],
        );
        report.emberPixels += Number(changed);
        report.emberNonGreenPixels += Number(
          withEmbers[offset] !== 0 || withEmbers[offset + 2] !== 0,
        );
        const alpha = rootOnly[offset + 3]!;
        const emberChanged = [0, 1, 2, 3].some(
          (channel) => rootOnly[offset + channel] !== rootOnlyFlame[offset + channel],
        );
        if (emberChanged && alpha >= 64) {
          report.effectiveTipEmberPixels += 1;
          const distance = segmentDistance(
            [0, 1, 2].map((channel) => (rootOnly[offset + channel]! * 255) / alpha),
            defaultTip,
            blueRoot,
          );
          report.effectiveTipMaxDistance = Math.max(report.effectiveTipMaxDistance, distance);
          report.effectiveTipOffSegment += Number(distance > 6);
        }
      }
    }
    errors = [...gpu.errors];
  } finally {
    prepared?.destroy();
    releasedBytes = gpu.managedBytes;
    gpu.destroy();
  }
  return { report, errors, releasedBytes };
}
