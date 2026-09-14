import { captureElement, type ClockMode } from '@domfx/browser';
import { attachFireWithAdapters, GpuExperiment } from '@domfx/browser/experimental';

/** Colored alpha islands give independent, visible landmarks in the captured paint. */
export async function createPlacementFixture(clock: ClockMode, scrolling = false) {
  const outer = document.createElement('div');
  outer.style.cssText =
    'position:absolute;left:85.25px;top:115.375px;transform:translate(7.125px,3.25px) scale(1.1,.9);transform-origin:19.25px 31.5px';
  const host = document.createElement('div');
  host.id = 'placement-host';
  host.style.cssText =
    'position:relative;width:400px;height:340px;padding:13.25px;border:3.5px solid gray;transform:translate(4.375px,2.625px) scale(.95,1.15);transform-origin:27% 63%';
  const spacer = document.createElement('div');
  spacer.style.height = '15.375px';
  const ancestor = document.createElement('div');
  ancestor.style.cssText =
    'transform:translate(11.25px,6.375px) scale(1.2,.85);transform-origin:31.25px 17.75px';
  const target = document.createElement('div');
  target.id = 'placement-target';
  target.style.cssText =
    'position:relative;width:121.375px;height:83.625px;transform:translate(5.375px,9.125px) scale(.8,1.3);transform-origin:73% 29%;translate:2.125px 1.75px;scale:1.05 .95';
  // SVG landmarks retain fractional paint edges; HTML background rectangles
  // snap to local CSS pixels in Chromium's foreignObject rasterization.
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '121.375');
  svg.setAttribute('height', '83.625');
  svg.style.display = 'block';
  target.append(svg);
  const markers = [
    { x: 9.25, y: 11.375, color: 'red' },
    { x: 87.625, y: 16.25, color: 'lime' },
    { x: 43.375, y: 61.125, color: 'blue' },
  ].map(({ x, y, color }) => {
    const marker = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    marker.setAttribute('x', String(x));
    marker.setAttribute('y', String(y));
    marker.setAttribute('width', '10');
    marker.setAttribute('height', '8');
    marker.setAttribute('fill', color);
    svg.append(marker);
    return marker;
  });
  ancestor.append(target);
  if (scrolling) {
    outer.style.width = '1800px';
    outer.style.height = '1600px';
    host.style.width = '190px';
    host.style.height = '145px';
    host.style.overflow = 'auto';
    ancestor.id = 'placement-scroll';
    ancestor.style.position = 'relative';
    ancestor.style.width = '135.375px';
    ancestor.style.height = '95.625px';
    ancestor.style.border = '5px solid gray';
    ancestor.style.overflow = 'auto';
    const content = document.createElement('div');
    content.style.cssText = 'width:450px;height:350px;padding:15.25px';
    content.append(target);
    ancestor.append(content);
    const extent = document.createElement('div');
    extent.style.cssText = 'width:450px;height:350px';
    host.append(extent);
  }
  host.prepend(spacer, ancestor);
  if (scrolling) {
    const clipper = document.createElement('div');
    clipper.style.cssText =
      'position:relative;width:145.375px;height:85.625px;overflow:hidden;border:4.5px solid silver';
    host.insertBefore(clipper, ancestor);
    clipper.append(ancestor);
  }
  outer.append(host);
  document.body.append(outer);
  let captures = 0;
  let renders = 0;
  let captureSize = { width: 0, height: 0 };
  let points: { x: number; y: number; localX: number; localY: number }[] = [];
  let renderer: GpuExperiment | undefined;
  const effect = attachFireWithAdapters(
    target,
    { host, clock, time: 2.75, seed: 314 },
    {
      capture: async () => {
        captures += 1;
        const frame = await captureElement(target);
        captureSize = { width: frame.width, height: frame.height };
        points = markers.map((_, channel) => {
          let weight = 0;
          let x = 0;
          let y = 0;
          for (let row = 0; row < frame.height; row += 1) {
            for (let column = 0; column < frame.width; column += 1) {
              const offset = (row * frame.width + column) * 4;
              if (frame.pixels[offset + channel] < 240) {
                continue;
              }
              const alpha = frame.pixels[offset + 3] / 255;
              weight += alpha;
              x += (column + 0.5) * alpha;
              y += (row + 0.5) * alpha;
            }
          }
          if (!weight) {
            throw new Error('missing-captured-marker');
          }
          x /= weight;
          y /= weight;
          return {
            x,
            y,
            localX: x * frame.pixelToLocal.a + frame.pixelToLocal.e,
            localY: y * frame.pixelToLocal.d + frame.pixelToLocal.f,
          };
        });
        return frame;
      },
      createRenderer: async () => {
        renderer = await GpuExperiment.create();
        const service = renderer;
        return {
          device: service.device,
          prepare: async (frame) => {
            const prepared = await service.prepare(frame);
            return {
              ...prepared,
              render(...args) {
                renders += 1;
                prepared.render(...args);
              },
            };
          },
          destroy: () => service.destroy(),
        };
      },
    },
  );
  effect.pause();
  await effect.ready;
  const canvas = host.querySelector('canvas');
  if (!canvas || effect.lifecycle !== 'active') {
    throw new Error(effect.reasonDetail ?? 'placement-fixture-unavailable');
  }
  const initialPixels = canvas.toDataURL();
  return {
    effect,
    scroll(kind: 'window' | 'host' | 'inner' | 'outside' | 'restore') {
      if (kind === 'window') {
        window.scrollTo(23.5, 37.5);
      } else if (kind === 'host') {
        host.scrollTo(17.5, 21.5);
      } else if (kind === 'inner') {
        ancestor.scrollTo(27.5, 19.5);
      } else if (kind === 'outside') {
        ancestor.scrollTo(250.5, 230.5);
      } else {
        ancestor.scrollTo(0, 0);
        host.scrollTo(0, 0);
        window.scrollTo(0, 0);
      }
    },
    sample() {
      const layer = canvas.getBoundingClientRect();
      return {
        lifecycle: effect.lifecycle,
        raster: effect.raster,
        time: effect.time,
        paused: effect.paused,
        captures,
        renders,
        samePixels: canvas.toDataURL() === initialPixels,
        dpr: devicePixelRatio,
        visibility: document.visibilityState,
        reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
        adapter: {
          vendor: renderer?.adapterInfo.vendor,
          architecture: renderer?.adapterInfo.architecture,
          device: renderer?.adapterInfo.device,
          description: renderer?.adapterInfo.description,
        },
        points: points.map((point, index) => {
          const rect = markers[index].getBoundingClientRect();
          const expected = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
          const actual = {
            x: layer.left + (point.x / captureSize.width) * layer.width,
            y: layer.top + (point.y / captureSize.height) * layer.height,
          };
          return {
            ...point,
            expected,
            actual,
            errorPhysical:
              Math.max(Math.abs(actual.x - expected.x), Math.abs(actual.y - expected.y)) *
              devicePixelRatio,
          };
        }),
      };
    },
    move(kind: 'layout' | 'ancestor' | 'target' | 'animation') {
      if (kind === 'layout') {
        spacer.style.height = '48.625px';
      } else if (kind === 'ancestor') {
        ancestor.style.transform = 'translate(26.375px,18.125px) scale(.9,1.15)';
      } else if (kind === 'target') {
        target.style.transform = 'translate(19.625px,12.375px) scale(1.15,.8)';
        target.style.translate = '3.625px 7.125px';
        target.style.scale = '.95 1.05';
      } else {
        const animation = target.animate(
          [
            { transform: 'translate(19.625px,12.375px) scale(1.15,.8)' },
            { transform: 'translate(38.125px,27.625px) scale(.85,1.1)' },
          ],
          { duration: 1000, fill: 'both' },
        );
        animation.pause();
        animation.currentTime = 375;
      }
    },
    dispose() {
      for (const animation of target.getAnimations()) {
        animation.cancel();
      }
      effect.dispose();
      outer.remove();
    },
  };
}
