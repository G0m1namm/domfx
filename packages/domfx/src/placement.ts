import type { CaptureFrame } from '@domfx/core';

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
      (style.zoom !== '1' && style.zoom !== 'normal')
    ) {
      throw new Error('unsupported-placement');
    }

    x *= matrix.a * scale[0];
    y *= matrix.d * (scale[1] ?? scale[0]);
  }

  return { x, y };
}

/** Measure the captured raster in effect-host CSS pixels before writing layer styles. */
export function measureEffectPlacement(target: Element, host: HTMLElement, frame: CaptureFrame) {
  const targetScale = scaleToViewport(target);
  const hostScale = scaleToViewport(host);
  const targetRect = target.getBoundingClientRect();
  const hostRect = host.getBoundingClientRect();

  const scaleX = targetScale.x / hostScale.x;
  const scaleY = targetScale.y / hostScale.y;
  const targetOriginX =
    (targetRect.left - hostRect.left) / hostScale.x - host.clientLeft + host.scrollLeft;
  const targetOriginY =
    (targetRect.top - hostRect.top) / hostScale.y - host.clientTop + host.scrollTop;

  return {
    left: targetOriginX + frame.pixelToLocal.e * scaleX,
    top: targetOriginY + frame.pixelToLocal.f * scaleY,
    width: frame.width * frame.pixelToLocal.a * scaleX,
    height: frame.height * frame.pixelToLocal.d * scaleY,
  };
}
