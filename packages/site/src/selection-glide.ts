export interface SelectionGlideOptions {
  /** Selects every option in the group. */
  items: string;
  /** Selects the current option; the first rendered match wins. */
  selected: string;
  /** `fill` slides a chip behind the option; `line` slides an underline below it. */
  variant: 'fill' | 'line';
  /** Removes the indicator and its observers when aborted. */
  signal: AbortSignal;
}

/** Moves one indicator between a group's options. Timing comes from motion.css. */
export function glideSelection(group: HTMLElement, options: SelectionGlideOptions) {
  const { items, selected, variant, signal } = options;
  const glider = group.ownerDocument.createElement('span');
  glider.className = 'selection-glider';
  glider.setAttribute('aria-hidden', 'true');
  group.prepend(glider);
  group.classList.add('selection-glide');
  group.dataset.selectionGlide = variant;

  const place = (animate: boolean) => {
    const active = Array.from(group.querySelectorAll<HTMLElement>(selected)).find(
      (item) => item.offsetParent !== null,
    );
    glider.toggleAttribute('hidden', !active);
    if (!active) {
      return;
    }
    if (!animate) {
      glider.style.transition = 'none';
    }
    const top =
      variant === 'line'
        ? active.offsetTop + active.offsetHeight - glider.offsetHeight
        : active.offsetTop;
    glider.style.translate = `${active.offsetLeft}px ${top}px`;
    glider.style.inlineSize = `${active.offsetWidth}px`;
    if (variant === 'fill') {
      glider.style.blockSize = `${active.offsetHeight}px`;
    }
    if (!animate) {
      // Commit the jump before the transition comes back.
      void glider.offsetWidth;
      glider.style.removeProperty('transition');
    }
  };

  const selection = new MutationObserver(() => place(true));
  selection.observe(group, {
    subtree: true,
    attributes: true,
    attributeFilter: ['aria-pressed', 'aria-selected'],
  });
  group.addEventListener('change', () => place(true), { signal });
  const size = new ResizeObserver(() => place(false));
  size.observe(group);
  for (const item of group.querySelectorAll(items)) {
    size.observe(item);
  }
  place(false);

  signal.addEventListener(
    'abort',
    () => {
      selection.disconnect();
      size.disconnect();
      glider.remove();
      group.classList.remove('selection-glide');
      delete group.dataset.selectionGlide;
    },
    { once: true },
  );
}
