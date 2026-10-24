import { expect, test } from '@playwright/test';

import type {} from '../src/energy-extent.js';
import { installResolutionProbe, resolutionEvidence } from './resolution-probe.js';

for (const kind of ['electricity', 'kinetic'] as const) {
  for (const dpr of [1, 1.25, 2]) {
    test.describe(`${kind} extent DPR ${dpr}`, () => {
      test.use({ deviceScaleFactor: dpr });
      test('resolves shorter side on resize and retains placement/strength allocations', async ({
        page,
      }, info) => {
        await page.goto('/energy-extent.html');
        const result = await page.evaluate((kind) => window.energy.verifyLifecycle(kind), kind);
        await info.attach('energy-lifecycle.json', {
          body: JSON.stringify(result),
          contentType: 'application/json',
        });
        expect(result.errors).toEqual([]);
        expect(result.placementOnly).toBe(true);
        expect(result.first.box).toMatchObject({ width: 100.25, height: 160.5 });
        expect(result.resized.box).toMatchObject({ width: 400, height: 400 });
        expect(result.scaleSample).toEqual(result.first);
        expect(result.refreshed).toEqual(result.resized);
        expect(result.first.boundary).toBe(0);
        expect(result.resized.boundary).toBe(0);
        expect(result.resized.reach).toBeGreaterThan(result.first.reach * 1.5);
        expect(result).toMatchObject({
          rejected: { reason: 'missing-exterior', bytes: 0, canvases: 0 },
          recovered: true,
          releasedBytes: 0,
          managedBytes: 0,
        });
      });
    });
  }
  for (const dpr of [1, 1.25, 2]) {
    test(`${kind} complete finite support and stable detail coordinates at DPR ${dpr}`, async ({
      page,
    }, info) => {
      await page.goto('/energy-extent.html');
      const result = await page.evaluate(
        ({ kind, dpr }) => window.energy.verifyGeometry(kind, dpr),
        { kind, dpr },
      );
      await info.attach('energy-geometry.json', {
        body: JSON.stringify(result),
        contentType: 'application/json',
      });
      expect(result.errors).toEqual([]);
      expect(result.managedBytes).toBe(0);
      for (const sample of result.samples) {
        expect(sample, JSON.stringify(sample)).toMatchObject({
          boundaryAlpha: 0,
          outsideAlpha: 0,
          zero: true,
          repeat: true,
          nonempty: true,
        });
        expect(sample.strengthError).toBeLessThanOrEqual(1);
        expect(sample.maxDifference).toBeLessThanOrEqual(2);
        expect(sample.recaptureOutputDifference).toBeLessThanOrEqual(2);
      }
      const flat = result.samples.filter((sample) => sample.shape === 'flat');
      const median = (values: number[]) =>
        [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
      expect(flat[1].detailWidths.length).toBeGreaterThan(0);
      expect(flat[2].detailWidths.length).toBeGreaterThan(0);
      expect(
        Math.abs(median(flat[1].detailWidths) - median(flat[2].detailWidths)),
        // Rasterized run widths have two independently quantized edges.
      ).toBeLessThanOrEqual(Math.max(1.5, 2 / dpr));
      expect(Math.max(...flat[2].detailWidths)).toBeLessThanOrEqual(10);

      expect(flat[1].maxReach).toBeGreaterThan(flat[0].maxReach * 1.5);
      // Kinetic fragments must be found beyond the legacy three-cell source search.
      expect(flat[2].maxReach).toBeGreaterThan(kind === 'kinetic' ? 36 : 25);
    });
  }
  test(`${kind} rejects invalid/foreign options and supports tiny lengths without ownership leaks`, async ({
    page,
  }) => {
    await page.goto('/energy-extent.html');
    const result = await page.evaluate(async (kind) => {
      const host = document.createElement('div');
      host.style.cssText = 'position:absolute;left:80px;top:80px';
      const target = document.createElement('button');
      target.style.cssText = 'width:100px;height:100px;border:0;background:white';
      host.append(target);
      document.body.append(host);
      const attach =
        kind === 'electricity' ? window.energy.attachElectricity : window.energy.attachKinetic;
      const key = kind === 'electricity' ? 'contourSpread' : 'fragmentTravel';
      const foreign = kind === 'electricity' ? 'fragmentTravel' : 'contourSpread';
      const rejected = [];
      for (const options of [
        ...[-1, NaN, Infinity, null, '0.1'].map((value) => ({ [key]: value })),
        { [foreign]: 0.1 },
      ]) {
        try {
          Reflect.apply(attach, undefined, [target, { host, ...options }]).dispose();
          rejected.push(false);
        } catch (error) {
          rejected.push(error instanceof Error && error.message === `invalid-${kind}-parameter`);
        }
      }
      const tiny = [];
      for (const length of [0, 0.000001, 0.001, 0.005, 0.01]) {
        const effect = attach(target, { host, [key]: length });
        await effect.ready;
        tiny.push(effect.lifecycle);
        effect.dispose();
      }
      target.style.width = '400px';
      target.style.height = '400px';
      const failures = [];
      for (const value of [0.2, Number.MAX_VALUE]) {
        const effect = attach(target, { host, [key]: value });
        await effect.ready;
        failures.push(effect.reason);
        effect.dispose();
      }
      target.style.width = '100px';
      target.style.height = '100px';
      const escaped = document.createElement('span');
      escaped.style.cssText =
        'position:absolute;left:2000px;width:10px;height:10px;background:white';
      target.append(escaped);
      const overflow = attach(target, { host, [key]: 0.1 });
      await overflow.ready;
      const overflowReason = overflow.reason;
      overflow.dispose();
      const result = {
        rejected,
        tiny,
        failures,
        overflowReason,
        canvases: host.querySelectorAll('canvas').length,
        visible: getComputedStyle(target).visibility,
      };
      host.remove();
      return result;
    }, kind);
    expect(result).toEqual({
      rejected: Array(6).fill(true),
      tiny: Array(5).fill('active'),
      failures: ['capture-budget', 'capture-budget'],
      overflowReason: 'missing-exterior',
      canvases: 0,
      visible: 'visible',
    });
  });
}

for (const kind of ['electricity', 'kinetic'] as const) {
  test(`${kind} DPR-only refresh fallback retains the same local ratio`, async ({ page }, info) => {
    await installResolutionProbe(page);
    await page.goto('/energy-extent.html');
    await page.evaluate(async (kind) => {
      const host = document.createElement('div');
      host.id = 'dpr-host';
      host.style.cssText = 'position:absolute;left:80px;top:80px';
      const target = document.createElement('div');
      target.id = 'dpr-target';
      target.style.cssText = 'width:100.25px;height:160.5px;background:white';
      host.append(target);
      document.body.append(host);
      const attach =
        kind === 'electricity' ? window.energy.attachElectricity : window.energy.attachKinetic;
      const options = kind === 'electricity' ? { contourSpread: 0.08 } : { fragmentTravel: 0.08 };
      const effect = attach(target, { host, ...options });
      window.energy.dprEffect = effect;
      await effect.ready;
      if (effect.lifecycle !== 'active') {
        throw new Error(`${effect.reason}: ${effect.reasonDetail}`);
      }
      window.addEventListener('pagehide', () => effect.dispose(), { once: true });
    }, kind);
    await page.waitForTimeout(100);
    const session = await page.context().newCDPSession(page);
    await session.send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 900,
      deviceScaleFactor: 1.25,
      mobile: false,
    });
    await page.waitForTimeout(100);
    const expectedWidth = kind === 'electricity' ? '161' : '181';
    const automatic =
      (await page.locator('#dpr-host canvas').getAttribute('width')) === expectedWidth;
    // CDP on some Chromium builds changes resolution queries without dispatching
    // their change event. Exercise the supported explicit-refresh fallback too.
    const evidence = await resolutionEvidence(page);
    if (evidence.changes === 0) {
      await page.evaluate(() => {
        const effect = window.energy.dprEffect;
        if (!effect) {
          throw new Error('Missing DPR attachment');
        }
        return effect.refresh();
      });
    }
    await info.attach('dpr-refresh.json', {
      body: JSON.stringify({ ...evidence, automatic, explicitRefresh: evidence.changes === 0 }),
      contentType: 'application/json',
    });
    await info.attach('dpr-result.json', {
      body: JSON.stringify(
        await page.evaluate(() => ({
          width: document.querySelector<HTMLCanvasElement>('#dpr-host canvas')?.width,
          lifecycle: window.energy.dprEffect?.lifecycle,
          raster: window.energy.dprEffect?.raster,
          reason: window.energy.dprEffect?.reason,
          detail: window.energy.dprEffect?.reasonDetail,
          dpr: devicePixelRatio,
        })),
      ),
      contentType: 'application/json',
    });
    await expect
      .poll(() => page.locator('#dpr-host canvas').getAttribute('width'))
      .toBe(expectedWidth);
    expect(
      await page.locator('#dpr-target').evaluate((target) => ({
        width: target.getBoundingClientRect().width,
        height: target.getBoundingClientRect().height,
      })),
    ).toEqual({ width: 100.25, height: 160.5 });
    await page.evaluate(() => window.energy.dprEffect?.dispose());
    expect(evidence.dpr).toBe(1.25);
    // A delivered native event must work. Absence is reported as the tested fallback.
    expect(evidence.changes === 0 || automatic).toBe(true);
  });
}
