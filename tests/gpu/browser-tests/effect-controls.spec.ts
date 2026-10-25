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
