import { expect, test } from '@playwright/test';

import type {} from '../src/manual.js';

for (const clock of ['auto', 'ambient'] as const) {
  test(`${clock} frames batch targets, keep external control, and pause/seek/resume`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') {
        errors.push(message.text());
      }
    });
    await page.goto('/manual.html');
    await expect(page.locator('#state')).toContainText('"lifecycle":"active"');
    const result = await page.evaluate(async (clock) => {
      const { effect: manual, attach } = window.manual;
      const host = document.querySelector<HTMLElement>('#manual-host');
      const target = document.querySelector('#manual-target');
      if (!host || !target) {
        throw new Error('fixture');
      }
      const second = target.cloneNode(true);
      host.append(second);
      if (!(second instanceof Element)) {
        throw new Error('fixture');
      }
      const ambient = attach(second, { host, clock, time: 4, seed: 71 });
      ambient.pause(); // Pausing before readiness must prevent automatic time advancement.
      await ambient.ready;
      if (ambient.lifecycle !== 'active') {
        throw new Error(ambient.reasonDetail ?? 'ambient unavailable');
      }
      // Cancel the native geometry frame before installing the controlled clock.
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      document.dispatchEvent(new Event('visibilitychange'));
      const layers = host.querySelectorAll('canvas');
      const commits = new Map<HTMLCanvasElement | OffscreenCanvas, number>();
      const getTexture = GPUCanvasContext.prototype.getCurrentTexture;
      GPUCanvasContext.prototype.getCurrentTexture = function () {
        commits.set(this.canvas, (commits.get(this.canvas) ?? 0) + 1);
        return getTexture.call(this);
      };
      let captures = 0;
      const decode = HTMLImageElement.prototype.decode;
      HTMLImageElement.prototype.decode = function () {
        captures += 1;
        return decode.call(this);
      };
      const readPixels = CanvasRenderingContext2D.prototype.getImageData;
      CanvasRenderingContext2D.prototype.getImageData = function (...args) {
        captures += 1;
        return Reflect.apply(readPixels, this, args);
      };
      let now = 1000;
      let requests = 0;
      const callbacks = new Map<number, FrameRequestCallback>();
      window.requestAnimationFrame = (callback) => {
        requests += 1;
        callbacks.set(requests, callback);
        return requests;
      };
      window.cancelAnimationFrame = (id) => {
        callbacks.delete(id);
      };
      performance.now = () => now;
      function tick(milliseconds: number) {
        now += milliseconds;
        const batch = [...callbacks.values()];
        callbacks.clear();
        for (const callback of batch) {
          callback(now);
        }
      }
      Object.defineProperty(document, 'hidden', { configurable: true, value: false });
      document.dispatchEvent(new Event('visibilitychange'));
      const counts = () => [...layers].map((canvas) => commits.get(canvas) ?? 0);
      manual.resume(); // Manual ownership cannot be converted to ambient by resume.
      manual.time = 1;
      manual.time = 2;
      manual.intensity = 0.6;
      ambient.time = 6;
      ambient.intensity = 0.8;
      const beforeFrame = { requests, counts: counts(), time: manual.time };
      tick(100);
      const batch = { requests, counts: counts(), pending: callbacks.size };
      const pausedImage = layers[1].toDataURL();
      tick(5000);
      const pausedTime = ambient.time;
      ambient.resume();
      ambient.resume(); // Idempotent, and must not reset the clock origin.
      tick(250);
      const advanced = {
        time: ambient.time,
        manualTime: manual.time,
        changed: layers[1].toDataURL() !== pausedImage,
        counts: counts(),
      };
      ambient.pause();
      const pendingAfterPause = callbacks.size;
      tick(10_000);
      const frozenTime = ambient.time;
      ambient.time = 6;
      tick(16);
      const sought = {
        time: ambient.time,
        paused: ambient.paused,
        same: layers[1].toDataURL() === pausedImage,
        pending: callbacks.size,
      };
      ambient.resume();
      tick(500);
      const resumed = { time: ambient.time, seed: ambient.seed };
      ambient.time = -2;
      tick(250);
      const runningSeek = ambient.time;
      // A pause must retain dirty writes, while keeping geometry tracking active.
      ambient.intensity = 0;
      ambient.pause();
      tick(16);
      const pausedWrite = { pending: callbacks.size, counts: counts() };
      ambient.resume();
      for (let i = 0; i < 20; i += 1) {
        tick(16);
      }
      manual.time = 9;
      ambient.dispose();
      const pendingWithManual = callbacks.size;
      tick(16);
      const afterAmbientDisposal = counts();
      manual.time = 10;
      manual.dispose();
      const pendingAfterDisposal = callbacks.size;
      ambient.resume();
      ambient.time = 99;
      manual.intensity = 0.1;
      tick(1000);
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      return {
        modes: [manual.clock, ambient.clock],
        manualPaused: manual.paused,
        beforeFrame,
        batch,
        pausedTime,
        advanced,
        pendingAfterPause,
        frozenTime,
        sought,
        resumed,
        runningSeek,
        pausedWrite,
        pendingWithManual,
        pendingAfterDisposal,
        afterAmbientDisposal,
        finalCounts: counts(),
        finalPending: callbacks.size,
        captures,
        layers: host.querySelectorAll('canvas').length,
      };
    }, clock);
    expect(result).toEqual({
      modes: ['manual', clock],
      manualPaused: true,
      beforeFrame: { requests: 1, counts: [0, 0], time: 2 },
      batch: { requests: 2, counts: [1, 1], pending: 1 },
      pausedTime: 6,
      advanced: { time: 6.25, manualTime: 2, changed: true, counts: [1, 2] },
      pendingAfterPause: 1,
      frozenTime: 6.25,
      sought: { time: 6, paused: true, same: true, pending: 1 },
      resumed: { time: 6.5, seed: 71 },
      runningSeek: -1.75,
      pausedWrite: { pending: 1, counts: [1, 6] },
      pendingWithManual: 1,
      pendingAfterDisposal: 0,
      afterAmbientDisposal: [2, 26],
      finalCounts: [2, 26],
      finalPending: 0,
      captures: 0,
      layers: 0,
    });
    expect(errors).toEqual([]);
  });
}

