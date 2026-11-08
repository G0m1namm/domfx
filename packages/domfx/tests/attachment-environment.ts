import { Window as HappyWindow } from 'happy-dom';

import type { AttachmentAdapters, CaptureFrame } from '@domfx/browser/experimental';

/**
 * A Node DOM for attachment lifecycle tests. happy-dom has no layout, font loading
 * or WebGPU, so this supplies fixed rectangles, browser computed-style defaults, an
 * empty font set and a canvas context. Real geometry and rendering stay in the
 * browser suites; these tests only need a stable environment for the lifecycle.
 */
export function installDom() {
  const happyWindow = new HappyWindow({ url: 'https://domfx.test/' });
  // happy-dom implements the DOM interfaces the attachment uses; its own classes
  // are structurally different types, so the window is typed as the browser's once.
  const view = happyWindow as unknown as Window & typeof globalThis;
  for (const name of Object.getOwnPropertyNames(view)) {
    if (name in globalThis) {
      continue;
    }
    const value: unknown = Reflect.get(view, name);
    // Browser code such as Floating UI reads DOM classes and functions as globals.
    Object.defineProperty(globalThis, name, {
      value: typeof value === 'function' && !/^[A-Z]/.test(name) ? value.bind(view) : value,
      configurable: true,
      writable: true,
    });
  }
  Object.defineProperty(globalThis, 'window', { value: view, configurable: true });
  Object.defineProperty(globalThis, 'GPUTextureUsage', {
    value: {
      COPY_SRC: 1,
      COPY_DST: 2,
      TEXTURE_BINDING: 4,
      STORAGE_BINDING: 8,
      RENDER_ATTACHMENT: 16,
    },
    configurable: true,
  });

  const document = view.document;
  const fonts = Object.assign(new view.EventTarget(), { status: 'loaded' });
  Object.defineProperty(document, 'fonts', { value: fonts, configurable: true });

  const defaults: Record<string, string> = {
    backdropFilter: 'none',
    clip: 'auto',
    clipPath: 'none',
    contain: 'none',
    contentVisibility: 'visible',
    filter: 'none',
    maskImage: 'none',
    mixBlendMode: 'normal',
    opacity: '1',
    overflowX: 'visible',
    overflowY: 'visible',
    perspective: 'none',
    rotate: 'none',
    scale: 'none',
    transform: 'none',
    translate: 'none',
    zoom: '1',
  };
  const computedStyle = view.getComputedStyle.bind(view);
  view.getComputedStyle = (element: Element, pseudo?: string | null) =>
    new Proxy(computedStyle(element, pseudo), {
      get(style, property) {
        const value: unknown = Reflect.get(style, property);
        if (typeof value === 'function') {
          return value.bind(style);
        }
        return value === '' && typeof property === 'string' && property in defaults
          ? defaults[property]
          : value;
      },
    });

  const rects = new WeakMap<Element, DOMRect>();
  view.Element.prototype.getBoundingClientRect = function (this: Element) {
    return rects.get(this) ?? new view.DOMRect(0, 0, 0, 0);
  };
  view.Element.prototype.getClientRects = function (this: Element) {
    const rect = rects.get(this);
    return (rect ? [rect] : []) as unknown as DOMRectList;
  };
  view.HTMLCanvasElement.prototype.getContext = function () {
    return { configure() {}, unconfigure() {}, getCurrentTexture: () => ({}) };
  } as unknown as HTMLCanvasElement['getContext'];

  /** A positioned host with one 7×5 target, laid out at the viewport origin. */
  function mount() {
    const host = document.createElement('div');
    host.style.cssText = 'position:absolute;left:0;top:0;width:40px;height:40px';
    const target = document.createElement('div');
    target.style.cssText = 'width:7px;height:5px';
    host.append(target);
    document.body.append(host);
    rects.set(host, new view.DOMRect(0, 0, 40, 40));
    rects.set(target, new view.DOMRect(0, 0, 7, 5));
    return { host, target };
  }

  return { document, mount, close: () => happyWindow.happyDOM.close() };
}

export type Stage = 'setup' | 'capture' | 'prepare' | 'paint';

function deferred() {
  let resolve = () => {};
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

/** Counting adapters that can fail at one stage or hold capture/renderer setup open. */
export function fakeAdapters() {
  const state = {
    failAt: undefined as Stage | undefined,
    failure: new Error('adapter failure') as unknown,
    captures: 0,
    releases: 0,
    renderers: 0,
    rendererDestroys: 0,
    frames: 0,
    frameDestroys: 0,
    presents: 0,
    captureGate: undefined as ReturnType<typeof deferred> | undefined,
    rendererGate: undefined as ReturnType<typeof deferred> | undefined,
    captureStarted: deferred(),
    rendererStarted: deferred(),
  };

  const adapters: AttachmentAdapters = {
    async capture() {
      state.captureStarted.resolve();
      await state.captureGate?.promise;
      if (state.failAt === 'capture') {
        throw state.failure;
      }
      state.captures += 1;
      const pixels = new Uint8Array(7 * 5 * 4);
      pixels[(2 * 7 + 3) * 4 + 3] = 255;
      const frame: CaptureFrame = {
        width: 7,
        height: 5,
        pixels,
        contentBounds: { x: 0, y: 0, width: 7, height: 5 },
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
        pixelToLocal: { a: 1, d: 1, e: 0, f: 0 },
        release() {
          state.releases += 1;
        },
      };
      return frame;
    },
    async createRenderer() {
      state.rendererStarted.resolve();
      await state.rendererGate?.promise;
      if (state.failAt === 'setup') {
        throw state.failure;
      }
      state.renderers += 1;
      return {
        device: { lost: new Promise(() => {}) } as unknown as GPUDevice,
        async prepare(frame) {
          if (state.failAt === 'prepare') {
            throw state.failure;
          }
          state.frames += 1;
          return {
            width: frame.width,
            height: frame.height,
            managedBytes: frame.width * frame.height * 36 + 116,
            prepareMs: 0,
            render() {
              if (state.failAt === 'paint') {
                throw state.failure;
              }
            },
            present() {
              state.presents += 1;
            },
            readSdf: async () => new Float32Array(),
            readFire: async () => new Uint8Array(),
            destroy() {
              state.frameDestroys += 1;
            },
          };
        },
        destroy() {
          state.rendererDestroys += 1;
        },
      };
    },
  };

  return {
    adapters,
    state,
    /** Hold the next capture until the returned function runs. */
    holdCapture() {
      state.captureGate = deferred();
      state.captureStarted = deferred();
      return state.captureGate.resolve;
    },
    /** Hold renderer setup until the returned function runs. */
    holdRenderer() {
      state.rendererGate = deferred();
      state.rendererStarted = deferred();
      return state.rendererGate.resolve;
    },
    /** Every acquired frame, prepared frame and renderer was released exactly once. */
    balanced() {
      return (
        state.releases === state.captures &&
        state.frameDestroys === state.frames &&
        state.rendererDestroys === state.renderers
      );
    },
  };
}
