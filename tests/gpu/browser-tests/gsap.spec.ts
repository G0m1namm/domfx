import { expect, type Page, test as base } from '@playwright/test';

import type {} from '../src/gsap-consumer.js';

const test = base.extend<{ browserErrors: string[] }>({
  browserErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error') {
          errors.push(message.text());
        }
      });
      await use(errors);
      expect(errors).toEqual([]);
    },
    { auto: true },
  ],
});

async function openConsumer(page: Page) {
  await page.goto('/gsap.html');
  await expect(page.locator('#state')).toContainText('"lifecycle":"active"');
}

test('attachment disposal detaches its binding and preserves caller siblings @smoke', async ({
  page,
}) => {
  await openConsumer(page);
  const result = await page.evaluate(() => {
    const { effect, timeline, binding } = window.bindingConsumer;
    const sibling = { value: 0 };
    timeline.to(sibling, { value: 10, duration: 10, ease: 'none' }, 0);
    timeline.seek(2);
    const time = effect.time;
    effect.dispose();
    effect.dispose();
    timeline.seek(8);
    const result = {
      children: timeline.getChildren().length,
      time: effect.time,
      sibling: sibling.value,
      retained: time,
    };
    binding.dispose();
    return result;
  });
  expect(result).toEqual({ children: 1, time: 3.5, sibling: 8, retained: 3.5 });
});

test('context ownership and late async cleanup preserve the real consumer host', async ({
  page,
}) => {
  await openConsumer(page);
  const result = await page.evaluate(async () => {
    const { effect, timeline, binding, bind, bindAsync, gsap } = window.bindingConsumer;
    binding.dispose();
    const sibling = { value: 0 };
    timeline.to(sibling, { value: 10, duration: 10, ease: 'none' }, 0);
    const options = { time: 4, intensity: 1, duration: 4, position: 0 };
    const borrowed = gsap.context(() => {
      bind(effect, timeline, options);
    });
    borrowed.revert();
    borrowed.revert();
    const borrowedLifecycle = effect.lifecycle;
    const context = gsap.context(() => {});
    // Promise.resolve still leaves a deterministic microtask gap before binding.
    const pending = context.add(() =>
      bindAsync(Promise.resolve(effect), timeline, { ...options, disposeEffect: true }),
    );
    context.revert();
    context.revert();
    await pending.ready;
    pending.dispose();
    timeline.seek(8);
    return {
      borrowedLifecycle,
      lifecycle: effect.lifecycle,
      children: timeline.getChildren().length,
      sibling: sibling.value,
      layers: document.querySelectorAll('#host canvas').length,
    };
  });
  expect(result).toEqual({
    borrowedLifecycle: 'active',
    lifecycle: 'disposed',
    children: 1,
    sibling: 8,
    layers: 0,
  });
});

test('owned context cleanup releases attachments and disposal listeners run once', async ({
  page,
}) => {
  await openConsumer(page);
  const result = await page.evaluate(() => {
    const { effect, timeline, binding, bind, gsap } = window.bindingConsumer;
    binding.dispose();
    let notified = 0;
    const unsubscribe = effect.onDispose(() => {
      notified += 100;
    });
    unsubscribe();
    unsubscribe();
    effect.onDispose(() => {
      notified += 1;
    });
    const context = gsap.context(() => {
      bind(effect, timeline, { time: 4, intensity: 1, duration: 4, disposeEffect: true });
    });
    timeline.seek(2);
    context.revert();
    context.revert();
    effect.dispose();
    const stop = effect.onDispose(() => {
      notified += 1;
    });
    stop();
    return {
      notified,
      lifecycle: effect.lifecycle,
      children: timeline.getChildren().length,
      layers: document.querySelectorAll('#host canvas').length,
    };
  });
  expect(result).toEqual({ notified: 2, lifecycle: 'disposed', children: 0, layers: 0 });
});

test('a throwing disposal listener cannot retain bindings or browser resources', async ({
  page,
}) => {
  await openConsumer(page);
  const result = await page.evaluate(() => {
    const { effect, timeline, binding, bind } = window.bindingConsumer;
    binding.dispose();
    effect.onDispose(() => {
      throw new Error('listener-failed');
    });
    bind(effect, timeline, { time: 4, intensity: 1, duration: 4 });
    let error = '';
    try {
      effect.dispose();
    } catch (failure) {
      error = String(failure);
    }
    effect.dispose();
    return {
      error,
      children: timeline.getChildren().length,
      layers: document.querySelectorAll('#host canvas').length,
    };
  });
  expect(result).toEqual({
    error: 'AggregateError: effect-disposal-callback-failed',
    children: 0,
    layers: 0,
  });
});

