import type * as BrowserEffects from '@domfx/browser';
import type { EffectHandle } from '@domfx/browser';

function initializeFireLabs() {
  const labs = document.querySelectorAll<HTMLElement>('[data-docs-fire-lab]');
  if (!labs.length) {
    return;
  }

  const hasGpu = 'gpu' in navigator && Boolean(navigator.gpu);
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

  for (const lab of labs) {
    const host = required<HTMLElement>('[data-docs-fire-host]', lab);
    const target = required<HTMLElement>('[data-docs-fire-target]', lab);
    const intensityInput = required<HTMLInputElement>('[data-docs-intensity]', lab);
    const heightInput = required<HTMLInputElement>('[data-docs-height]', lab);
    const intensityOutput = required<HTMLOutputElement>('[data-docs-intensity-output]', lab);
    const heightOutput = required<HTMLOutputElement>('[data-docs-height-output]', lab);
    const intensityCode = required<HTMLOutputElement>('[data-docs-intensity-code]', lab);
    const heightCode = required<HTMLOutputElement>('[data-docs-height-code]', lab);
    const status = required<HTMLElement>('[data-docs-fire-status]', lab);
    const toggle = required<HTMLButtonElement>('[data-docs-fire-toggle]', lab);
    const lifetime = new AbortController();
    let visible = false;
    let paused = false;
    let disposed = false;
    let revision = 0;
    let attachFrame = 0;
    let staleRetries = 0;
    let handle: EffectHandle | undefined;
    let browserModule: Promise<typeof BrowserEffects> | undefined;

    const on = <K extends keyof HTMLElementEventMap>(
      element: HTMLElement,
      type: K,
      listener: (event: HTMLElementEventMap[K]) => void,
    ) => element.addEventListener(type, listener as EventListener, { signal: lifetime.signal });

    function updateValues() {
      const intensity = Number(intensityInput.value);
      const height = Number(heightInput.value);
      intensityOutput.value = `${intensity}%`;
      heightOutput.value = `${height}px`;
      intensityCode.value = (intensity / 100).toFixed(2).replace(/0$/, '');
      heightCode.value = String(height);
    }

    function setStatus(message: string, state: string) {
      status.textContent = message;
      lab.dataset.status = state;
    }

    function updateToggle() {
      const unavailable = !hasGpu || reducedMotion.matches;
      toggle.disabled = unavailable;
      toggle.setAttribute('aria-pressed', String(paused));
      toggle.textContent = unavailable
        ? reducedMotion.matches
          ? 'Reduced motion'
          : 'Effects unavailable'
        : !handle || handle.lifecycle !== 'active'
          ? 'Start effect'
          : paused
            ? 'Resume effect'
            : 'Pause effect';
    }

    async function attach() {
      const currentRevision = ++revision;
      handle?.dispose();
      handle = undefined;
      paused = false;
      updateToggle();

      if (disposed || !visible) {
        return;
      }
      if (!hasGpu) {
        setStatus('Effects are unavailable in this browser.', 'unavailable');
        return;
      }
      if (reducedMotion.matches) {
        setStatus('Reduced motion keeps this example still.', 'reduced-motion');
        return;
      }

      setStatus('Preparing the live attachment…', 'initializing');
      try {
        browserModule ??= import('@domfx/browser');
        const { attachFire } = await browserModule;
        if (disposed || currentRevision !== revision) {
          return;
        }
        const nextHandle = attachFire(target, {
          host,
          clock: 'auto',
          motion: 'respect',
          intensity: Number(intensityInput.value) / 100,
          flameHeight: Number(heightInput.value),
          seed: 314,
        });
        handle = nextHandle;
        await nextHandle.ready;
        if (disposed || currentRevision !== revision) {
          nextHandle.dispose();
          return;
        }
        if (nextHandle.lifecycle === 'active') {
          staleRetries = 0;
          delete lab.dataset.reason;
          setStatus('Live attachment active.', 'active');
        } else if (nextHandle.reason === 'stale-raster' && visible && staleRetries < 1) {
          staleRetries += 1;
          nextHandle.dispose();
          handle = undefined;
          scheduleAttach();
          return;
        } else {
          lab.dataset.reason = nextHandle.reason ?? 'unavailable';
          setStatus('The original text remains available.', nextHandle.reason ?? 'unavailable');
        }
        updateToggle();
      } catch (error) {
        if (!disposed && currentRevision === revision) {
          lab.dataset.reason = error instanceof Error ? error.message : String(error);
          setStatus('The original text remains available.', 'unavailable');
        }
      }
    }

    function scheduleAttach() {
      cancelAnimationFrame(attachFrame);
      attachFrame = requestAnimationFrame(() => {
        attachFrame = requestAnimationFrame(() => {
          attachFrame = 0;
          if (visible && !handle) {
            void attach();
          }
        });
      });
    }

    function dispose() {
      disposed = true;
      revision += 1;
      cancelAnimationFrame(attachFrame);
      lifetime.abort();
      observer.disconnect();
      handle?.dispose();
      handle = undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting && entry.intersectionRatio > 0;
        if (!visible) {
          staleRetries = 0;
          return;
        }
        if (handle?.reason === 'stale-raster') {
          handle.dispose();
          handle = undefined;
        }
        if (!handle) {
          scheduleAttach();
        }
      },
      { threshold: Number.EPSILON },
    );

    updateValues();
    updateToggle();
    observer.observe(target);

    on(intensityInput, 'input', () => {
      updateValues();
      if (handle?.lifecycle === 'active') {
        handle.intensity = Number(intensityInput.value) / 100;
      }
    });
    on(heightInput, 'input', updateValues);
    on(heightInput, 'change', () => void attach());
    on(toggle, 'click', () => {
      if (!handle || handle.lifecycle !== 'active') {
        void attach();
        return;
      }
      paused = !paused;
      if (paused) {
        handle.pause();
        setStatus('Live attachment paused.', 'paused');
      } else {
        handle.resume();
        setStatus('Live attachment active.', 'active');
      }
      updateToggle();
    });
    reducedMotion.addEventListener(
      'change',
      () => {
        if (reducedMotion.matches) {
          handle?.dispose();
          handle = undefined;
          paused = false;
          setStatus('Reduced motion keeps this example still.', 'reduced-motion');
        } else if (visible) {
          setStatus('Choose Start effect to restart this example.', 'ready');
        }
        updateToggle();
      },
      { signal: lifetime.signal },
    );
    window.addEventListener('pagehide', dispose, { once: true });
  }
}

function required<T extends Element>(selector: string, root: ParentNode): T {
  const element = root.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Missing docs Fire lab element: ${selector}`);
  }
  return element;
}

initializeFireLabs();
