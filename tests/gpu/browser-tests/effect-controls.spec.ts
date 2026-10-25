import { expect, test } from '@playwright/test';

test('selected effect controls validate, retain state and change only their intended output', async ({
  page,
}) => {
  await page.goto('/controls.html');
  await page.waitForFunction(() => Boolean(window.controlEffects));
  const result = await page.evaluate(async () => {
    const host = document.querySelector<HTMLElement>('#host')!;
    const target = document.querySelector<HTMLElement>('#target')!;
    const image = () => host.querySelector('canvas')!.toDataURL();
    const settle = () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
    const errors: string[] = [];
    for (const attach of [
      () => window.controlEffects.fire(target, { host, emberDensity: -0.1 }),
      () => window.controlEffects.fire(target, { host, emberDensity: 1.1 }),
      () => window.controlEffects.halftone(target, { host, dotSpacing: 2.9 }),
      () => window.controlEffects.halftone(target, { host, dotSpacing: 12.1 }),
      // @ts-expect-error Deliberately invalid JavaScript input must fail at the public boundary.
      () => window.controlEffects.frost(target, { host, mistOpacity: null }),
      // @ts-expect-error Deliberately invalid JavaScript input must fail at the public boundary.
      () => window.controlEffects.slime(target, { host, gloss: null }),
      // @ts-expect-error Deliberately invalid JavaScript input must fail at the public boundary.
      () => window.controlEffects['burned-paper'](target, { host, emberGlow: null }),
    ]) {
      try {
        attach().dispose();
        errors.push('accepted');
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      }
    }

    const frost = window.controlEffects.frost(target, { host, time: 2, intensity: 0.8 });
    await frost.ready;
    const frostDefault = frost.mistOpacity;
    const frostBefore = image();
    frost.mistOpacity = 0;
    await settle();
    const frostAfter = image();
    let frostError = '';
    try {
      frost.mistOpacity = Number.NaN;
    } catch (error) {
      frostError = error instanceof Error ? error.message : String(error);
    }
    await frost.refresh();
    const frostRetained = frost.mistOpacity;
    frost.dispose();

    const frostExtreme = window.controlEffects.frost(target, {
      host,
      time: 2,
      mistOpacity: Number.MAX_VALUE,
    });
    await frostExtreme.ready;
    frostExtreme.mistOpacity = -Number.MAX_VALUE;
    const frostExtremeValue = frostExtreme.mistOpacity;
    frostExtreme.dispose();

    const slime = window.controlEffects.slime(target, { host, time: 2, intensity: 0.8 });
    await slime.ready;
    const slimeDefault = slime.gloss;
    const slimeBefore = image();
    slime.gloss = 0;
    await settle();
    const slimeAfter = image();
    slime.dispose();

    const slimeExtreme = window.controlEffects.slime(target, {
      host,
      time: 2,
      gloss: -Number.MAX_VALUE,
    });
    await slimeExtreme.ready;
    slimeExtreme.gloss = Number.MAX_VALUE;
    const slimeExtremeValue = slimeExtreme.gloss;
    slimeExtreme.dispose();

    const paper = window.controlEffects['burned-paper'](target, {
      host,
      time: 2,
      intensity: 0.8,
    });
    await paper.ready;
    const paperDefault = paper.emberGlow;
    const paperBefore = image();
    paper.emberGlow = 0;
    await settle();
    const paperAfter = image();
    paper.dispose();

    const paperExtreme = window.controlEffects['burned-paper'](target, {
      host,
      time: 2,
      emberGlow: Number.MAX_VALUE,
    });
    await paperExtreme.ready;
    paperExtreme.emberGlow = -Number.MAX_VALUE;
    const paperExtremeValue = paperExtreme.emberGlow;
    paperExtreme.dispose();

    const fireDefault = window.controlEffects.fire(target, { host, intensity: 0.8, seed: 314 });
    await fireDefault.ready;
    const fireDefaultImages: string[] = [];
    for (const time of [0, 0.5, 1, 1.5, 2]) {
      fireDefault.time = time;
      await settle();
      fireDefaultImages.push(image());
    }
    fireDefault.dispose();
    const fireNone = window.controlEffects.fire(target, {
      host,
      intensity: 0.8,
      seed: 314,
      emberDensity: 0,
    });
    await fireNone.ready;
    const fireNoneImages: string[] = [];
    for (const time of [0, 0.5, 1, 1.5, 2]) {
      fireNone.time = time;
      await settle();
      fireNoneImages.push(image());
    }
    fireNone.dispose();

    const halftoneDefault = window.controlEffects.halftone(target, {
      host,
      time: 2,
      intensity: 0.8,
    });
    await halftoneDefault.ready;
    const halftoneDefaultImage = image();
    halftoneDefault.dispose();
    const halftoneWide = window.controlEffects.halftone(target, {
      host,
      time: 2,
      intensity: 0.8,
      dotSpacing: 12,
    });
    await halftoneWide.ready;
    const halftoneWideImage = image();
    const defaults = {
      emberDensity: fireDefault.emberDensity,
      dotSpacing: halftoneDefault.dotSpacing,
      gloss: slimeDefault,
      emberGlow: paperDefault,
    };
    halftoneWide.dispose();

    return {
      errors,
      frostDefault,
      frostChanged: frostBefore !== frostAfter,
      frostError,
      frostRetained,
      frostExtremeValue,
      slimeChanged: slimeBefore !== slimeAfter,
      slimeExtremeValue,
      paperChanged: paperBefore !== paperAfter,
      paperExtremeValue,
      fireChanged: fireDefaultImages.some((value, index) => value !== fireNoneImages[index]),
      halftoneChanged: halftoneDefaultImage !== halftoneWideImage,
      defaults,
      canvases: host.querySelectorAll('canvas').length,
    };
  });
  expect(result).toEqual({
    errors: [
      'invalid-fire-parameter',
      'invalid-fire-parameter',
      'invalid-halftone-parameter',
      'invalid-halftone-parameter',
      'invalid-frost-parameter',
      'invalid-slime-parameter',
      'invalid-burned-paper-parameter',
    ],
    frostDefault: 1,
    frostChanged: true,
    frostError: 'invalid-frost-parameter',
    frostRetained: 0,
    frostExtremeValue: 0,
    slimeChanged: true,
    slimeExtremeValue: 1,
    paperChanged: true,
    paperExtremeValue: 0,
    fireChanged: true,
    halftoneChanged: true,
    defaults: { emberDensity: 1, dotSpacing: 5.5, gloss: 1, emberGlow: 1 },
    canvases: 0,
  });
});