for (const ending of ['stale', 'renderer-failed'] as const) {
  test(`ambient starts on readiness, suspends without catch-up, and stops on ${ending}`, async ({
    page,
  }) => {
    await page.goto('/manual.html');
    await expect(page.locator('#state')).toContainText('"lifecycle":"active"');
    const result = await page.evaluate(async (failure) => {
      const { effect: manual, attach } = window.manual;
      manual.dispose();
      const host = document.querySelector<HTMLElement>('#manual-host');
      const target = document.querySelector('#manual-target');
      if (!host || !target) {
        throw new Error('fixture');
      }
      const ambient = attach(target, { host, clock: 'ambient', time: 1 });
      await ambient.ready;
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const started = ambient.time > 1 && !ambient.paused;
      ambient.pause();
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      document.dispatchEvent(new Event('visibilitychange'));
      let now = 1000;
      let nextId = 0;
      const callbacks = new Map<number, FrameRequestCallback>();
      performance.now = () => now;
      window.requestAnimationFrame = (callback) => {
        callbacks.set(++nextId, callback);
        return nextId;
      };
      window.cancelAnimationFrame = (id) => {
        callbacks.delete(id);
      };
      function tick(milliseconds: number) {
        now += milliseconds;
        const batch = [...callbacks.values()];
        callbacks.clear();
        for (const callback of batch) {
          callback(now);
        }
      }
      Object.defineProperty(document, 'hidden', { configurable: true, value: false });
      document.dispatchEvent(new Event('visibilitychange'));
      tick(0); // Restore visibility before establishing the resumed clock origin.
      ambient.time = 3;
      ambient.resume();
      tick(250);
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      document.dispatchEvent(new Event('visibilitychange'));
      const hidden = {
        lifecycle: ambient.lifecycle,
        pending: callbacks.size,
        display: host.querySelector('canvas')?.style.display,
        paused: ambient.paused,
      };
      tick(10_000);
      Object.defineProperty(document, 'hidden', { configurable: true, value: false });
      document.dispatchEvent(new Event('visibilitychange'));
      tick(16);
      const restoredTime = ambient.time;
      tick(250);
      const advancingTime = ambient.time;
      if (failure === 'stale') {
        target.setAttribute('data-painted-change', 'true');
        await Promise.resolve();
      } else {
        GPUCanvasContext.prototype.getCurrentTexture = () => {
          throw new Error('injected commit failure');
        };
        tick(16);
      }
      const stopped = {
        lifecycle: ambient.lifecycle,
        raster: ambient.raster,
        reason: ambient.reason,
        pending: callbacks.size,
      };
      ambient.time = 9;
      ambient.pause();
      ambient.resume();
      const pendingAfterWrites = callbacks.size;
      ambient.dispose();
      return { started, hidden, restoredTime, advancingTime, stopped, pendingAfterWrites };
    }, ending);
    expect(result).toEqual({
      started: true,
      hidden: { lifecycle: 'suspended', pending: 0, display: 'none', paused: false },
      restoredTime: 3.25,
      advancingTime: 3.5,
      stopped: {
        lifecycle: ending === 'stale' ? 'suspended' : 'unavailable',
        raster: 'stale',
        reason: ending === 'stale' ? 'stale-raster' : 'renderer-failed',
        pending: ending === 'stale' ? 1 : 0,
      },
      pendingAfterWrites: ending === 'stale' ? 1 : 0,
    });
  });
}

