export interface EffectColor {
  readonly css: string;
  readonly red: number;
  readonly green: number;
  readonly blue: number;
}

/** Resolved endpoints of a color ramp, sent to the shader once either one is selected. */
export interface EffectColorRamp {
  readonly tip: EffectColor;
  readonly root: EffectColor;
}

const decimal = '[0-9]+(?:\\.[0-9]+)?';
const rgb = new RegExp(
  `^rgb\\(\\s*(${decimal})\\s*,\\s*(${decimal})\\s*,\\s*(${decimal})\\s*\\)$`,
  'i',
);
const rgba = new RegExp(
  `^rgba\\(\\s*(${decimal})\\s*,\\s*(${decimal})\\s*,\\s*(${decimal})\\s*,\\s*(1(?:\\.0+)?)\\s*\\)$`,
  'i',
);

function invalidColor(): never {
  throw new Error('invalid-effect-color');
}

function channel(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 255) {
    return invalidColor();
  }
  return parsed;
}

function resolved(red: number, green: number, blue: number): EffectColor {
  return {
    css: `rgb(${red}, ${green}, ${blue})`,
    red: red / 255,
    green: green / 255,
    blue: blue / 255,
  };
}

const fireAuthoredTip = resolved(255, 23, 1);
const fireAuthoredRoot = resolved(255, 245, 163);

/** Fire keeps its three-stop palette until one endpoint is selected. */
export function fireColorRamp(
  tip: EffectColor | undefined,
  root: EffectColor | undefined,
): EffectColorRamp | undefined {
  if (tip === undefined && root === undefined) {
    return undefined;
  }
  return { tip: tip ?? fireAuthoredTip, root: root ?? fireAuthoredRoot };
}

export function parseEffectColor(value: unknown): EffectColor | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'string') {
    return invalidColor();
  }

  const source = value.trim();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(source);
  if (hex) {
    const digits =
      hex[1].length === 3
        ? hex[1].split('').map((digit) => digit + digit)
        : [hex[1].slice(0, 2), hex[1].slice(2, 4), hex[1].slice(4, 6)];
    return resolved(
      Number.parseInt(digits[0], 16),
      Number.parseInt(digits[1], 16),
      Number.parseInt(digits[2], 16),
    );
  }

  const match = rgb.exec(source) ?? rgba.exec(source);
  if (!match) {
    return invalidColor();
  }
  return resolved(channel(match[1]), channel(match[2]), channel(match[3]));
}
