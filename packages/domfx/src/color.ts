export interface EffectColor {
  readonly css: string;
  readonly red: number;
  readonly green: number;
  readonly blue: number;
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
