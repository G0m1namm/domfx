import type { CaptureFrame } from '@domfx/core';

/** Capture a snapshot of untransformed target-local paint, including a requested
 * exterior BEFORE rasterization. This is a bounded spike adapter, not a CSS painter.
 */
export async function captureElement(
  element: Element,
  options: { paddingCss?: number; dpr?: number } = {},
): Promise<CaptureFrame> {
  const padding = options.paddingCss ?? 32;
  const dpr = options.dpr ?? element.ownerDocument.defaultView!.devicePixelRatio;
  if (!(padding >= 0) || !Number.isFinite(padding) || !(dpr > 0) || !Number.isFinite(dpr)) {
    throw new Error('invalid-capture-options');
  }
  const { snapdom } = await import('@zumer/snapdom');
  const snapshot = await snapdom(element, {
    dpr,
    outerTransforms: false,
    outerShadows: true,
    fast: true,
    reconcile: true,
    embedFonts: true,
    plugins: [
      {
        name: 'domfx-target-local',
        afterClone({ clone }) {
          // outerTransforms:false preserves scale in SnapDOM 2.24.15. Strip the
          // selected root's transform too; descendant transforms remain its paint.
          if (!clone) {
            return;
          }
          for (const property of ['transform', 'translate', 'rotate', 'scale']) {
            clone.style.setProperty(property, 'none', 'important');
          }
        },
      },
    ],
  });
  const { w0, h0, contentX, contentY } = snapshot.meta;
  const widthCss = w0 + padding * 2;
  const heightCss = h0 + padding * 2;
  const width = Math.ceil(widthCss * dpr);
  const height = Math.ceil(heightCss * dpr);
  if (width * height > 1_000_000) {
    throw new Error('capture-budget');
  }
  // SnapDOM's crop clamps to its existing viewBox. Expand the serialized SVG's
  // viewport instead, so overflow/shadows are painted into the requested exterior.
  const svgText = decodeURIComponent(snapshot.url.slice(snapshot.url.indexOf(',') + 1));
  const svg = new DOMParser().parseFromString(svgText, 'image/svg+xml').documentElement;
  svg.setAttribute(
    'viewBox',
    `${contentX - padding} ${contentY - padding} ${widthCss} ${heightCss}`,
  );
  svg.setAttribute('width', String(widthCss));
  svg.setAttribute('height', String(heightCss));
  const image = new Image();
  image.src =
    'data:image/svg+xml;charset=utf-8,' +
    encodeURIComponent(new XMLSerializer().serializeToString(svg));
  const canvas = element.ownerDocument.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  let pixels = new Uint8Array();
  try {
    await image.decode();
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) {
      throw new Error('capture-context-unavailable');
    }
    context.drawImage(image, 0, 0, width, height);
    pixels = new Uint8Array(context.getImageData(0, 0, width, height).data);
  } finally {
    canvas.width = 0;
    canvas.height = 0;
    image.src = '';
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
