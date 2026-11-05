const SHOW_DELAY_MS = 200;
const VIEWPORT_GAP_PX = 4;
const ANCHOR_GAP_PX = 2;

/**
 * Shows each `[data-tip]` control's accessible label in the top layer, above panels and
 * dialogs. Without the Popover API the controls keep their labels and show no tooltip.
 */
export function startTopLayerTooltips(scope: HTMLElement, signal: AbortSignal) {
  const document = scope.ownerDocument;
  const view = document.defaultView;
  if (!view || !('showPopover' in view.HTMLElement.prototype)) {
    return;
  }
  const tip = document.createElement('div');
  tip.className = 'control-box-tooltip';
  tip.setAttribute('role', 'tooltip');
  tip.setAttribute('popover', 'manual');
  scope.append(tip);
  let anchor: Element | undefined;
  let timer = 0;

  const isOpen = () => tip.matches(':popover-open');

  function hide() {
    view?.clearTimeout(timer);
    anchor = undefined;
    if (isOpen()) {
      tip.hidePopover();
    }
  }

  function show(next: Element) {
    if (next === anchor) {
      return;
    }
    hide();
    anchor = next;
    timer =
      view?.setTimeout(() => {
        if (!next.isConnected || !view) {
          return;
        }
        tip.textContent = next.getAttribute('aria-label');
        tip.showPopover();
        const from = next.getBoundingClientRect();
        const size = tip.getBoundingClientRect();
        const left = from.left + from.width / 2 - size.width / 2;
        const maxLeft = view.innerWidth - size.width - VIEWPORT_GAP_PX;
        tip.style.left = `${Math.max(VIEWPORT_GAP_PX, Math.min(maxLeft, left))}px`;
        const above = from.top - size.height - ANCHOR_GAP_PX;
        tip.style.top = `${above >= VIEWPORT_GAP_PX ? above : from.bottom + ANCHOR_GAP_PX}px`;
      }, SHOW_DELAY_MS) ?? 0;
  }

  const tipFor = (event: Event) =>
    event.target instanceof Element ? event.target.closest('[data-tip]') : null;

  scope.addEventListener(
    'pointerover',
    (event) => {
      const next = tipFor(event);
      if (!next) {
        hide();
      } else if (event.pointerType === 'mouse') {
        show(next);
      }
    },
    { signal },
  );
  scope.addEventListener('pointerleave', hide, { signal });
  scope.addEventListener(
    'focusin',
    (event) => {
      const next = tipFor(event);
      if (next?.matches(':focus-visible')) {
        show(next);
      }
    },
    { signal },
  );
  scope.addEventListener('focusout', hide, { signal });
  scope.addEventListener('pointerdown', hide, { capture: true, signal });
  document.addEventListener(
    'keydown',
    (event) => {
      if (event.key !== 'Escape' || !(anchor || isOpen())) {
        return;
      }
      // Esc dismisses only the tooltip; a second press reaches the panel or dialog.
      const shown = isOpen();
      hide();
      if (shown) {
        event.preventDefault();
        event.stopPropagation();
      }
    },
    { capture: true, signal },
  );
  signal.addEventListener(
    'abort',
    () => {
      hide();
      tip.remove();
    },
    { once: true },
  );
}