test('host seek/reverse reproduces GPU output through one scheduled commit without capture @smoke', async ({
  page,
}, testInfo) => {
  await openConsumer(page);
  const result = await page.evaluate(() => {
    const { effect, timeline } = window.bindingConsumer;
    const canvas = document.querySelector<HTMLCanvasElement>('#host canvas');
    if (!canvas) {
      throw new Error('missing-effect-layer');
    }
    // Hand the existing geometry frame from the native clock to the fake clock.
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
    let commits = 0;
    const getTexture = GPUCanvasContext.prototype.getCurrentTexture;
    GPUCanvasContext.prototype.getCurrentTexture = function () {
      commits += 1;
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
    let requests = 0;
    const callbacks = new Map<number, FrameRequestCallback>();
    window.requestAnimationFrame = (callback) => {
      requests += 1;
      callbacks.set(requests, callback);
      return requests;
    };
    window.cancelAnimationFrame = (id) => callbacks.delete(id);
    function frame() {
      const batch = [...callbacks.values()];
      callbacks.clear();
      for (const callback of batch) {
        callback(performance.now());
      }
    }
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange'));
    const initial = { time: effect.time, intensity: effect.intensity };
    const children = timeline.getChildren();
    const child = { count: children.length, paused: children[0].paused() };
    timeline.seek(1);
    timeline.seek(3);
    timeline.seek(2); // Default suppressEvents=true must still write both controls.
    const beforeFrame = { commits, time: effect.time, intensity: effect.intensity };
    frame();
    const first = canvas.toDataURL();
    const afterFrame = { commits };
    timeline.seek(3);
    frame();
    const changed = canvas.toDataURL() !== first;
    timeline.reverse().pause();
    timeline.seek(2);
    frame();
    const repeated = canvas.toDataURL() === first;
    timeline.seek(0);
    frame();
    return {
      initial,
      child,
      beforeFrame,
      afterFrame,
      changed,
      repeated,
      restored: { time: effect.time, intensity: effect.intensity },
      seed: effect.seed,
      captures,
      commits,
      raster: effect.raster,
    };
  });
  expect(result).toEqual({
    initial: { time: 1.5, intensity: 0.85 },
    child: { count: 1, paused: false },
    beforeFrame: { commits: 0, time: 3.5, intensity: 0.55 },
    afterFrame: { commits: 1 },
    changed: true,
    repeated: true,
    restored: { time: 1.5, intensity: 0.85 },
    seed: 314,
    captures: 0,
    commits: 4,
    raster: 'fresh',
  });
  await testInfo.attach('binding-checks.json', {
    body: JSON.stringify(result),
    contentType: 'application/json',
  });
});

test('binding snapshots starts, rejects ambient/invalid inputs, and cleans up only its child', async ({
  page,
}) => {
  await openConsumer(page);
  const result = await page.evaluate(async () => {
    const { effect, timeline, binding, bind, attach, gsap } = window.bindingConsumer;
    binding.dispose();
    const sibling = { value: 0 };
    timeline.to(sibling, { value: 10, duration: 10, ease: 'none' }, 0);
    timeline.addLabel('fire', 1);
    const next = bind(effect, timeline, {
      time: 5.5,
      intensity: -1,
      duration: 4,
      position: 'fire',
    });
    effect.time = 99;
    effect.intensity = 1;
    timeline.seek(0.5);
    const beforeStart = effect.time;
    timeline.seek(3);
    const midpoint = { time: effect.time, intensity: effect.intensity };
    timeline.seek(5);
    const endpoint = { time: effect.time, intensity: effect.intensity };
    next.dispose();
    next.dispose();
    timeline.seek(7);
    const disposed = {
      time: effect.time,
      intensity: effect.intensity,
      sibling: sibling.value,
      children: timeline.getChildren().length,
      lifecycle: effect.lifecycle,
    };
    const context = gsap.context(() => {
      bind(effect, timeline, { time: 8, intensity: 1, duration: 2, position: 0 });
    });
    timeline.seek(1);
    context.revert();
    timeline.seek(8);
    const afterRevert = { children: timeline.getChildren().length, sibling: sibling.value };
    const host = document.querySelector<HTMLElement>('#host');
    const target = document.createElement('button');
    target.textContent = 'Ambient target';
    if (!host) {
      throw new Error('fixture');
    }
    host.append(target);
    const ambient = attach(target, { host, clock: 'ambient' });
    ambient.pause();
    let ambientError = '';
    try {
      bind(ambient, timeline, { time: 4, intensity: 1, duration: 4 });
    } catch (error) {
      ambientError = String(error);
    }
    ambient.dispose();
    await ambient.ready;
    let invalidRejected = 0;
    for (const options of [
      { time: NaN, intensity: 1, duration: 1 },
      { time: Number.MAX_VALUE, intensity: 1, duration: 1 },
      { time: 1, intensity: Infinity, duration: 1 },
      { time: 1, intensity: 1, duration: -1 },
      { time: 1, intensity: 1, duration: Infinity },
    ]) {
      try {
        bind(effect, timeline, options);
      } catch (error) {
        if (error instanceof Error && error.message === 'invalid-gsap-binding-options') {
          invalidRejected += 1;
        }
      }
    }
    const afterRejection = timeline.getChildren().length;
    timeline.seek(0);
    const instant = bind(effect, timeline, {
      time: -2,
      intensity: 10,
      duration: 0,
      position: 1,
    });
    timeline.seek(2);
    const zeroDuration = { time: effect.time, intensity: effect.intensity };
    effect.dispose();
    timeline.seek(0);
    instant.dispose();
    return {
      beforeStart,
      midpoint,
      endpoint,
      disposed,
      afterRevert,
      ambientError,
      invalidRejected,
      afterRejection,
      zeroDuration,
      layersAfterDisposal: host.querySelectorAll('canvas').length,
    };
  });
  expect(result).toEqual({
    beforeStart: 99,
    midpoint: { time: 3.5, intensity: 0.425 },
    endpoint: { time: 5.5, intensity: 0 },
    disposed: { time: 5.5, intensity: 0, sibling: 7, children: 1, lifecycle: 'active' },
    afterRevert: { children: 1, sibling: 8 },
    ambientError: 'Error: GSAP binding requires a manual attachment',
    invalidRejected: 5,
    afterRejection: 1,
    zeroDuration: { time: -2, intensity: 1 },
    layersAfterDisposal: 0,
  });
});

test('consumer playback, reverse, interaction and separate disposal controls work', async ({
  page,
}) => {
  await openConsumer(page);
  await page.locator('#play').click();
  await expect
    .poll(() => page.evaluate(() => window.bindingConsumer.effect.time))
    .toBeGreaterThan(1.5);
  await page.locator('#seek').click();
  await expect.poll(() => page.evaluate(() => window.bindingConsumer.effect.time)).toBe(3.5);
  await page.locator('#reverse').click();
  await expect
    .poll(() => page.evaluate(() => window.bindingConsumer.effect.time))
    .toBeLessThan(3.5);
  await page.locator('#seek').click();
  await page.locator('#unbind').click();
  await page.locator('#play').click();
  expect(await page.evaluate(() => window.bindingConsumer.effect.time)).toBe(3.5);
  await expect(page.locator('#host canvas')).toBeVisible();
  await page.locator('#target').click();
  await page.locator('#target').press('Enter');
  await expect(page.locator('#clicks')).toHaveText('Target clicks: 2');
  await page.locator('#dispose').click();
  await expect(page.locator('#host canvas')).toHaveCount(0);
});

test('an advanced smooth host keeps the requested child position and its callbacks', async ({
  page,
}) => {
  await openConsumer(page);
  const result = await page.evaluate(() => {
    const { effect, binding, bind, gsap } = window.bindingConsumer;
    binding.dispose();
    let updates = 0;
    const onUpdate = () => {
      updates += 1;
    };
    const timeline = gsap.timeline({ paused: true, smoothChildTiming: true, onUpdate });
    timeline.to({ value: 0 }, { value: 1, duration: 10 });
    timeline.seek(7);
    const next = bind(effect, timeline, { time: 5.5, intensity: 0.25, duration: 4, position: 1 });
    const atBind = { time: effect.time, intensity: effect.intensity };
    timeline.seek(3, false);
    const result = {
      atBind,
      sought: { time: effect.time, intensity: effect.intensity },
      position: timeline.getChildren()[1].startTime(),
      paused: timeline.paused(),
      callbackPreserved: timeline.eventCallback('onUpdate') === onUpdate,
      updates,
    };
    next.dispose();
    timeline.kill();
    return result;
  });
  expect(result).toEqual({
    atBind: { time: 5.5, intensity: 0.25 },
    sought: { time: 3.5, intensity: 0.55 },
    position: 1,
    paused: true,
    callbackPreserved: true,
    updates: 1,
  });
});

test('standalone browser/core consumer loads no GSAP runtime or binding', async ({ page }) => {
  const scripts: Promise<string>[] = [];
  page.on('response', (response) => {
    if (response.request().resourceType() === 'script') {
      scripts.push(response.text());
    }
  });
  await page.goto('/manual.html');
  await expect(page.locator('#state')).toContainText('"lifecycle":"active"');
  const sources = await Promise.all(scripts);
  expect(sources.length).toBeGreaterThan(0);
  for (const source of sources) {
    expect(source).not.toMatch(/gsapVersions|GreenSock|GSAP binding requires/);
  }
});

test('native effect tweens preserve sequencing, suppressed seeks, easing and property ownership @smoke', async ({
  page,
}) => {
  await openConsumer(page);
  const result = await page.evaluate(() => {
    const { effect, timeline, binding, gsap } = window.bindingConsumer;
    binding.dispose();
    timeline.clear();
    effect.time = 1;
    effect.intensity = 0.8;
    let callbacks = 0;
    timeline.to(effect, {
      time: 5,
      intensity: 0.4,
      duration: 4,
      ease: 'none',
      onUpdate: () => {
        callbacks += 1;
      },
    });
    timeline.to(effect, { time: 9, intensity: 0, duration: 4, ease: 'none' });
    timeline.seek(4);
    const boundary = effect.time;
    timeline.seek(6);
    const chained = effect.time;
    timeline.seek(2);
    const backward = { time: effect.time, intensity: effect.intensity, callbacks };
    const targetTweens = gsap.getTweensOf(effect).length;
    gsap.killTweensOf(effect, 'intensity');
    timeline.seek(3);
    const partial = { time: effect.time, intensity: effect.intensity };
    timeline.kill();
    effect.time = 0;
    const eased = gsap.to(effect, { time: 4, duration: 4, ease: 'power1.in', paused: true });
    eased.seek(2);
    const ease = effect.time;
    eased.kill();
    const repeating = gsap.to(effect, {
      time: 5,
      duration: 2,
      repeat: 1,
      yoyo: true,
      ease: 'none',
      paused: true,
    });
    repeating.totalTime(3);
    const yoyo = effect.time;
    repeating.kill();
    effect.time = 1;
    effect.intensity = 0.8;
    const older = gsap.to(effect, {
      time: 5,
      intensity: 0.4,
      duration: 4,
      ease: 'none',
    });
    older.seek(2);
    const replacement = gsap.to(effect, {
      intensity: 0,
      duration: 2,
      ease: 'none',
      overwrite: 'auto',
      lazy: false,
    });
    replacement.seek(1);
    older.seek(3);
    const overwrite = { time: effect.time, intensity: effect.intensity };
    older.kill();
    replacement.kill();
    effect.dispose();
    return { boundary, chained, backward, targetTweens, partial, ease, yoyo, overwrite };
  });
  expect(result).toEqual({
    boundary: 5,
    chained: 7,
    backward: { time: 3, intensity: 0.6, callbacks: 0 },
    targetTweens: 2,
    partial: { time: 4, intensity: 0.6 },
    ease: 1,
    yoyo: 3,
    overwrite: { time: 4, intensity: 0.3 },
  });
});

test('native from/fromTo and context revert restore controls without disposing borrowed effects', async ({
  page,
}) => {
  await openConsumer(page);
  const result = await page.evaluate(() => {
    const { effect, binding, gsap } = window.bindingConsumer;
    binding.dispose();
    effect.time = 5;
    effect.intensity = 0.4;
    const from = gsap.from(effect, {
      time: 1,
      intensity: 0.8,
      duration: 4,
      ease: 'none',
      paused: true,
    });
    const immediate = effect.time;
    from.seek(2);
    const midpoint = { time: effect.time, intensity: effect.intensity };
    from.revert();
    const restored = { time: effect.time, intensity: effect.intensity };
    effect.time = 9;
    effect.intensity = 0.2;
    const tween = gsap.fromTo(
      effect,
      { time: 1, intensity: 0.8 },
      {
        time: 5,
        intensity: 0.4,
        duration: 4,
        ease: 'none',
        paused: true,
        immediateRender: false,
      },
    );
    const untouched = effect.time;
    tween.seek(2);
    if (untouched !== 9 || effect.time !== 3) {
      throw new Error('fromTo initial values');
    }
    tween.revert();
    const fromToRestored = { time: effect.time, intensity: effect.intensity };
    const context = gsap.context(() => {
      gsap.to(effect, { time: 5, intensity: 0.4, duration: 4, paused: true }).seek(2);
    });
    context.revert();
    const contextRestored = {
      time: effect.time,
      intensity: effect.intensity,
      lifecycle: effect.lifecycle,
      tweens: gsap.getTweensOf(effect).length,
    };
    effect.dispose();
    return { immediate, midpoint, restored, fromToRestored, contextRestored };
  });
  expect(result).toEqual({
    immediate: 1,
    midpoint: { time: 3, intensity: 0.6 },
    restored: { time: 5, intensity: 0.4 },
    fromToRestored: { time: 9, intensity: 0.2 },
    contextRestored: { time: 9, intensity: 0.2, lifecycle: 'active', tweens: 0 },
  });
});
