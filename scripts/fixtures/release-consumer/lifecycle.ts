import { attachFire, type EffectHandle } from '@domfx/browser';

export function check(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

export interface Controls {
  seek(time: number): void;
  dispose(): void;
  verifyCleanup(): void;
}

export async function rehearse(bind?: (effect: EffectHandle) => Controls) {
  const report = document.querySelector('#report');
  const host = document.querySelector('#host');
  const target = document.querySelector('#target');
  check(
    report && host instanceof HTMLElement && target instanceof HTMLButtonElement,
    'fixture DOM',
  );
  const checks: string[] = [];
  const pixels: Record<string, { hash: string; nonzeroAlpha: number; png: string }> = {};
  let effect = attachFire(target, { host, clock: 'manual', time: 0, intensity: 0.8, seed: 314 });
  let controls: Controls | undefined;
  let clicks = 0;
  target.addEventListener('click', () => {
    clicks += 1;
  });
  function active() {
    check(
      effect.lifecycle === 'active' && effect.raster === 'fresh',
      `effect ${effect.lifecycle}/${effect.raster}: ${effect.reason} ${effect.reasonDetail}`,
    );
  }
  const canvas = () => {
    const layer = host.querySelector('canvas');
    check(layer, 'missing effect layer');
    return layer;
  };
  async function sample(label: string, time: number, intensity = 0.8) {
    active();
    controls?.seek(time);
    if (!controls) {
      effect.time = time;
    }
    effect.intensity = intensity;
    // Read in the presentation frame, before the WebGPU drawing buffer is cleared.
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const layer = canvas();
    const copy = document.createElement('canvas');
    copy.width = layer.width;
    copy.height = layer.height;
    const context = copy.getContext('2d');
    check(context, '2D readback unavailable');
    context.drawImage(layer, 0, 0);
    const result = {
      bytes: context.getImageData(0, 0, copy.width, copy.height).data,
      png: copy.toDataURL(),
    };
    active();
    check(effect.time === time && effect.intensity === intensity, 'public control values');
    let hash = 2166136261;
    let nonzeroAlpha = 0;
    for (let index = 0; index < result.bytes.length; index += 1) {
      hash = Math.imul(hash ^ result.bytes[index], 16777619);
      if (index % 4 === 3 && result.bytes[index] > 0) {
        nonzeroAlpha += 1;
      }
    }
    const value = { hash: (hash >>> 0).toString(16), nonzeroAlpha, png: result.png };
    pixels[label] = value;
    return value;
  }
  try {
    await effect.ready;
    active();
    controls = bind?.(effect);
    const initial = await sample('initial', 1.5);
    check(initial.nonzeroAlpha > 0, 'GPU output is empty');
    check((await sample('seek', 2.5)).hash !== initial.hash, 'seek must change pixels');
    check((await sample('seek-back', 1.5)).hash === initial.hash, 'seek must reproduce pixels');
    check(
      (await sample('zero-intensity', 1.5, 0)).nonzeroAlpha === 0,
      'zero intensity must be transparent',
    );
    check((await sample('restored', 1.5)).hash === initial.hash, 'intensity restoration');
    checks.push('attach', 'seek and backward seek', 'intensity');

    target.style.borderRadius = '35px';
    await effect.refresh();
    const refreshed = await sample('refresh', 1.5);
    check(
      refreshed.nonzeroAlpha > 0 && refreshed.hash !== initial.hash,
      'refresh must change silhouette',
    );
    checks.push('refresh');

    const oldLayer = canvas();
    // A supported public failure/recovery path, without replacing capture or GPU adapters.
    target.style.opacity = '0.5';
    await effect.refresh().then(
      () => {
        throw new Error('unsupported composition unexpectedly refreshed');
      },
      () => {
        check(
          effect.lifecycle === 'unavailable' && effect.reason === 'unsupported-composition',
          'expected composition failure',
        );
      },
    );
    check(
      !oldLayer.isConnected && oldLayer.width === 0 && host.querySelectorAll('canvas').length === 0,
      'failed layer cleanup',
    );
    target.style.opacity = '';
    const retry = effect.retry();
    check(retry === effect.retry(), 'concurrent retry must coalesce');
    await retry;
    active();
    check(
      effect.time === 1.5 && effect.intensity === 0.8 && effect.seed === 314,
      'retry retained controls',
    );
    check(
      (await sample('retry', 1.5)).hash === refreshed.hash,
      'retry must reproduce refreshed output',
    );
    check((await sample('retry-seek', 2.5)).hash !== refreshed.hash, 'controls must survive retry');
    checks.push('unavailable cleanup', 'retry and retained controls');

    controls?.dispose();
    controls?.dispose();
    controls?.verifyCleanup();
    const layer = canvas();
    let disposed = 0;
    effect.onDispose(() => {
      disposed += 1;
    });
    effect.dispose();
    effect.dispose();
    check(effect.lifecycle === 'disposed' && disposed === 1, 'idempotent disposal');
    check(
      !layer.isConnected && layer.width === 0 && host.querySelectorAll('canvas').length === 0,
      'disposed layer cleanup',
    );
    checks.push('idempotent disposal');
    if (controls) {
      checks.push('binding cleanup');
    }

    effect = attachFire(target, { host, time: 1.5, intensity: 0.8, seed: 314 });
    controls = undefined;
    await effect.ready;
    check(
      (await sample('reattach', 1.5)).hash === refreshed.hash,
      'reattachment must reproduce output',
    );
    effect.dispose();
    check(host.querySelectorAll('canvas').length === 0, 'reattachment cleanup');
    checks.push('reattach and cleanup');
    target.focus();
    target.click();
    check(document.activeElement === target && clicks === 1, 'original target remains interactive');
    checks.push('original target interaction');
    report.textContent = JSON.stringify({ outcome: 'PASS', checks, pixels });
  } catch (error) {
    report.textContent = JSON.stringify({ outcome: 'FAIL', error: String(error), checks, pixels });
  } finally {
    controls?.dispose();
    effect.dispose();
  }
}