test('writable controls coalesce through the existing frame scheduler', async ({ page }) => {
  await page.goto('/controls.html');
  await page.waitForFunction(() => Boolean(window.controlEffects));
  const result = await page.evaluate(async () => {
    const host = document.querySelector<HTMLElement>('#host')!;
    const target = document.querySelector<HTMLElement>('#target')!;
    const effect = window.controlEffects.frost(target, { host, time: 2, intensity: 0.8 });
    await effect.ready;
    let requests = 0;
    const request = window.requestAnimationFrame;
    window.requestAnimationFrame = (callback) => {
      requests += 1;
      return request(callback);
    };
    effect.mistOpacity = 0.25;
    effect.mistOpacity = 0.5;
    effect.mistOpacity = 0.75;
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    window.requestAnimationFrame = request;
    const value = effect.mistOpacity;
    effect.dispose();
    return { requests, value, canvases: host.querySelectorAll('canvas').length };
  });
  expect(result.value).toBe(0.75);
  expect(result.requests).toBeLessThanOrEqual(2);
  expect(result.canvases).toBe(0);
});

test('native GSAP drives public writable handles and restores their rendered state', async ({
  page,
}) => {
  await page.goto('/controls.html');
  await page.waitForFunction(() => Boolean(window.controlEffects));
  const result = await page.evaluate(async () => {
    const source = document.querySelector<HTMLElement>('#target')!;
    const { gsap } = window.controlEffects;
    const settle = () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
    const pixelMass = async (canvas: HTMLCanvasElement) => {
      const image = new Image();
      image.src = canvas.toDataURL();
      await image.decode();
      const copy = document.createElement('canvas');
      copy.width = image.width;
      copy.height = image.height;
      const context = copy.getContext('2d')!;
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, copy.width, copy.height).data;
      let alpha = 0;
      let luminance = 0;
      for (let index = 0; index < pixels.length; index += 4) {
        alpha += pixels[index + 3];
        luminance +=
          pixels[index] * 0.2126 + pixels[index + 1] * 0.7152 + pixels[index + 2] * 0.0722;
      }
      return { alpha, luminance };
    };
    const makeTarget = () => {
      const host = document.createElement('div');
      host.style.cssText = 'position:relative;width:240px;height:160px';
      const target = source.cloneNode(true) as HTMLElement;
      target.removeAttribute('id');
      host.append(target);
      document.body.append(host);
      return { host, target };
    };
    const frostTarget = makeTarget();
    const slimeTarget = makeTarget();
    const paperTarget = makeTarget();
    const frost = window.controlEffects.frost(frostTarget.target, {
      host: frostTarget.host,
      clock: 'manual',
      time: 2,
      intensity: 0.8,
      seed: 314,
      coatingDepth: 0.05,
      mistReach: 0.1,
    });
    const slime = window.controlEffects.slime(slimeTarget.target, {
      host: slimeTarget.host,
      clock: 'manual',
      time: 2,
      intensity: 0.8,
      seed: 314,
      coatingDepth: 0.05,
      dripReach: 0.1,
    });
    const paper = window.controlEffects['burned-paper'](paperTarget.target, {
      host: paperTarget.host,
      clock: 'manual',
      time: 2,
      intensity: 0.8,
      seed: 314,
      scorchDepth: 0.05,
      ashReach: 0.1,
    });
    try {
      await Promise.all([frost.ready, slime.ready, paper.ready]);
      const initial = await Promise.all(
        [frostTarget, slimeTarget, paperTarget].map(({ host }) =>
          pixelMass(host.querySelector('canvas')!),
        ),
      );
      let textures = 0;
      let pipelines = 0;
      const createTexture = GPUDevice.prototype.createTexture;
      const createRenderPipeline = GPUDevice.prototype.createRenderPipeline;
      GPUDevice.prototype.createTexture = function (...args) {
        textures += 1;
        return createTexture.apply(this, args);
      };
      GPUDevice.prototype.createRenderPipeline = function (...args) {
        pipelines += 1;
        return createRenderPipeline.apply(this, args);
      };
      const timeline = gsap.timeline({ paused: true });
      timeline.to(frost, { mistOpacity: 0, duration: 1, ease: 'power1.inOut' }, 0);
      timeline.from(slime, { gloss: 0, duration: 1, ease: 'none' }, 1);
      timeline.fromTo(paper, { emberGlow: 0 }, { emberGlow: 1, duration: 1, ease: 'none' }, 2);
      timeline.seek(0.5, true);
      const frostMidpoint = frost.mistOpacity;
      timeline.seek(1.5, true);
      const slimeMidpoint = slime.gloss;
      timeline.seek(2.5, true);
      const paperMidpoint = paper.emberGlow;
      timeline.reverse();
      timeline.seek(2.25, true);
      const paperReverse = paper.emberGlow;
      timeline.seek(0.5, true);
      timeline.killTweensOf(frost, 'mistOpacity');
      timeline.seek(1, true);
      const frostKilled = frost.mistOpacity;
      frost.mistOpacity = 0.8;
      slime.gloss = 0.7;
      paper.emberGlow = 0.6;
      let scoped: ReturnType<typeof gsap.timeline> | undefined;
      const context = gsap.context(() => {
        scoped = gsap
          .timeline({ paused: true })
          .to(frost, { mistOpacity: 0.1, duration: 1, ease: 'none' }, 0)
          .to(slime, { gloss: 0.1, duration: 1, ease: 'none' }, 0)
          .to(paper, { emberGlow: 0.1, duration: 1, ease: 'none' }, 0);
      });
      scoped!.seek(0.5, true);
      const scopedValues = [frost.mistOpacity, slime.gloss, paper.emberGlow];
      context.revert();
      await settle();
      const rendered = await Promise.all(
        [frostTarget, slimeTarget, paperTarget].map(({ host }) =>
          pixelMass(host.querySelector('canvas')!),
        ),
      );
      frost.mistOpacity = 1;
      slime.gloss = 1;
      paper.emberGlow = 1;
      await settle();
      const defaultRestored = await Promise.all(
        [frostTarget, slimeTarget, paperTarget].map(({ host }) =>
          pixelMass(host.querySelector('canvas')!),
        ),
      );
      timeline.kill();
      GPUDevice.prototype.createTexture = createTexture;
      GPUDevice.prototype.createRenderPipeline = createRenderPipeline;
      return {
        defaults: [frost.mistOpacity, slime.gloss, paper.emberGlow],
        frostMidpoint,
        slimeMidpoint,
        paperMidpoint,
        paperReverse,
        frostKilled,
        scopedValues,
        restored: [frost.mistOpacity, slime.gloss, paper.emberGlow],
        initial,
        rendered,
        defaultRestored,
        resources: { textures, pipelines },
      };
    } finally {
      frost.dispose();
      slime.dispose();
      paper.dispose();
      frostTarget.host.remove();
      slimeTarget.host.remove();
      paperTarget.host.remove();
    }
  });
  expect(result.frostMidpoint).toBeCloseTo(0.5, 6);
  expect(result.slimeMidpoint).toBeCloseTo(0.5, 6);
  expect(result.paperMidpoint).toBeCloseTo(0.5, 6);
  expect(result.paperReverse).toBeCloseTo(0.25, 6);
  expect(result.frostKilled).toBeCloseTo(0.5, 6);
  expect(result.scopedValues).toEqual([0.45, 0.4, 0.35]);
  expect(result.restored).toEqual([0.8, 0.7, 0.6]);
  expect(result.defaults).toEqual([1, 1, 1]);
  expect(result.resources).toEqual({ textures: 0, pipelines: 0 });
  for (const [before, after] of result.initial.map(
    (value, index) => [value, result.rendered[index]] as const,
  )) {
    expect(before.alpha).toBeGreaterThan(0);
    expect(after.alpha).toBeGreaterThan(0);
    expect(before.luminance).not.toBe(after.luminance);
  }
  expect(result.defaultRestored).toEqual(result.initial);
});
