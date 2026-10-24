import { EffectError } from './effect-error.js';

/** Certify the bounded source policy before capture can omit distant paint.
 * Raster admission then checks actual alpha and the complete free margin.
 */
export function assertRelativeEffectSource(target: Element): void {
  const view = target.ownerDocument.defaultView;
  if (!view) {
    throw new EffectError('missing-exterior');
  }
  const box = target.getBoundingClientRect();
  for (const element of [target, ...target.querySelectorAll('*')]) {
    const style = view.getComputedStyle(element);
    if (
      style.display === 'none' ||
      style.visibility === 'hidden' ||
      element.getClientRects().length === 0
    ) {
      continue;
    }
    const rect = element.getBoundingClientRect();
    const generated = ['::before', '::after'].some((pseudo) => {
      const content = view.getComputedStyle(element, pseudo).content;
      return content !== 'none' && content !== 'normal';
    });
    if (
      style.boxShadow !== 'none' ||
      style.textShadow !== 'none' ||
      style.filter !== 'none' ||
      (style.outlineStyle !== 'none' && Number.parseFloat(style.outlineWidth) > 0) ||
      generated ||
      rect.left < box.left - 0.01 ||
      rect.top < box.top - 0.01 ||
      rect.right > box.right + 0.01 ||
      rect.bottom > box.bottom + 0.01
    ) {
      throw new EffectError(
        'missing-exterior',
        'Relative effects require contained descendant boxes, no shadows, filters, outlines or generated pseudo-elements, and paint within the border box plus 2 CSS px.',
      );
    }
  }
}
