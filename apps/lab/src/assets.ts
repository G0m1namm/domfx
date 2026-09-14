import { attachFire, CaptureError, captureElement, type EffectHandle } from '@domfx/browser';

const target = document.querySelector<HTMLButtonElement>('#target')!;
const host = document.querySelector<HTMLElement>('#host')!;
const output = document.querySelector<HTMLCanvasElement>('#frame')!;
const state = document.querySelector<HTMLElement>('#state')!;
let effect: EffectHandle | undefined;
let result: { code: string; asset?: string; released?: boolean } | undefined;
let clicks = 0;
target.onclick = () => {
  clicks += 1;
};

function setup(kind: 'image' | 'background' | 'font', url: string) {
  if (kind === 'image') {
    const image = document.createElement('img');
    image.alt = 'Split red and blue fixture';
    image.src = url;
    target.append(image);
  } else if (kind === 'background') {
    target.style.backgroundImage = `url("${url}")`;
    target.style.backgroundRepeat = 'no-repeat';
  } else {
    const style = document.createElement('style');
    style.textContent = `@font-face { font-family: "Asset Fixture"; src: url("${url}"); font-display: swap; }`;
    document.head.append(style);
    target.style.fontFamily = '"Asset Fixture", sans-serif';
    target.textContent = 'AA';
  }
}

async function capture() {
  state.textContent = 'capturing';
  result = undefined;
  try {
    const frame = await captureElement(target, { paddingCss: 0 });
    try {
      output.width = frame.width;
      output.height = frame.height;
      output.style.width = `${frame.contentBounds.width}px`;
      output.style.height = `${frame.contentBounds.height}px`;
      output
        .getContext('2d')!
        .putImageData(
          new ImageData(new Uint8ClampedArray(frame.pixels), frame.width, frame.height),
          0,
          0,
        );
    } finally {
      frame.release();
      frame.release();
    }
    result = { code: 'ready', released: frame.pixels.byteLength === 0 };
  } catch (error) {
    result =
      error instanceof CaptureError
        ? { code: error.code, asset: error.asset }
        : { code: error instanceof Error ? error.message : String(error) };
  }
  state.textContent = JSON.stringify(result);
  return result;
}

function attach() {
  effect = attachFire(target, { host, seed: 314, time: 1.5 });
  return effect.ready;
}

declare global {
  interface Window {
    assets: {
      setup: typeof setup;
      capture: typeof capture;
      attach: typeof attach;
      readonly effect: EffectHandle | undefined;
      readonly result: typeof result;
      readonly clicks: number;
    };
  }
}
window.assets = {
  setup,
  capture,
  attach,
  get effect() {
    return effect;
  },
  get result() {
    return result;
  },
  get clicks() {
    return clicks;
  },
};
window.addEventListener('pagehide', () => effect?.dispose(), { once: true });
import.meta.hot?.dispose(() => effect?.dispose());
