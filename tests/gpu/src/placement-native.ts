import { attachFire, type EffectHandle } from '@domfx/browser';
import { startEffectDiagnostics } from '@domfx/browser/experimental';

const fixture = document.querySelector<HTMLElement>('#fixture');
const button = document.querySelector<HTMLButtonElement>('#run');
const status = document.querySelector<HTMLOutputElement>('#status');
const report = document.querySelector<HTMLElement>('#report');
const visualCheck = document.querySelector<HTMLInputElement>('#visual-check');
const confirmPaint = document.querySelector<HTMLButtonElement>('#confirm-paint');
if (!fixture || !button || !status || !report || !visualCheck || !confirmPaint) {
  throw new Error('missing-placement-controls');
}
const paintControls = { visualCheck, confirmPaint, status };

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
let handles: EffectHandle[] = [];
let cancelConfirmation: (() => void) | undefined;

function dispose() {
  cancelConfirmation?.();
  handles.forEach((handle) => handle.dispose());
  handles = [];
  fixture?.replaceChildren();
}

function confirmVisiblePaint(step: string) {
  return new Promise<boolean>((resolve) => {
    const finish = (confirmed: boolean) => {
      paintControls.confirmPaint.hidden = true;
      paintControls.confirmPaint.removeEventListener('click', confirm);
      cancelConfirmation = undefined;
      resolve(confirmed);
    };
    const confirm = () => finish(document.visibilityState === 'visible');
    cancelConfirmation = () => finish(false);
    paintControls.status.value = `Inspect ${step}: text, SVG and image`;
    paintControls.confirmPaint.hidden = false;
    paintControls.confirmPaint.addEventListener('click', confirm);
  });
}

function readOutput(canvas: HTMLCanvasElement) {
  const image = new Image();
  image.src = canvas.toDataURL();
  return image.decode().then(() => {
    const copy = document.createElement('canvas');
    copy.width = canvas.width;
    copy.height = canvas.height;
    const context = copy.getContext('2d');
    if (!context) {
      throw new Error('missing-readback-context');
    }
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, copy.width, copy.height).data;
    let painted = 0;
    for (let index = 3; index < pixels.length; index += 4) {
      painted += Number(pixels[index] > 0);
    }
    copy.width = 0;
    copy.height = 0;
    return painted;
  });
}

