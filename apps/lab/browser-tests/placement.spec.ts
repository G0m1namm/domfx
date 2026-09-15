import { expect, test } from '@playwright/test';

import type {} from '../src/manual.js';

for (const css of [
  'border-radius:12px',
  'clip-path:circle(40%)',
  'mask-image:linear-gradient(black,transparent)',
  'contain:paint',
  'overflow:clip;overflow-clip-margin:8px',
  'position:static',
  'position:fixed',
]) {
  test(`bypassed unsupported clipping is unavailable: ${css}`, async ({ page }) => {
    await page.goto('/manual.html');
    await expect(page.locator('#state')).toContainText('"lifecycle":"active"');
    const result = await page.evaluate(async (css) => {
      window.manual.effect.dispose();
      const fixture = await window.manual.createPlacementFixture('manual', true);
      const target = document.querySelector<HTMLElement>('#placement-target')!;
      const host = document.querySelector<HTMLElement>('#placement-host')!;
      const scroller = document.querySelector<HTMLElement>('#placement-scroll')!;
      scroller.style.cssText += `;${css}`;
      for (let i = 0; i < 3; i += 1) {
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      }
      const live = {
        lifecycle: fixture.effect.lifecycle,
        reason: fixture.effect.reason,
        canvases: host.querySelectorAll('canvas').length,
      };
      // Initial attachment must also reject the same combination and release its claim.
      const initial = window.manual.attach(target, { host });
      await initial.ready;
      const initialState = {
        lifecycle: initial.lifecycle,
        reason: initial.reason,
        canvases: host.querySelectorAll('canvas').length,
      };
      const connected = target.isConnected;
      initial.dispose();
      fixture.dispose();
      return { live, initial: initialState, connected };
    }, css);
    expect(result).toEqual({
      live: { lifecycle: 'unavailable', reason: 'unsupported-placement', canvases: 0 },
      initial: { lifecycle: 'unavailable', reason: 'unsupported-placement', canvases: 0 },
      connected: true,
    });
  });
}

