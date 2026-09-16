import type { CaptureFrame } from '@domfx/core';

import { EffectError } from './effect-error.js';

/** Only the selected root's outer transform is excluded from captured paint. */
export function isPlacementMutation(record: MutationRecord, target: Element): boolean {
  if (
    record.target !== target ||
    record.type !== 'attributes' ||
    record.attributeName !== 'style'
  ) {
    return false;
  }
  const before = target.ownerDocument.createElement('div').style;
  const after = target.ownerDocument.createElement('div').style;
  before.cssText = record.oldValue ?? '';
  after.cssText = target.getAttribute('style') ?? '';
  for (const property of ['transform', 'transform-origin', 'translate', 'rotate', 'scale']) {
    before.removeProperty(property);
    after.removeProperty(property);
  }
  return before.cssText === after.cssText;
}

/** Accumulated positive axis-aligned scale from local CSS pixels to viewport pixels. */
export function scaleToViewport(element: Element): { x: number; y: number } {
  const view = element.ownerDocument.defaultView;
  if (!view) {
    throw new Error('document-unavailable');
  }

  let x = 1;
  let y = 1;

  for (let node: Element | null = element; node; node = node.parentElement) {
    const style = view.getComputedStyle(node);
    const matrix = new view.DOMMatrixReadOnly(
      style.transform === 'none' ? undefined : style.transform,
    );
    const scale = style.scale === 'none' ? [1] : style.scale.split(/\s+/).map(Number);

    if (
      !matrix.is2D ||
      matrix.b !== 0 ||
      matrix.c !== 0 ||
      matrix.a <= 0 ||
      matrix.d <= 0 ||
      style.perspective !== 'none' ||
      (style.rotate !== 'none' && style.rotate !== '0deg') ||
      scale.length > 2 ||
      scale.some((value) => !Number.isFinite(value) || value <= 0) ||
      (style.translate !== 'none' && style.translate.split(/\s+/).length > 2) ||
      (style.zoom !== '1' && style.zoom !== 'normal')
    ) {
      throw new EffectError('unsupported-placement');
    }

    x *= matrix.a * scale[0];
    y *= matrix.d * (scale[1] ?? scale[0]);
  }

  return { x, y };
}

/** Client metrics are integers; keep fractional borders while retaining scrollbar gutters. */
function clientOrigin(element: HTMLElement, style: CSSStyleDeclaration) {
  const left = Number.parseFloat(style.borderLeftWidth);
  const top = Number.parseFloat(style.borderTopWidth);
  return {
    x: left + element.clientLeft - Math.round(left),
    y: top + element.clientTop - Math.round(top),
  };
}

/** The host's own clip is native. Reproduce only rectangular clips bypassed by insertion. */
function measureClip(target: Element, host: HTMLElement) {
  const view = host.ownerDocument.defaultView!;
  let left = -Infinity;
  let top = -Infinity;
  let right = Infinity;
  let bottom = Infinity;

  for (let node: Element | null = target; node && node !== host; node = node.parentElement) {
    const style = view.getComputedStyle(node);
    if (style.position === 'fixed') {
      throw new EffectError('unsupported-placement');
    }
    // The layer bypasses this group. Captured alpha cannot reproduce group
    // opacity, filters or blending of the original target together with its fire.
    if (
      style.opacity !== '1' ||
      style.filter !== 'none' ||
      style.backdropFilter !== 'none' ||
      style.mixBlendMode !== 'normal'
    ) {
      throw new EffectError('unsupported-composition');
    }
    // The selected target's own clipping is captured paint, not an ancestor clip.
    if (node === target) {
      continue;
    }
    if (
      style.clipPath !== 'none' ||
      style.maskImage !== 'none' ||
      style.clip !== 'auto' ||
      /\b(paint|strict|content)\b/.test(style.contain) ||
      style.contentVisibility !== 'visible'
    ) {
      throw new EffectError('unsupported-placement');
    }
    const clipX = style.overflowX !== 'visible';
    const clipY = style.overflowY !== 'visible';
    if (!clipX && !clipY) {
      continue;
    }
    if (
      !(node instanceof view.HTMLElement) ||
      style.position === 'static' ||
      style.overflowX === 'clip' ||
      style.overflowY === 'clip' ||
      [
        style.borderTopLeftRadius,
        style.borderTopRightRadius,
        style.borderBottomLeftRadius,
        style.borderBottomRightRadius,
      ].some((radius) => Number.parseFloat(radius) !== 0)
    ) {
      throw new EffectError('unsupported-placement');
    }
    const scale = scaleToViewport(node);
    const rect = node.getBoundingClientRect();
    const origin = clientOrigin(node, style);
    const paddingWidth =
      rect.width / scale.x -
      Number.parseFloat(style.borderLeftWidth) -
      Number.parseFloat(style.borderRightWidth);
    const paddingHeight =
      rect.height / scale.y -
      Number.parseFloat(style.borderTopWidth) -
      Number.parseFloat(style.borderBottomWidth);
    const width = paddingWidth - (Math.round(paddingWidth) - node.clientWidth);
    const height = paddingHeight - (Math.round(paddingHeight) - node.clientHeight);
    if (clipX) {
      left = Math.max(left, rect.left + origin.x * scale.x);
      right = Math.min(right, rect.left + (origin.x + width) * scale.x);
    }
    if (clipY) {
      top = Math.max(top, rect.top + origin.y * scale.y);
      bottom = Math.min(bottom, rect.top + (origin.y + height) * scale.y);
    }
  }
  return { left, top, right, bottom };
}

