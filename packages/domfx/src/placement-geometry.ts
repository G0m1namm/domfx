/** Measured geometry for supported positive axis-aligned scale and translation. */
export interface PlacementGeometry {
  readonly target: {
    /** Border-box origin in viewport pixels. */
    readonly viewportOrigin: { readonly x: number; readonly y: number };
    /** Target-local CSS pixels to viewport pixels. */
    readonly scaleToViewport: { readonly x: number; readonly y: number };
  };
  readonly host: {
    /** Border-box origin in viewport pixels. */
    readonly viewportOrigin: { readonly x: number; readonly y: number };
    /** Host-local CSS pixels to viewport pixels. */
    readonly scaleToViewport: { readonly x: number; readonly y: number };
    /** Host-local CSS offset including fractional borders and scrollbar gutters. */
    readonly clientOriginCss: { readonly x: number; readonly y: number };
    readonly scrollCss: { readonly x: number; readonly y: number };
  };
  /** Intersection of bypassed rectangular clips in viewport pixels; unbounded edges use infinities. */
  readonly clipViewport: {
    readonly left: number;
    readonly top: number;
    readonly right: number;
    readonly bottom: number;
  };
  readonly capture: {
    /** Raster pixel dimensions, including captured padding. */
    readonly width: number;
    readonly height: number;
    /** Raster pixels to untransformed target-local CSS pixels, including the padding offset. */
    readonly pixelToTargetLocal: {
      readonly a: number;
      readonly d: number;
      readonly e: number;
      readonly f: number;
    };
  };
}

/** Map a capture raster into host-local CSS coordinates without measuring or changing the page. */
export function calculateEffectPlacement({
  target,
  host,
  clipViewport,
  capture,
}: PlacementGeometry) {
  const targetScale = target.scaleToViewport;
  const hostScale = host.scaleToViewport;
  const mapping = capture.pixelToTargetLocal;
  const scaleX = targetScale.x / hostScale.x;
  const scaleY = targetScale.y / hostScale.y;
  const targetOriginX =
    (target.viewportOrigin.x - host.viewportOrigin.x) / hostScale.x -
    host.clientOriginCss.x +
    host.scrollCss.x;
  const targetOriginY =
    (target.viewportOrigin.y - host.viewportOrigin.y) / hostScale.y -
    host.clientOriginCss.y +
    host.scrollCss.y;

  const viewportLeft = target.viewportOrigin.x + mapping.e * targetScale.x;
  const viewportTop = target.viewportOrigin.y + mapping.f * targetScale.y;
  const width = capture.width * mapping.a * scaleX;
  const height = capture.height * mapping.d * scaleY;
  const insetLeft = Math.min(width, Math.max(0, (clipViewport.left - viewportLeft) / hostScale.x));
  const insetTop = Math.min(height, Math.max(0, (clipViewport.top - viewportTop) / hostScale.y));
  const insetRight = Math.min(
    width,
    Math.max(0, width - (clipViewport.right - viewportLeft) / hostScale.x),
  );
  const insetBottom = Math.min(
    height,
    Math.max(0, height - (clipViewport.bottom - viewportTop) / hostScale.y),
  );

  return {
    left: targetOriginX + mapping.e * scaleX,
    top: targetOriginY + mapping.f * scaleY,
    width,
    height,
    clipPath:
      insetTop || insetRight || insetBottom || insetLeft
        ? `inset(${insetTop}px ${insetRight}px ${insetBottom}px ${insetLeft}px)`
        : 'none',
  };
}
