import { attachFire, type EffectHandle } from '@domfx/browser';

const targetIds = ['target', 'rounded', 'vector', 'transparent', 'card'] as const;
const labels = ['Headline', 'Button', 'SVG', 'Raster', 'Card'];

function required(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`missing gallery element: ${id}`);
  }
  return element;
}

/** Public attachments own capture, placement, clocks and their individual layers. */
export function createGallery(
  images: Record<string, string>,
  report: Record<string, unknown>,
  showReport: () => void,
) {
  const entries: Array<{
    id: string;
    target: HTMLElement;
    host: HTMLElement;
    effect: EffectHandle;
    controls: HTMLFieldSetElement;
    state: HTMLOutputElement;
    layer?: HTMLCanvasElement;
  }> = [];
  let disposed = false;
  const update = () => {
    report.gallery = Object.fromEntries(
      entries.map(({ id, effect, state }) => {
        const details = {
          lifecycle: effect.lifecycle,
          raster: effect.raster,
          reason: effect.reason,
          reasonDetail: effect.reasonDetail,
          time: effect.time,
          intensity: effect.intensity,
          seed: effect.seed,
          clock: effect.clock,
          paused: effect.paused,
        };
        state.value = `${details.lifecycle} · ${details.raster} · ${details.clock === 'manual' ? 'manual clock' : details.paused ? 'paused' : 'playing'}`;
        if (details.reason) {
          state.value += ` · ${details.reasonDetail ?? details.reason}`;
        }
        return [id, details];
      }),
    );
    showReport();
  };
  const dispose = () => {
    disposed = true;
    for (const { effect, controls } of entries) {
      effect.dispose();
      controls.disabled = true;
    }
    update();
  };
  try {
    targetIds.forEach((id, index) => {
      const target = required(id);
      const host =
        id === 'vector' || id === 'transparent' ? required('shared-host') : target.parentElement;
      if (!host) {
        throw new Error(`missing gallery host: ${id}`);
      }
      const controls = document.createElement('fieldset');
      controls.dataset.target = id;
      controls.disabled = true;
      const legend = document.createElement('legend');
      legend.textContent = labels[index];
      const state = document.createElement('output');
      controls.append(legend, state);
      required(`controls-${id}`).replaceChildren(controls);
      const effect = attachFire(target, {
        host,
        clock: id === 'target' ? 'manual' : 'ambient',
        time: 1.5,
        seed: 314 + index,
        intensity: [0.85, 0.75, 0.65, 0.55, 0.45][index],
      });
      effect.pause();
      entries.push({ id, target, host, effect, controls, state });
      for (const property of ['time', 'intensity'] as const) {
        const label = document.createElement('label');
        label.textContent = property === 'time' ? 'Time (seconds)' : 'Intensity';
        const input = document.createElement('input');
        input.type = 'number';
        input.step = property === 'time' ? '0.1' : '0.05';
        if (property === 'intensity') {
          input.min = '0';
          input.max = '1';
        }
        input.value = String(effect[property]);
        input.onchange = () => {
          if (input.value !== '' && input.checkValidity()) {
            effect[property] = input.valueAsNumber;
            update();
          }
        };
        label.append(input);
        controls.append(label);
      }
      const actions = document.createElement('div');
      actions.className = 'gallery-actions';
      controls.append(actions);
      const action = (name: string, run: () => void | Promise<void>) => {
        const button = document.createElement('button');
        button.textContent = name;
        button.onclick = async () => {
          try {
            await run();
          } catch (error) {
            report.galleryError = String(error);
          }
          update();
        };
        actions.append(button);
      };
      if (id !== 'target') {
        action('Play / pause', () => (effect.paused ? effect.resume() : effect.pause()));
      }
      action('Move / scale', () => {
        target.style.transform = target.style.transform
          ? ''
          : 'translate(12px, 6px) scale(1.1, 0.9)';
      });
      action('Refresh', () => {
        target.scrollIntoView({ block: 'center', behavior: 'instant' });
        return effect.refresh();
      });
      if (id === 'rounded') {
        action('Change content', async () => {
          target.scrollIntoView({ block: 'center', behavior: 'instant' });
          const child = target.querySelector('span');
          if (child) {
            child.textContent = child.textContent === 'button' ? 'B8O 88' : 'button';
          }
          await effect.refresh();
        });
      }
      action('Dispose', () => {
        effect.dispose();
        controls.disabled = true;
      });
    });
  } catch (error) {
    dispose();
    throw error;
  }
  const ready = Promise.all(entries.map(({ effect }) => effect.ready))
    .then(async () => {
      const position = { left: scrollX, top: scrollY };
      for (const entry of entries) {
        const { id, target, host, effect } = entry;
        // Initialization verifies each live fixture while it is in the viewport.
        target.scrollIntoView({ block: 'center', behavior: 'instant' });
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        if (effect.lifecycle === 'suspended' && effect.raster === 'stale') {
          await effect.refresh().catch(() => {});
        }
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        if (effect.lifecycle !== 'active' || effect.raster !== 'fresh') {
          throw new Error(
            `required live fixture ${id}: ${effect.reasonDetail ?? effect.lifecycle}`,
          );
        }
        const bounds = target.getBoundingClientRect();
        // Initial targets have no outer scale; public attachments use 32 CSS-pixel padding.
        entry.layer = [...host.querySelectorAll('canvas')].find(
          (canvas) =>
            Math.abs(canvas.getBoundingClientRect().left + 32 - bounds.left) < 0.5 &&
            Math.abs(canvas.getBoundingClientRect().top + 32 - bounds.top) < 0.5,
        );
        if (!entry.layer) {
          throw new Error(`required live layer missing: ${id}`);
        }
        entry.layer.dataset.galleryTarget = id;
        entry.layer.classList.add('effect');
        entry.controls.disabled = false;
      }
      window.scrollTo({ ...position, behavior: 'instant' });
      update();
    })
    .catch((error: unknown) => {
      dispose();
      throw error;
    });
  async function saveLiveEvidence() {
    if (disposed) {
      return;
    }
    const position = { left: scrollX, top: scrollY };
    for (const { id, target, effect, layer } of entries) {
      if (effect.lifecycle === 'disposed' || effect.lifecycle === 'unavailable') {
        continue;
      }
      target.scrollIntoView({ block: 'center', behavior: 'instant' });
      // Intersection delivery restores geometry before the diagnostic repaint.
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      // Leave the current frame before writing controls: its shared scheduler
      // may still have callbacks, which would present before our readback frame.
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      // WebGPU canvas storage is transient. Repaint and read in the same frame.
      const time = effect.time;
      effect.time = time;
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      if (effect.lifecycle === 'active' && layer) {
        images[`live-fire-${id}-dpr${devicePixelRatio}`] = layer.toDataURL();
      }
    }
    window.scrollTo({ ...position, behavior: 'instant' });
    update();
  }
  const headline = entries[0].effect;
  return { headline, ready, dispose, saveLiveEvidence, entries };
}