/** Target intersection with the viewport and native ancestor overflow clips. */
export function isTargetVisible(target: Element): boolean {
  const view = target.ownerDocument.defaultView!;
  const rect = target.getBoundingClientRect();
  let left = Math.max(0, rect.left);
  let top = Math.max(0, rect.top);
  let right = Math.min(view.innerWidth, rect.right);
  let bottom = Math.min(view.innerHeight, rect.bottom);
  for (let node = target.parentElement; node; node = node.parentElement) {
    const style = view.getComputedStyle(node);
    if (style.overflowX === 'visible' && style.overflowY === 'visible') {
      continue;
    }
    const bounds = node.getBoundingClientRect();
    const scale = scaleToViewport(node);
    const origin = clientOrigin(node, style);
    if (style.overflowX !== 'visible') {
      left = Math.max(left, bounds.left + origin.x * scale.x);
      right = Math.min(right, bounds.left + (origin.x + node.clientWidth) * scale.x);
    }
    if (style.overflowY !== 'visible') {
      top = Math.max(top, bounds.top + origin.y * scale.y);
      bottom = Math.min(bottom, bounds.top + (origin.y + node.clientHeight) * scale.y);
    }
  }
  return right > left && bottom > top;
}

/** Check admission and pending work without needing captured pixels. */
export function assertEffectComposition(target: Element, host: HTMLElement) {
  scaleToViewport(target);
  measureClip(target, host);
}

/** Measure the captured raster in effect-host CSS pixels before writing layer styles. */
export function measureEffectPlacement(target: Element, host: HTMLElement, frame: CaptureFrame) {
  const targetScale = scaleToViewport(target);
  const hostScale = scaleToViewport(host);
  const targetRect = target.getBoundingClientRect();
  const hostRect = host.getBoundingClientRect();
  const hostOrigin = clientOrigin(host, host.ownerDocument.defaultView!.getComputedStyle(host));

  const scaleX = targetScale.x / hostScale.x;
  const scaleY = targetScale.y / hostScale.y;
  const targetOriginX =
    (targetRect.left - hostRect.left) / hostScale.x - hostOrigin.x + host.scrollLeft;
  const targetOriginY =
    (targetRect.top - hostRect.top) / hostScale.y - hostOrigin.y + host.scrollTop;

  const clip = measureClip(target, host);
  const viewportLeft = targetRect.left + frame.pixelToLocal.e * targetScale.x;
  const viewportTop = targetRect.top + frame.pixelToLocal.f * targetScale.y;
  const width = frame.width * frame.pixelToLocal.a * scaleX;
  const height = frame.height * frame.pixelToLocal.d * scaleY;
  const insetLeft = Math.min(width, Math.max(0, (clip.left - viewportLeft) / hostScale.x));
  const insetTop = Math.min(height, Math.max(0, (clip.top - viewportTop) / hostScale.y));
  const insetRight = Math.min(
    width,
    Math.max(0, width - (clip.right - viewportLeft) / hostScale.x),
  );
  const insetBottom = Math.min(
    height,
    Math.max(0, height - (clip.bottom - viewportTop) / hostScale.y),
  );

  return {
    left: targetOriginX + frame.pixelToLocal.e * scaleX,
    top: targetOriginY + frame.pixelToLocal.f * scaleY,
    width,
    height,
    clipPath:
      insetTop || insetRight || insetBottom || insetLeft
        ? `inset(${insetTop}px ${insetRight}px ${insetBottom}px ${insetLeft}px)`
        : 'none',
  };
}
