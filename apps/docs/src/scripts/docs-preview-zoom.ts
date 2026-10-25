export function initializeDocsPreview(
  lab: HTMLElement,
  signal: AbortSignal,
  reducedMotion: MediaQueryList,
) {
  const viewport = required<HTMLElement>('[data-docs-preview]', lab);
  const camera = required<HTMLElement>('[data-docs-preview-camera]', viewport);
  const tools = required<HTMLElement>('[data-docs-preview-tools]', lab);
  const label = required<HTMLOutputElement>('[data-docs-zoom-label]', tools);
  const zoomOut = required<HTMLButtonElement>('[data-docs-zoom-out]', tools);
  const zoomIn = required<HTMLButtonElement>('[data-docs-zoom-in]', tools);
  const panControls = required<HTMLElement>('[data-docs-pan-controls]', tools);
  const canHover = matchMedia('(hover: hover) and (pointer: fine)');
  let zoom = 1;
  let hovering = false;
  let panX = 0;
  let panY = 0;
  let drag: { id: number; x: number; y: number } | undefined;

  function render() {
    const scale = hovering ? Math.max(2, zoom) : zoom;
    const target = required<HTMLElement | SVGElement>(
      '[data-docs-lab-target]:not([hidden]), [data-gsap-target]',
      camera,
    );
    const canvas = camera.querySelector('canvas');
    const width = Math.max(target.clientWidth, canvas?.clientWidth ?? 0) + 24;
    const height = Math.max(target.clientHeight, canvas?.clientHeight ?? 0) + 24;
    const limitX = Math.max(0, (width * scale - viewport.clientWidth) / 2);
    const limitY = Math.max(0, (height * scale - viewport.clientHeight) / 2);
    panX = Math.max(-limitX, Math.min(limitX, panX));
    panY = Math.max(-limitY, Math.min(limitY, panY));
    camera.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
    viewport.dataset.zoomed = String(scale > 1);
    const zoomLabel = `${Math.round(scale * 100)}%`;
    if (label.value !== zoomLabel) {
      label.value = zoomLabel;
    }
    zoomOut.disabled = zoom <= 1;
    zoomIn.disabled = zoom >= 3;
    panControls.hidden = zoom <= 1;
  }

  function setZoom(value: number) {
    zoom = Math.max(1, Math.min(3, value));
    hovering = false;
    panX = 0;
    panY = 0;
    render();
  }

  function pan(direction: string) {
    hovering = false;
    switch (direction) {
      case 'left':
        panX += 32;
        break;
      case 'right':
        panX -= 32;
        break;
      case 'up':
        panY += 32;
        break;
      case 'down':
        panY -= 32;
        break;
    }
    render();
  }

  zoomOut.addEventListener('click', () => setZoom(zoom - 0.5), { signal });
  zoomIn.addEventListener('click', () => setZoom(zoom + 0.5), { signal });
  required<HTMLButtonElement>('[data-docs-zoom-reset]', tools).addEventListener(
    'click',
    () => setZoom(1),
    { signal },
  );
  for (const button of tools.querySelectorAll<HTMLButtonElement>('[data-docs-pan]')) {
    button.addEventListener('click', () => pan(button.dataset.docsPan ?? ''), { signal });
  }
  viewport.addEventListener(
    'pointermove',
    (event) => {
      if (drag?.id === event.pointerId) {
        panX += event.clientX - drag.x;
        panY += event.clientY - drag.y;
        drag.x = event.clientX;
        drag.y = event.clientY;
      } else if (event.pointerType === 'mouse' && canHover.matches && !reducedMotion.matches) {
        if (event.target instanceof Element && event.target.closest('button, a')) {
          return;
        }
        hovering = true;
        const bounds = viewport.getBoundingClientRect();
        const scale = Math.max(2, zoom);
        panX = (bounds.width / 2 - (event.clientX - bounds.left)) * (scale - 1);
        panY = (bounds.height / 2 - (event.clientY - bounds.top)) * (scale - 1);
      } else {
        return;
      }
      render();
    },
    { signal },
  );
  viewport.addEventListener(
    'pointerleave',
    () => {
      if (!drag) {
        setZoom(zoom);
      }
    },
    { signal },
  );
  viewport.addEventListener(
    'pointerdown',
    (event) => {
      if (
        event.pointerType === 'mouse' ||
        zoom <= 1 ||
        (event.target instanceof Element && event.target.closest('button, a'))
      ) {
        return;
      }
      event.preventDefault();
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
      viewport.setPointerCapture(event.pointerId);
    },
    { signal },
  );
  function endDrag() {
    drag = undefined;
  }
  viewport.addEventListener('pointerup', endDrag, { signal });
  viewport.addEventListener('pointercancel', endDrag, { signal });
  viewport.addEventListener('lostpointercapture', endDrag, { signal });
  viewport.addEventListener(
    'keydown',
    (event) => {
      if (event.target !== viewport || event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }
      if (['+', '=', '-', '0'].includes(event.key)) {
        event.preventDefault();
        const next = event.key === '-' ? zoom - 0.5 : zoom + 0.5;
        setZoom(event.key === '0' ? 1 : next);
      } else if (
        zoom > 1 &&
        ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)
      ) {
        event.preventDefault();
        pan(event.key.slice(5).toLowerCase());
      }
    },
    { signal },
  );
  lab.addEventListener(
    'change',
    (event) => {
      if (event.target instanceof Element && event.target.matches('[data-docs-lab-subject]')) {
        setZoom(1);
      }
    },
    { signal },
  );
  reducedMotion.addEventListener('change', () => setZoom(zoom), { signal });
  canHover.addEventListener('change', () => setZoom(zoom), { signal });
  const observer = new ResizeObserver(() => setZoom(zoom));
  observer.observe(viewport);
  signal.addEventListener(
    'abort',
    () => {
      if (drag && viewport.hasPointerCapture(drag.id)) {
        viewport.releasePointerCapture(drag.id);
      }
      observer.disconnect();
      camera.style.removeProperty('transform');
      delete viewport.dataset.zoomed;
      tools.hidden = true;
    },
    { once: true },
  );
  tools.hidden = false;
  render();
}

function required<T extends Element>(selector: string, root: ParentNode): T {
  const element = root.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Missing docs preview element: ${selector}`);
  }
  return element;
}
