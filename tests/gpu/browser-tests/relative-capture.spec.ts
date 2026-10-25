import { expect, test } from '@playwright/test';

import type {} from '../src/effects.js';
import type {} from '../src/manual.js';

test('raw text outside the source viewport is rejected before paint is cropped', async ({
  page,
}, info) => {
  await page.goto('/manual.html');
  await page.evaluate(() => window.manual.effect.ready);
  const result = await page.evaluate(async () => {
    window.manual.effect.dispose();
    const host = document.createElement('div');
    host.style.cssText = 'position:absolute;left:80px;top:80px;width:200px;height:200px';
    document.body.append(host);
    const results = [];
    for (const [indent, relative, boxless] of [
      [200, true, false],
      [1000, true, false],
      [200, true, true],
      [1000, true, true],
      [0, true, false],
      [0, true, true],
      [200, false, false],
      [200, false, true],
    ] as const) {
      const target = document.createElement('div');
      target.style.cssText = `width:100px;height:100px;background:white;color:white;font:16px/20px sans-serif;white-space:nowrap;overflow:visible;text-indent:${indent}px`;
      if (boxless) {
        const span = document.createElement('span');
        span.style.display = 'contents';
        span.textContent = 'Escaped text';
        target.append(span);
      } else {
        target.textContent = 'Escaped text';
      }
      host.append(target);
      const effect = window.manual.attach(target, {
        host,
        ...(relative ? { flameReach: 0.1 } : {}),
      });
      await effect.ready;
      results.push({
        indent,
        relative,
        boxless,
        lifecycle: effect.lifecycle,
        reason: effect.reason,
      });
      effect.dispose();
      target.remove();
    }
    const canvases = host.querySelectorAll('canvas').length;
    host.remove();
    return { results, canvases };
  });
  await info.attach('raw-text-admission.json', {
    body: JSON.stringify(result),
    contentType: 'application/json',
  });
  expect(result.results.slice(0, 4)).toEqual(
    [
      [200, false],
      [1000, false],
      [200, true],
      [1000, true],
    ].map(([indent, boxless]) => ({
      indent,
      boxless,
      relative: true,
      lifecycle: 'unavailable',
      reason: 'missing-exterior',
    })),
  );
  expect(result.results.slice(4).map((sample) => sample.lifecycle)).toEqual([
    'active',
    'active',
    'active',
    'active',
  ]);
  expect(result.canvases).toBe(0);
});

test('boxless generated paint is rejected even when its owner hides its own text', async ({
  page,
}, info) => {
  await page.goto('/manual.html');
  await page.evaluate(() => window.manual.effect.ready);
  const result = await page.evaluate(async () => {
    window.manual.effect.dispose();
    const host = document.createElement('div');
    host.style.cssText = 'position:absolute;left:80px;top:80px;width:200px;height:200px';
    const style = document.createElement('style');
    style.textContent =
      '.relative-escaped-before::before,.relative-escaped-after::after { content:"Escaped text";position:absolute;left:1000px;top:0;visibility:visible }';
    host.append(style);
    document.body.append(host);
    const results = [];
    for (const pseudo of ['before', 'after']) {
      for (const boxless of [true, false]) {
        for (const hidden of [false, true]) {
          for (const relative of [true, false]) {
            const target = document.createElement('div');
            target.style.cssText =
              'position:relative;width:100px;height:100px;background:white;color:white;font:16px/20px sans-serif;overflow:visible';
            const span = document.createElement('span');
            span.className = `relative-escaped-${pseudo}`;
            span.style.cssText = `display:${boxless ? 'contents' : 'inline'};visibility:${hidden ? 'hidden' : 'visible'}`;
            target.append(span);
            host.append(target);
            const effect = window.manual.attach(target, {
              host,
              ...(relative ? { flameReach: 0.1 } : {}),
            });
            await effect.ready;
            results.push({
              pseudo,
              boxless,
              hidden,
              relative,
              lifecycle: effect.lifecycle,
              reason: effect.reason,
            });
            effect.dispose();
            target.remove();
          }
        }
      }
    }
    const canvases = host.querySelectorAll('canvas').length;
    host.remove();
    return { results, canvases };
  });
  await info.attach('boxless-generated-admission.json', {
    body: JSON.stringify(result),
    contentType: 'application/json',
  });
  for (const sample of result.results) {
    expect(sample).toMatchObject(
      sample.relative
        ? { lifecycle: 'unavailable', reason: 'missing-exterior' }
        : { lifecycle: 'active', reason: undefined },
    );
  }
  expect(result.canvases).toBe(0);
});