for (const mode of ['manual', 'paused', 'running'] as const) {
  test(`${mode} offscreen work sleeps and re-entry synchronizes before showing output`, async ({
    page,
  }) => {
    await page.goto('/manual.html');
    await expect(page.locator('#state')).toContainText('"lifecycle":"active"');
    const result = await page.evaluate(async (mode) => {
      window.manual.effect.dispose();
      const fixture = await window.manual.createPlacementFixture(
        mode === 'manual' ? 'manual' : 'ambient',
      );
      const effect = fixture.effect;
      const target = document.querySelector<HTMLElement>('#placement-target')!;
      const layer = document.querySelector<HTMLCanvasElement>('#placement-host > canvas')!;
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const hide = (hidden: boolean) => {
        Object.defineProperty(document, 'hidden', { configurable: true, value: hidden });
        document.dispatchEvent(new Event('visibilitychange'));
      };
      hide(true);
      let now = 1000;
      let nextId = 0;
      const callbacks = new Map<number, FrameRequestCallback>();
      performance.now = () => now;
      window.requestAnimationFrame = (callback) => {
        callbacks.set(++nextId, callback);
        return nextId;
      };
      window.cancelAnimationFrame = (id) => {
        callbacks.delete(id);
      };
      function tick(milliseconds: number) {
        now += milliseconds;
        const batch = [...callbacks.values()];
        callbacks.clear();
        for (const callback of batch) {
          callback(now);
        }
      }
      hide(false);
      tick(0);
      if (mode === 'running') {
        effect.resume();
      }
      tick(250);
      const before = effect.time;
      const transform = target.style.transform;
      target.style.transform = 'translateY(2000px)';
      tick(250);
      const offscreen = {
        time: effect.time,
        lifecycle: effect.lifecycle,
        pending: callbacks.size,
        display: layer.style.display,
      };
      let reads = 0;
      const bounds = target.getBoundingClientRect.bind(target);
      target.getBoundingClientRect = () => {
        reads += 1;
        return bounds();
      };
      const renders = fixture.sample().renders;
      reads = 0;
      for (let index = 0; index < 5; index += 1) {
        document.dispatchEvent(new Event('scroll'));
        tick(2000);
      }
      const sleeping = {
        reads,
        pending: callbacks.size,
        time: effect.time,
        renders: fixture.sample().renders - renders,
      };
      // Controls can change while suspended; they must not schedule or show output.
      effect.intensity = 0.4;
      const pendingAfterWrite = callbacks.size;
      target.style.transform = transform;
      fixture.move('ancestor');
      // Native intersection delivery wakes the controlled frame scheduler.
      for (let index = 0; index < 100 && callbacks.size === 0; index += 1) {
        await new Promise<void>((resolve) => setTimeout(resolve, 10));
      }
      const beforeReentry = { pending: callbacks.size, display: layer.style.display };
      tick(16);
      const reentry = fixture.sample();
      tick(250);
      const after = effect.time;
      hide(true);
      fixture.move('layout');
      tick(10_000);
      hide(false);
      const beforeDocumentReentry = layer.style.display;
      tick(16);
      const documentReentry = fixture.sample();
      hide(true);
      effect.dispose();
      hide(false);
      target.style.transform = 'translateX(10px)';
      document.dispatchEvent(new Event('scroll'));
      await new Promise<void>((resolve) => setTimeout(resolve, 30));
      const disposed = {
        pending: callbacks.size,
        layers: document.querySelectorAll('#placement-host > canvas').length,
      };
      fixture.dispose();
      return {
        before,
        offscreen,
        sleeping,
        pendingAfterWrite,
        beforeReentry,
        reentry,
        after,
        beforeDocumentReentry,
        documentReentry,
        disposed,
      };
    }, mode);
    const time = mode === 'running' ? 3 : 2.75;
    expect(result.before).toBe(time);
    expect(result.offscreen).toEqual({ time, lifecycle: 'suspended', pending: 0, display: 'none' });
    expect(result.sleeping).toEqual({ reads: 0, pending: 0, time, renders: 0 });
    expect(result.pendingAfterWrite).toBe(0);
    expect(result.beforeReentry).toEqual({ pending: 1, display: 'none' });
    expect(result.reentry).toMatchObject({
      lifecycle: 'active',
      raster: 'fresh',
      captures: 1,
      time,
    });
    expect(result.after).toBe(time + (mode === 'running' ? 0.25 : 0));
    expect(result.beforeDocumentReentry).toBe('none');
    expect(result.documentReentry).toMatchObject({
      lifecycle: 'active',
      raster: 'fresh',
      captures: 1,
      time: result.after,
    });
    for (const sample of [result.reentry, result.documentReentry]) {
      for (const point of sample.points) {
        expect(point.errorPhysical).toBeLessThanOrEqual(1);
      }
    }
    expect(result.disposed).toEqual({ pending: 0, layers: 0 });
  });
}

