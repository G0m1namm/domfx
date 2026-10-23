import type { CaptureFrame } from '@domfx/core';

import { CaptureError, prepareCaptureAssets } from './capture-assets.js';
import { estimateFrameMemory } from './memory.js';
import { scaleToViewport } from './placement.js';

export function measureCapture(element: Element, padding = 32) {
  const dpr = element.ownerDocument.defaultView!.devicePixelRatio;
  const scale = scaleToViewport(element);
  const rect = element.getBoundingClientRect();
  return {
    width: Math.ceil((rect.width / scale.x + padding * 2) * dpr),
    height: Math.ceil((rect.height / scale.y + padding * 2) * dpr),
  };
}

/** Capture a snapshot of untransformed target-local paint, including a requested
 * exterior BEFORE rasterization. This is a bounded spike adapter, not a CSS painter.
 */
export async function captureElement(
  element: Element,
  options: { paddingCss?: number; dpr?: number } = {},
): Promise<CaptureFrame> {
  return captureElementWithReservation(element, options);
}

/** Internal pre-raster admission hook for attachment-owned reservations. */
export async function captureElementWithReservation(
  element: Element,
  options: { paddingCss?: number; dpr?: number } = {},
  reserve?: (width: number, height: number) => void,
  assetsReady?: () => void,
): Promise<CaptureFrame> {
  const padding = options.paddingCss ?? 32;
  const dpr = options.dpr ?? element.ownerDocument.defaultView!.devicePixelRatio;
  if (!(padding >= 0) || !Number.isFinite(padding) || !(dpr > 0) || !Number.isFinite(dpr)) {
    throw new Error('invalid-capture-options');
  }
  const assets = await prepareCaptureAssets(element);
  assetsReady?.();
  const { snapdom } = await import('@zumer/snapdom');
  let assetFailure: unknown;
  const snapshot = await snapdom(element, {
    dpr,
    outerTransforms: false,
    outerShadows: true,
    fast: true,
    reconcile: true,
    embedFonts: assets.embedFonts,
    cache: 'disabled',
    compress: false,
    placeholders: false,
    resolvePicturePlaceholders: false,
    plugins: [
      {
        name: 'domfx-target-local',
        afterClone(context) {
          assets.embedImages(context);
          const { clone } = context;
          // outerTransforms:false preserves scale in SnapDOM 2.24.15. Strip the
          // selected root's transform too; descendant transforms remain its paint.
          if (!clone) {
            return;
          }
          // The clone has a different containing block. Freeze the live border
          // box so percentage min/max sizes cannot resize its captured paint.
          const scale = scaleToViewport(element);
          const rect = element.getBoundingClientRect();
          clone.style.setProperty('box-sizing', 'border-box', 'important');
          clone.style.setProperty('width', `${rect.width / scale.x}px`, 'important');
          clone.style.setProperty('height', `${rect.height / scale.y}px`, 'important');
          for (const dimension of ['width', 'height']) {
            clone.style.setProperty(`min-${dimension}`, '0', 'important');
            clone.style.setProperty(`max-${dimension}`, 'none', 'important');
          }
          for (const property of ['transform', 'translate', 'rotate', 'scale']) {
            clone.style.setProperty(property, 'none', 'important');
          }
        },
        async beforeRender(context) {
          try {
            await assets.beforeRender(context);
          } catch (error) {
            // Let SnapDOM finish removing its temporary sandbox before rejecting.
            assetFailure = error;
          }
        },
      },
    ],
  });
  if (assetFailure) {
    throw assetFailure;
  }
  const { w0, h0 } = snapshot.meta;
  const widthCss = w0 + padding * 2;
  const heightCss = h0 + padding * 2;
  const width = Math.ceil(widthCss * dpr);
  const height = Math.ceil(heightCss * dpr);
  estimateFrameMemory(width, height);
  reserve?.(width, height);
  // Use HTML layout for the capture inset: WebKit can ignore SVG viewBox
  // translations for positioned HTML inside foreignObject (WebKit #23113).
  // SnapDOM 2.24.15 puts the selected root in a reset HTML sandbox after its CSS.
  const svgText = decodeURIComponent(snapshot.url.slice(snapshot.url.indexOf(',') + 1));
  const view = element.ownerDocument.defaultView!;
  const svg = new view.DOMParser().parseFromString(svgText, 'image/svg+xml').documentElement;
  const foreignObject = svg.querySelector('foreignObject');
  const sandbox = foreignObject?.querySelector('div');
  if (!foreignObject || !sandbox) {
    throw new CaptureError(
      'capture-decode-failed',
      'snapshot',
      new Error('capture-sandbox-missing'),
    );
  }
  svg.setAttribute('viewBox', `0 0 ${widthCss} ${heightCss}`);
  svg.setAttribute('width', String(widthCss));
  svg.setAttribute('height', String(heightCss));
  foreignObject.setAttribute('x', '0');
  foreignObject.setAttribute('y', '0');
  foreignObject.setAttribute('width', String(widthCss));
  foreignObject.setAttribute('height', String(heightCss));
  sandbox.style.setProperty('padding-left', `${padding}px`, 'important');
  sandbox.style.setProperty('padding-top', `${padding}px`, 'important');
  sandbox.style.width = `${widthCss}px`;
  sandbox.style.height = `${heightCss}px`;
  const image = element.ownerDocument.createElement('img');
  image.src =
    'data:image/svg+xml;charset=utf-8,' +
    encodeURIComponent(new view.XMLSerializer().serializeToString(svg));
  const canvas = element.ownerDocument.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  let pixels = new Uint8Array();
  try {
    try {
      await image.decode();
    } catch (cause) {
      throw new CaptureError('capture-decode-failed', 'snapshot', cause);
    }
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) {
      throw new Error('capture-context-unavailable');
    }
    context.drawImage(image, 0, 0, width, height);
    try {
      pixels = new Uint8Array(context.getImageData(0, 0, width, height).data);
    } catch (cause) {
      throw new CaptureError('capture-readback-failed', 'snapshot', cause);
    }
  } finally {
    canvas.width = 0;
    canvas.height = 0;
    image.removeAttribute('src');
  }
  let released = false;
  return {
    width,
    height,
    get pixels() {
      return pixels;
    },
    padding: { top: padding, right: padding, bottom: padding, left: padding },
    contentBounds: { x: 0, y: 0, width: w0, height: h0 },
    pixelToLocal: { a: widthCss / width, d: heightCss / height, e: -padding, f: -padding },
    release() {
      if (!released) {
        released = true;
        pixels = new Uint8Array();
      }
    },
  };
}