test('all 21 relative resolution listeners recapture on a synthetic event and detach on disposal', async ({
  page,
}, info) => {
  await page.goto('/effects.html');
  await page.waitForFunction(() => Boolean(window.qualifyRelativeResolutionListeners));
  const result = await page.evaluate(() => window.qualifyRelativeResolutionListeners());
  await info.attach('relative-resolution-listeners.json', {
    body: JSON.stringify(result),
    contentType: 'application/json',
  });
  expect(result.results).toHaveLength(21);
  for (const sample of result.results) {
    expect(sample, sample.effect).toMatchObject({
      refreshed: true,
      disposedCapturesStable: true,
      releasedBytes: 0,
    });
  }
  expect(result.canvases).toBe(0);
});

test.describe('public relative catalog at DPR 1', () => {
  test.use({ deviceScaleFactor: 1 });
  test('all 21 public effects retain strength and placement resources and resize from 100 to 400', async ({
    page,
  }, info) => {
    await page.goto('/effects.html');
    await page.waitForFunction(() => Boolean(window.qualifyRelativeCatalog));
    const result = await page.evaluate(() => window.qualifyRelativeCatalog());
    await info.attach('relative-catalog.json', {
      body: JSON.stringify(result),
      contentType: 'application/json',
    });
    expect(result.results).toHaveLength(21);
    for (const sample of result.results) {
      expect(sample, sample.effect).toMatchObject({
        stableStrength: true,
        stablePlacement: true,
        nonempty: true,
        zero: true,
        repeated: true,
        resizedState: 'active',
      });
      expect(sample.maximumStrengthError, sample.effect).toBeLessThanOrEqual(2);
      expect(sample.resizedWidth, sample.effect).toBeGreaterThan(sample.initialWidth * 3);
    }
    expect(result.releasedBytes).toBe(0);
    expect(result.canvases).toBe(0);
  });
});

for (const dpr of [1, 1.25, 2]) {
  for (const kind of ['flat', 'text', 'svg', 'image', 'image-integer']) {
    test(`all 21 relative effects preserve ${kind} capture phase and support at DPR ${dpr}`, async ({
      page,
    }, info) => {
      await page.goto('/effects.html');
      await page.waitForFunction(() => Boolean(window.qualifyRelativeCapture));
      const result = await page.evaluate(
        ([kind, dpr]) => window.qualifyRelativeCapture(kind, dpr),
        [kind, dpr] as const,
      );
      await info.attach('relative-capture.json', {
        body: JSON.stringify(result),
        contentType: 'application/json',
      });
      expect(result.box).toMatchObject(
        kind === 'image-integer' ? { width: 160, height: 100 } : { width: 160.5, height: 100.25 },
      );
      expect(result.mapping.a).toBeCloseTo(1 / dpr, 12);
      expect(result.mapping.d).toBeCloseTo(1 / dpr, 12);
      expect(result.mapping.e).toBe(-60);
      expect(result.mapping.f).toBe(-60);
      expect(result.padding).toMatchObject({ top: 60, left: 60 });
      for (const value of [result.padding.right, result.padding.bottom]) {
        expect(value).toBeGreaterThanOrEqual(60);
        expect(value).toBeLessThan(60 + 1 / dpr);
      }
      expect(result.maskDifferences).toBe(0);
      expect(result.sourceDifference).toBe(0);
      expect(result.sdfDifference).toBeLessThanOrEqual(0.125);
      expect(result.errors).toEqual([]);
      expect(result.results).toHaveLength(21);
      for (const sample of result.results) {
        expect(sample.maximumDifference, sample.effect).toBeLessThanOrEqual(2);
        expect(sample.boundaryAlpha, sample.effect).toBe(0);
      }
    });
  }
}
