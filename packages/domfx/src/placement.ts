import { autoUpdate, computePosition, offset, platform } from '@floating-ui/dom';

import type { CaptureFrame } from '@domfx/core';

import { cssEffectError } from './effect-error.js';
import { calculateEffectPlacement, type PlacementGeometry } from './placement-geometry.js';

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

    let property: string | undefined;
    if (!matrix.is2D || matrix.b !== 0 || matrix.c !== 0 || matrix.a <= 0 || matrix.d <= 0) {
      property = 'transform';
    } else if (style.perspective !== 'none') {
      property = 'perspective';
    } else if (style.rotate !== 'none' && style.rotate !== '0deg') {
      property = 'rotate';
    } else if (scale.length > 2 || scale.some((value) => !Number.isFinite(value) || value <= 0)) {
      property = 'scale';
    } else if (style.translate !== 'none' && style.translate.split(/\s+/).length > 2) {
      property = 'translate';
    } else if (style.zoom !== '1' && style.zoom !== 'normal') {
      property = 'zoom';
    }
    if (property) {
      throw cssEffectError(
        'unsupported-placement',
        node,
        property,
        style.getPropertyValue(property),
        'Use translation and positive axis-aligned 2D scale; remove rotation, skew, perspective and CSS zoom.',
      );
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
      throw cssEffectError(
        'unsupported-placement',
        node,
        'position',
        style.position,
        'Use a positioned, non-fixed target or ancestor.',
      );
    }
    // The layer bypasses this group. Captured alpha cannot reproduce group
    // opacity, filters or blending of the original target together with its fire.
    if (
      style.opacity !== '1' ||
      style.filter !== 'none' ||
      style.backdropFilter !== 'none' ||
      style.mixBlendMode !== 'normal'
    ) {
      const property =
        style.opacity !== '1'
          ? 'opacity'
          : style.filter !== 'none'
            ? 'filter'
            : style.backdropFilter !== 'none'
              ? 'backdrop-filter'
              : 'mix-blend-mode';
      throw cssEffectError(
        'unsupported-composition',
        node,
        property,
        style.getPropertyValue(property),
        'Remove this group effect from the target/intermediate ancestor or apply it to the shared effect host.',
      );
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
      const property =
        style.clipPath !== 'none'
          ? 'clip-path'
          : style.maskImage !== 'none'
            ? 'mask-image'
            : style.clip !== 'auto'
              ? 'clip'
              : /\b(paint|strict|content)\b/.test(style.contain)
                ? 'contain'
                : 'content-visibility';
      throw cssEffectError(
        'unsupported-placement',
        node,
        property,
        style.getPropertyValue(property),
        'Remove this ancestor clip or move it to the shared effect host so native clipping includes the effect.',
      );
    }
    const clipX = style.overflowX !== 'visible';
    const clipY = style.overflowY !== 'visible';
    if (!clipX && !clipY) {
      continue;
    }
    const roundedCorner = [
      'border-top-left-radius',
      'border-top-right-radius',
      'border-bottom-left-radius',
      'border-bottom-right-radius',
    ].find((property) => Number.parseFloat(style.getPropertyValue(property)) !== 0);
    const property = !(node instanceof view.HTMLElement)
      ? 'overflow'
      : style.position === 'static'
        ? 'position'
        : style.overflowX === 'clip'
          ? 'overflow-x'
          : style.overflowY === 'clip'
            ? 'overflow-y'
            : roundedCorner;
    if (!(node instanceof view.HTMLElement) || property) {
      throw cssEffectError(
        'unsupported-placement',
        node,
        property ?? 'overflow',
        style.getPropertyValue(property ?? 'overflow'),
        'Use a positioned HTML ancestor with rectangular overflow, or move clipping to the shared effect host.',
      );
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
export async function measureEffectPlacement(
  target: Element,
  host: HTMLElement,
  layer: HTMLElement,
  frame: CaptureFrame,
) {
  const origin = await computePosition(target, layer, {
    strategy: 'absolute',
    placement: 'bottom-start',
    // Effects overlap the physical top-left, regardless of text direction.
    platform: { ...platform, isRTL: () => false },
    middleware: [offset(({ rects }) => -rects.reference.height)],
  });
  const targetScale = scaleToViewport(target);
  const hostScale = scaleToViewport(host);
  const targetRect = target.getBoundingClientRect();
  const floatingScale = await platform.getScale(host);
  const client = clientOrigin(host, host.ownerDocument.defaultView!.getComputedStyle(host));
  // Floating UI normalizes by rounded DOM scale/client metrics. Convert its origin
  // to exact host CSS units, retaining its scrollbar gutter and physical alignment.
  const hostOriginCss = {
    x:
      ((origin.x - host.scrollLeft + host.clientLeft) * floatingScale.x) / hostScale.x +
      host.scrollLeft -
      client.x,
    y:
      ((origin.y - host.scrollTop + host.clientTop) * floatingScale.y) / hostScale.y +
      host.scrollTop -
      client.y,
  };

  const geometry: PlacementGeometry = {
    target: {
      viewportOrigin: { x: targetRect.left, y: targetRect.top },
      hostOriginCss,
      scaleToViewport: targetScale,
    },
    host: {
      scaleToViewport: hostScale,
    },
    clipViewport: measureClip(target, host),
    capture: {
      width: frame.width,
      height: frame.height,
      pixelToTargetLocal: frame.pixelToLocal,
    },
  };

  return calculateEffectPlacement(geometry);
}

/** Notifications join the document scheduler; transform tracking stays on its shared frame. */
export function observeEffectPlacement(target: Element, layer: HTMLElement, changed: () => void) {
  // The attachment owns size invalidation and shared-frame geometry tracking.
  // Floating UI's element-resize observer queues a frame its cleanup cannot cancel.
  return autoUpdate(target, layer, changed, { animationFrame: false, elementResize: false });
}
