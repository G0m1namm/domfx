import { readMotionTokens } from './motion-tokens.ts';

const MIN_ZOOM = 1;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.5;
const HOVER_ZOOM = 2;
// Long enough that a pointer crossing the preview on its way to a control does nothing.
const HOVER_REST_MS = 200;
const PAN_STEP_PX = 32;
const CAPTURE_MARGIN_PX = 24;

export interface PreviewZoomOptions {
  /** The clipped region that receives pointer and keyboard inspection. */
  viewport: HTMLElement;
  /** Scales with `transform`, so the effect's host stays free to use `translate`. */
  camera: HTMLElement;
  /** Holds `[data-zoom-*]` and `[data-pan*]` controls; shown while the controller runs. */
  tools: HTMLElement;
  /** The element to keep in view, including any target the caller swaps in. */
  target: () => Element;
  signal: AbortSignal;
  reducedMotion: MediaQueryList;
}

export function initializePreviewZoom({
  viewport,
  camera,
  tools,
  target,
  signal,
  reducedMotion,
}: PreviewZoomOptions) {
  const label = required<HTMLElement>('[data-zoom-label]', tools);
  const zoomOut = required<HTMLButtonElement>('[data-zoom-out]', tools);
  const zoomIn = required<HTMLButtonElement>('[data-zoom-in]', tools);
  const panControls = required<HTMLElement>('[data-pan-controls]', tools);
  const canHover = matchMedia('(hover: hover) and (pointer: fine)');
  let zoom = MIN_ZOOM;
  let hovering = false;
  let panX = 0;
  let panY = 0;
  let drag: { id: number; x: number; y: number } | undefined;
  let springTimer = 0;
  let restTimer = 0;
  let panShown = false;
  let panMotion: Animation | undefined;

  // Deliberate changes spring; hover tracking keeps the camera's quick transition.
  function spring() {
    const { duration } = readMotionTokens(camera).enter;
    if (!duration) {
      return;
    }
    camera.dataset.zoomMotion = 'spring';
    window.clearTimeout(springTimer);
    springTimer = window.setTimeout(() => delete camera.dataset.zoomMotion, duration);
  }

  function rollLabel(next: string) {
    const from = Number.parseInt(label.textContent ?? '', 10);
    label.textContent = next;
    const { duration, easing } = readMotionTokens(label).enter;
    if (duration) {
      const offset = Number.parseInt(next, 10) > from ? '0.375rem' : '-0.375rem';
      label.animate(
        { opacity: [0, 1], translate: [`0 ${offset}`, '0 0'] },
        { duration: duration * 0.6, easing },
      );
    }
  }

  // The arrows slide out from behind the zoom group without resizing the chip.
  // `hidden` stays the source of truth once settled.
  function showPan(visible: boolean) {
    if (visible === panShown) {
      return;
    }
    panShown = visible;
    panMotion?.cancel();
    panMotion = undefined;
    const tokens = readMotionTokens(panControls);
    const timing = visible ? tokens.enter : tokens.exit;
    panControls.hidden = false;
    // Folding arrows are on their way out, so Tab must not land on them.
    panControls.inert = !visible;
    if (!timing.duration) {
      panControls.hidden = !visible;
      return;
    }
    const edges = visible ? ['0.5rem 0', '0 0'] : ['0 0', '0.5rem 0'];
    const motion = panControls.animate(
      { translate: edges, opacity: visible ? [0, 1] : [1, 0] },
      { ...timing, fill: 'both' },
    );
    panMotion = motion;
    motion.onfinish = () => {
      panControls.hidden = !visible;
      motion.cancel();
      panMotion = undefined;
    };
  }

  // Hover magnifies only at Fit; a chosen zoom is never overridden.
  function shownScale() {
    return hovering && zoom === MIN_ZOOM ? HOVER_ZOOM : zoom;
  }

  function render() {
    const scale = shownScale();
    const shown = target();
    const canvas = camera.querySelector('canvas');
    const width = Math.max(shown.clientWidth, canvas?.clientWidth ?? 0) + CAPTURE_MARGIN_PX;
    const height = Math.max(shown.clientHeight, canvas?.clientHeight ?? 0) + CAPTURE_MARGIN_PX;
    const limitX = Math.max(0, (width * scale - viewport.clientWidth) / 2);
    const limitY = Math.max(0, (height * scale - viewport.clientHeight) / 2);
    panX = Math.max(-limitX, Math.min(limitX, panX));
    panY = Math.max(-limitY, Math.min(limitY, panY));
    camera.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
    viewport.dataset.zoomed = String(scale > MIN_ZOOM);
    // The value and limits describe the chosen zoom, not a passing hover.
    const zoomLabel = `${Math.round(zoom * 100)}%`;
    if (label.textContent !== zoomLabel) {
      rollLabel(zoomLabel);
    }
    zoomOut.disabled = zoom <= MIN_ZOOM;
    zoomIn.disabled = zoom >= MAX_ZOOM;
    showPan(zoom > MIN_ZOOM);
  }

  function setZoom(value: number) {
    const before = shownScale();
    window.clearTimeout(restTimer);
    hovering = false;
    zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value));
    // Keep the inspected spot centered through the change; Fit always recenters.
    const ratio = zoom === MIN_ZOOM ? 0 : zoom / before;
    panX *= ratio;
    panY *= ratio;
    render();
  }

  function changeZoom(value: number) {
    spring();
    setZoom(value);
  }

  function aimAt(clientX: number, clientY: number) {
    const bounds = viewport.getBoundingClientRect();
    const scale = shownScale();
    panX = (bounds.width / 2 - (clientX - bounds.left)) * (scale - 1);
    panY = (bounds.height / 2 - (clientY - bounds.top)) * (scale - 1);
    render();
  }

  // Leaving keeps a chosen zoom exactly where it was, so reaching a control moves nothing.
  function endHover() {
    window.clearTimeout(restTimer);
    if (!hovering) {
      return;
    }
    hovering = false;
    spring();
    if (zoom === MIN_ZOOM) {
      panX = 0;
      panY = 0;
    }
    render();
  }

  function pan(direction: string) {
    spring();
    window.clearTimeout(restTimer);
    hovering = false;
    switch (direction) {
      case 'left':
        panX += PAN_STEP_PX;
        break;
      case 'right':
        panX -= PAN_STEP_PX;
        break;
      case 'up':
        panY += PAN_STEP_PX;
        break;
      case 'down':
        panY -= PAN_STEP_PX;
        break;
    }
    render();
  }

  zoomOut.addEventListener('click', () => changeZoom(zoom - ZOOM_STEP), { signal });
  zoomIn.addEventListener('click', () => changeZoom(zoom + ZOOM_STEP), { signal });
  required<HTMLButtonElement>('[data-zoom-reset]', tools).addEventListener(
    'click',
    () => changeZoom(MIN_ZOOM),
    { signal },
  );
  for (const button of tools.querySelectorAll<HTMLButtonElement>('[data-pan]')) {
    button.addEventListener('click', () => pan(button.dataset.pan ?? ''), { signal });
  }
  viewport.addEventListener(
    'pointermove',
    (event) => {
      if (drag?.id === event.pointerId) {
        panX += event.clientX - drag.x;
        panY += event.clientY - drag.y;
        drag.x = event.clientX;
        drag.y = event.clientY;
        render();
      } else if (event.pointerType === 'mouse' && canHover.matches && !reducedMotion.matches) {
        if (event.target instanceof Element && event.target.closest('button, a')) {
          endHover();
        } else if (hovering) {
          aimAt(event.clientX, event.clientY);
        } else {
          const { clientX, clientY } = event;
          window.clearTimeout(restTimer);
          restTimer = window.setTimeout(() => {
            hovering = true;
            aimAt(clientX, clientY);
          }, HOVER_REST_MS);
        }
      }
    },
    { signal },
  );
  viewport.addEventListener(
    'pointerleave',
    () => {
      if (!drag) {
        endHover();
      }
    },
    { signal },
  );
  viewport.addEventListener(
    'pointerdown',
    (event) => {
      if (
        event.pointerType === 'mouse' ||
        zoom <= MIN_ZOOM ||
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
        const next = event.key === '-' ? zoom - ZOOM_STEP : zoom + ZOOM_STEP;
        changeZoom(event.key === '0' ? MIN_ZOOM : next);
      } else if (
        zoom > MIN_ZOOM &&
        ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)
      ) {
        event.preventDefault();
        pan(event.key.slice(5).toLowerCase());
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
      window.clearTimeout(springTimer);
      window.clearTimeout(restTimer);
      panMotion?.cancel();
      panControls.hidden = true;
      delete camera.dataset.zoomMotion;
      camera.style.removeProperty('transform');
      delete viewport.dataset.zoomed;
      tools.hidden = true;
    },
    { once: true },
  );
  tools.hidden = false;
  render();
  return {
    /** Returns to Fit, as after a target change. */
    reset: () => changeZoom(MIN_ZOOM),
  };
}

function required<T extends Element>(selector: string, root: ParentNode): T {
  const element = root.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Missing preview zoom element: ${selector}`);
  }
  return element;
}
