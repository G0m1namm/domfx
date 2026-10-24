import { EffectError } from './effect-error.js';
import { scaleToViewport } from './placement.js';

export const relativeSourceGuardCss = 8;

/** Certify the bounded source policy before capture can omit distant paint.
 * Raster admission then checks actual alpha and the complete free margin.
 */
export function assertRelativeEffectSource(target: Element): void {
  const view = target.ownerDocument.defaultView;
  if (!view) {
    throw new EffectError('missing-exterior');
  }
  const box = target.getBoundingClientRect();
  const scale = scaleToViewport(target);
  for (const element of [target, ...target.querySelectorAll('*')]) {
    const style = view.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden') {
      continue;
    }
    const rects = element.getClientRects();
    const rect = element.getBoundingClientRect();
    let hasTextRects = false;
    const generated = ['::before', '::after'].some((pseudo) => {
      const content = view.getComputedStyle(element, pseudo).content;
      return content !== 'none' && content !== 'normal';
    });
    // Element rectangles omit raw text displaced by indentation or wrapping.
    // Keep logical font rectangles inside the canonical 8 CSS-pixel guard;
    // they can exceed visible glyph paint. Raster admission checks actual
    // glyph alpha against the stricter 2 CSS-pixel limit. Boxless elements
    // still own visible text, so inspect their ranges before skipping boxes.
    for (const child of element.childNodes) {
      if (child.nodeType !== view.Node.TEXT_NODE || !child.textContent?.trim()) {
        continue;
      }
      const range = target.ownerDocument.createRange();
      range.selectNodeContents(child);
      for (const text of range.getClientRects()) {
        hasTextRects = true;
        if (
          text.left < box.left - relativeSourceGuardCss * scale.x ||
          text.top < box.top - relativeSourceGuardCss * scale.y ||
          text.right > box.right + relativeSourceGuardCss * scale.x ||
          text.bottom > box.bottom + relativeSourceGuardCss * scale.y
        ) {
          throw new EffectError(
            'missing-exterior',
            'Relative effects require contained text paint.',
          );
        }
      }
    }
    if (rects.length === 0 && !hasTextRects) {
      continue;
    }
    if (
      style.boxShadow !== 'none' ||
      style.textShadow !== 'none' ||
      style.filter !== 'none' ||
      (style.outlineStyle !== 'none' && Number.parseFloat(style.outlineWidth) > 0) ||
      generated ||
      (rects.length > 0 &&
        (rect.left < box.left - 0.01 ||
          rect.top < box.top - 0.01 ||
          rect.right > box.right + 0.01 ||
          rect.bottom > box.bottom + 0.01))
    ) {
      throw new EffectError(
        'missing-exterior',
        'Relative effects require contained descendant boxes, no shadows, filters, outlines or generated pseudo-elements, and paint within the border box plus 2 CSS px.',
      );
    }
  }
}