test('a target touching the viewport edge wakes when positive area re-enters', async ({ page }) => {
  await page.goto('/manual.html');
  await expect(page.locator('#state')).toContainText('"lifecycle":"active"');
  await page.evaluate(async () => {
    window.manual.effect.dispose();
    const host = document.createElement('div');
    host.id = 'edge-host';
    host.style.cssText = 'position:absolute;left:0;top:0;width:100px;height:100px';
    const target = document.createElement('div');
    target.style.cssText = 'width:20px;height:20px;background:white';
    host.append(target);
    document.body.append(host);
    window.manual.effect = window.manual.attach(target, { host, time: 7 });
    await window.manual.effect.ready;
    host.style.top = `${innerHeight}px`;
  });
  await expect.poll(() => page.evaluate(() => window.manual.effect.lifecycle)).toBe('suspended');
  // Let the observer record edge adjacency before moving one pixel into view.
  await page.evaluate(async () => {
    for (let i = 0; i < 3; i += 1) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }
    document.querySelector<HTMLElement>('#edge-host')!.style.top = `${innerHeight - 1}px`;
  });
  await expect.poll(() => page.evaluate(() => window.manual.effect.lifecycle)).toBe('active');
  expect(await page.evaluate(() => window.manual.effect.time)).toBe(7);
  await page.evaluate(() => window.manual.effect.dispose());
});