for (const dpr of [1, 2]) {
  test.describe(`fractional placement at DPR ${dpr}`, () => {
    test.use({ deviceScaleFactor: dpr });
    for (const clock of ['manual', 'ambient'] as const) {
      test(`${clock} bordered nested scrolling preserves placement and clips output`, async ({
        page,
        browser,
      }, testInfo) => {
        await page.goto('/manual.html');
        await expect(page.locator('#state')).toContainText('"lifecycle":"active"');
        await page.evaluate(async (clock) => {
          window.manual.effect.dispose();
          window.manual.placementFixture = await window.manual.createPlacementFixture(clock, true);
        }, clock);
        for (const step of ['initial', 'window', 'host', 'inner', 'outside', 'restore'] as const) {
          const sample = await page.evaluate(async (step) => {
            const fixture = window.manual.placementFixture!;
            if (step !== 'initial') {
              fixture.scroll(step);
            }
            for (let i = 0; i < 3; i += 1) {
              await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
            }
            const layer = document.querySelector<HTMLCanvasElement>('#placement-host > canvas')!;
            const scroller = document.querySelector<HTMLElement>('#placement-scroll')!;
            // An independently placed child uses native ancestor clipping as the
            // oracle. A one-CSS-pixel probe measures the actual containing block.
            const reference = document.createElement('div');
            reference.style.cssText =
              'position:absolute;left:0;top:0;width:1px;height:1px;pointer-events:none';
            scroller.append(reference);
            const basis = reference.getBoundingClientRect();
            const rect = layer.getBoundingClientRect();
            reference.style.left = `${(rect.left - basis.left) / basis.width}px`;
            reference.style.top = `${(rect.top - basis.top) / basis.height}px`;
            reference.style.width = `${rect.width / basis.width}px`;
            reference.style.height = `${rect.height / basis.height}px`;
            layer.style.pointerEvents = 'auto';
            const probes: { x: number; y: number; actual: boolean }[] = [];
            let inside = 0;
            for (
              let y = Math.max(0, rect.top + 2);
              y < Math.min(innerHeight, rect.bottom);
              y += 3
            ) {
              for (
                let x = Math.max(0, rect.left + 2);
                x < Math.min(innerWidth, rect.right);
                x += 3
              ) {
                const actual = document.elementFromPoint(x, y) === layer;
                probes.push({ x, y, actual });
                if (actual) {
                  inside += 1;
                }
              }
            }
            layer.style.pointerEvents = 'none';
            reference.style.pointerEvents = 'auto';
            // Native overflow and clip-path hit testing snap boundary samples
            // differently. Reject discrepancies beyond one physical pixel.
            const tolerance = 1 / devicePixelRatio;
            const mismatches = probes.filter(({ x, y, actual }) =>
              [-tolerance, 0, tolerance].every((dx) =>
                [-tolerance, 0, tolerance].every(
                  (dy) => actual !== (document.elementFromPoint(x + dx, y + dy) === reference),
                ),
              ),
            ).length;
            reference.remove();
            return {
              ...fixture.sample(),
              inside,
              mismatches,
              scroll: {
                x: scrollX,
                y: scrollY,
                host: [layer.parentElement!.scrollLeft, layer.parentElement!.scrollTop],
                inner: [scroller.scrollLeft, scroller.scrollTop],
              },
            };
          }, step);
          await testInfo.attach(`${step}-scroll.json`, {
            body: JSON.stringify({
              browser: browser.version(),
              viewport: page.viewportSize(),
              ...sample,
            }),
            contentType: 'application/json',
          });
          await testInfo.attach(`${step}-scroll.png`, {
            body: await page.screenshot(),
            contentType: 'image/png',
          });
          expect(sample).toMatchObject({
            lifecycle: step === 'outside' ? 'suspended' : 'active',
            raster: 'fresh',
            time: 2.75,
            paused: true,
            captures: 1,
            samePixels: true,
            dpr,
          });
          if (step !== 'outside') {
            for (const point of sample.points) {
              expect(point.errorPhysical).toBeLessThanOrEqual(1);
            }
          }
          expect(sample.mismatches).toBe(0);
          expect(sample.renders).toBe(1);
          if (step === 'outside') {
            expect(sample.inside).toBe(0);
          } else {
            expect(sample.inside).toBeGreaterThan(0);
          }
          if (step === 'window') {
            expect(sample.scroll.x).toBeGreaterThan(0);
            expect(sample.scroll.y).toBeGreaterThan(0);
          }
          if (step === 'host' || step === 'inner') {
            expect(sample.scroll[step][0]).toBeGreaterThan(0);
            expect(sample.scroll[step][1]).toBeGreaterThan(0);
          }
        }
        await page.evaluate(() => window.manual.placementFixture!.dispose());
        await expect(page.locator('#placement-host')).toHaveCount(0);
      });

      test(`${clock} paused paint follows layout and transforms without recapture`, async ({
        page,
        browser,
      }, testInfo) => {
        const errors: string[] = [];
        page.on('pageerror', (error) => errors.push(error.message));
        page.on('console', (message) => {
          if (message.type() === 'error') {
            errors.push(message.text());
          }
        });
        await page.goto('/manual.html');
        await expect(page.locator('#state')).toContainText('"lifecycle":"active"');
        await page.evaluate(async (clock) => {
          window.manual.effect.dispose();
          window.manual.placementFixture = await window.manual.createPlacementFixture(clock);
        }, clock);
        for (const step of ['initial', 'layout', 'ancestor', 'target', 'animation'] as const) {
          const sample = await page.evaluate(async (step) => {
            const fixture = window.manual.placementFixture!;
            if (step !== 'initial') {
              fixture.move(step);
            }
            for (let i = 0; i < 3; i += 1) {
              await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
            }
            return fixture.sample();
          }, step);
          await testInfo.attach(`${step}-geometry.json`, {
            body: JSON.stringify({
              browser: browser.version(),
              viewport: page.viewportSize(),
              ...sample,
            }),
            contentType: 'application/json',
          });
          await testInfo.attach(`${step}.png`, {
            body: await page.screenshot(),
            contentType: 'image/png',
          });
          expect(sample).toMatchObject({
            lifecycle: 'active',
            raster: 'fresh',
            time: 2.75,
            paused: true,
            captures: 1,
            renders: 1,
            samePixels: true,
            dpr,
          });
          for (const point of sample.points) {
            expect(point.errorPhysical).toBeLessThanOrEqual(1);
          }
        }
        await page.evaluate(() => window.manual.placementFixture!.dispose());
        await expect(page.locator('#placement-host')).toHaveCount(0);
        expect(errors).toEqual([]);
      });
    }
  });
}

for (const change of ['mixed-paint', 'descendant-transform', 'unsupported-transform'] as const) {
  test(`${change} cannot reuse the fresh raster as a placement-only change`, async ({ page }) => {
    await page.goto('/manual.html');
    await expect(page.locator('#state')).toContainText('"lifecycle":"active"');
    const result = await page.evaluate(async (change) => {
      window.manual.effect.dispose();
      const fixture = await window.manual.createPlacementFixture('manual');
      const target = document.querySelector<HTMLElement>('#placement-target')!;
      const marker = target.querySelector('rect')!;
      if (change === 'mixed-paint') {
        target.style.transform = 'translate(20.25px, 10.125px)';
        target.style.background = 'red';
        // Drain queued mutations in the same task as a control write.
        fixture.effect.time = 2.75;
      } else if (change === 'descendant-transform') {
        marker.style.transform = 'translate(2.25px, 3.5px)';
        fixture.effect.time = 2.75;
      } else {
        target.style.transform = 'rotate(15deg)';
        for (let i = 0; i < 2; i += 1) {
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        }
      }
      const canvas = document.querySelector<HTMLCanvasElement>('#placement-host > canvas');
      const result = {
        lifecycle: fixture.effect.lifecycle,
        raster: fixture.effect.raster,
        reason: fixture.effect.reason,
        hidden: !canvas || canvas.style.display === 'none',
        targetConnected: target.isConnected,
      };
      fixture.dispose();
      return result;
    }, change);
    expect(result).toEqual({
      lifecycle: change === 'unsupported-transform' ? 'unavailable' : 'suspended',
      raster: 'stale',
      reason: change === 'unsupported-transform' ? 'unsupported-placement' : 'stale-raster',
      hidden: true,
      targetConnected: true,
    });
  });
}