async function run() {
  dispose();
  const visual = paintControls.visualCheck.checked;
  if (document.visibilityState !== 'visible') {
    throw new Error('foreground-window-required');
  }
  const samples: object[] = [];
  const errors: string[] = [];
  const host = document.createElement('div');
  host.style.cssText =
    'position:relative;width:300px;height:175px;margin:20px 0;border:3.5px solid gray;transform:scale(.95,1.05);transform-origin:0 0';
  const scroller = document.createElement('div');
  scroller.style.cssText =
    'position:relative;width:250px;height:120px;border:2.5px solid gray;overflow:auto';
  const content = document.createElement('div');
  content.style.cssText = 'position:relative;width:550px;height:300px';
  scroller.append(content);
  host.append(scroller);
  fixture?.append(host);

  const text = document.createElement('div');
  text.textContent = 'Text';
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 48 32');
  svg.innerHTML = '<path fill="black" d="M4 4h40v24H4zM16 12v8h16v-8z" fill-rule="evenodd"/>';
  const image = document.createElement('img');
  const source = document.createElement('canvas');
  source.width = 48;
  source.height = 32;
  const context = source.getContext('2d');
  if (!context) {
    throw new Error('missing-source-context');
  }
  context.fillRect(4, 4, 40, 24);
  context.clearRect(16, 12, 16, 8);
  image.src = source.toDataURL();
  image.alt = 'Rectangular image with a hole';
  source.width = 0;
  source.height = 0;
  const targets = [text, svg, image];
  targets.forEach((target, index) => {
    target.style.cssText = `position:absolute;left:${25 + index * 75}px;top:35px;width:48px;height:32px;font:20px/32px serif;transform-origin:0 0`;
    content.append(target);
  });
  await image.decode();
  const adapter = await navigator.gpu?.requestAdapter();
  const defaultAdapter = adapter
    ? {
        vendor: adapter.info.vendor,
        architecture: adapter.info.architecture,
        device: adapter.info.device,
        description: adapter.info.description,
      }
    : null;
  const diagnostics = startEffectDiagnostics();
  let layers: HTMLCanvasElement[] = [];

  const environment = () => ({
    userAgent: navigator.userAgent,
    viewport: { width: innerWidth, height: innerHeight },
    dpr: devicePixelRatio,
    visibility: document.visibilityState,
    reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
    visualViewportScale: visualViewport?.scale,
    defaultAdapter,
  });
  const captures = () =>
    diagnostics.records.filter((record) => record.stage === 'capture' && record.phase === 'start')
      .length;
  const attach = async () => {
    handles = [];
    layers = [];
    for (const target of targets) {
      const previous = new Set(host.querySelectorAll('canvas'));
      const handle = attachFire(target, { host, clock: 'manual', time: 1.5 });
      handles.push(handle);
      await handle.ready;
      const layer = Array.from(host.querySelectorAll('canvas')).find(
        (canvas) => !previous.has(canvas),
      );
      if (!layer) {
        throw new Error(`missing-attached-layer:${handle.reasonDetail}`);
      }
      layers.push(layer);
    }
  };
  const sample = async (step: string) => {
    await nextFrame();
    await nextFrame();
    await nextFrame();
    let painted: number[] | null = null;
    let paintConfirmed: boolean;
    if (visual) {
      paintConfirmed = await confirmVisiblePaint(step);
    } else {
      painted = await Promise.all(layers.map(readOutput));
      paintConfirmed = painted.every((count) => count > 0);
    }
    const points = targets.map((target, index) => {
      const targetRect = target.getBoundingClientRect();
      const layer = layers[index];
      if (!layer) {
        throw new Error(`missing-layer:${step}:${index}:${handles[index].reasonDetail}`);
      }
      const layerRect = layer.getBoundingClientRect();
      // Each target has a known 48x32 local border box. The default capture inset
      // is 32 local CSS pixels; use live geometry rather than placement internals.
      const scaleX = targetRect.width / 48;
      const scaleY = targetRect.height / 32;
      const errors = [
        layerRect.left + 32 * scaleX - targetRect.left,
        layerRect.top + 32 * scaleY - targetRect.top,
        layerRect.width - 112 * scaleX,
        layerRect.height - 96 * scaleY,
      ];
      return {
        target: ['text', 'svg', 'image'][index],
        targetRect: targetRect.toJSON(),
        layerRect: layerRect.toJSON(),
        errors,
        errorCss: Math.max(...errors.map(Math.abs)),
        errorPhysical: Math.max(...errors.map(Math.abs)) * devicePixelRatio,
      };
    });
    const state = handles.map((handle) => ({
      lifecycle: handle.lifecycle,
      raster: handle.raster,
      time: handle.time,
      paused: handle.paused,
    }));
    const valid =
      document.visibilityState === 'visible' &&
      points.every((point) => point.errorPhysical <= 1) &&
      paintConfirmed &&
      state.every(
        (value) =>
          value.lifecycle === 'active' &&
          value.raster === 'fresh' &&
          value.time === 1.5 &&
          value.paused,
      );
    samples.push({
      step,
      ...environment(),
      points,
      paintVerification: visual ? 'visual-confirmation' : 'canvas-readback',
      paintConfirmed,
      painted,
      state,
      captures: captures(),
      valid,
    });
    if (!valid) {
      throw new Error(`invalid-native-placement:${step}`);
    }
  };
  let cleanup = false;
  try {
    await attach();
    await sample('initial');
    const initialCaptures = captures();
    scroller.scrollTo(10, 8);
    await sample('nested-scroll');
    targets.forEach((target) => {
      target.style.transform = 'translate(3.125px,2.375px) scale(1.1,.9)';
    });
    await sample('paused-transform');
    if (captures() !== initialCaptures) {
      throw new Error('position-only-change-recaptured');
    }
    await Promise.all(handles.map((handle) => handle.refresh()));
    await sample('refresh');
    handles.forEach((handle) => handle.dispose());
    if (host.querySelector('canvas')) {
      throw new Error('disposed-layer-remains');
    }
    await attach();
    await sample('reattach');
  } catch (error) {
    errors.push(String(error));
  } finally {
    handles.forEach((handle) => handle.dispose());
    cleanup = host.querySelectorAll('canvas').length === 0;
    diagnostics.dispose();
  }
  return {
    outcome: errors.length === 0 && cleanup ? 'passed' : 'failed',
    environment: environment(),
    samples,
    errors,
    cleanup,
  };
}

button.addEventListener('click', async () => {
  button.disabled = true;
  visualCheck.disabled = true;
  status.value = 'Running';
  try {
    const result = await run();
    report.textContent = JSON.stringify(result, null, 2);
    status.value = result.outcome;
    window.dispatchEvent(new CustomEvent('domfx-native-placement', { detail: result }));
  } catch (error) {
    const result = {
      outcome: 'failed',
      visibility: document.visibilityState,
      errors: [String(error)],
    };
    report.textContent = JSON.stringify(result, null, 2);
    status.value = result.outcome;
    window.dispatchEvent(new CustomEvent('domfx-native-placement', { detail: result }));
  } finally {
    button.disabled = false;
    visualCheck.disabled = false;
  }
});
window.addEventListener('pagehide', dispose);
import.meta.hot?.dispose(dispose);
