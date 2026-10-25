import { expect, test, type Page } from '@playwright/test';

import type {} from '../src/manual.js';

async function frames(page: Page) {
  await page.evaluate(async () => {
    for (let i = 0; i < 5; i += 1) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }
  });
}

test.beforeEach(async ({ page }) => {
  await page.goto('/manual.html');
  await page.evaluate(async () => {
    await window.manual.effect.ready;
    window.manual.effect.dispose();
  });
});

test('repeated zero dimensions suspend and recover with exactly one fresh capture', async ({
  page,
}) => {
  await page.evaluate(async () => {
    const fixture = window.manual.createMotionFixture('respect');
    window.manual.motionFixture = fixture;
    fixture.effect.pause();
    fixture.host.id = 'size-host';
    await fixture.effect.ready;
  });
  for (const [index, dimension] of ['width', 'height', 'width'].entries()) {
    await page.evaluate((dimension) => {
      // External stylesheet changes exercise ResizeObserver without target mutations.
      const style = document.createElement('style');
      style.id = 'zero-size';
      style.textContent = `#size-host > div { ${dimension}:0 !important }`;
      document.head.append(style);
    }, dimension);
    await expect
      .poll(() => page.evaluate(() => window.manual.motionFixture!.effect.raster))
      .toBe('stale');
    await frames(page);
    expect(await page.evaluate(() => window.manual.motionFixture!.snapshot())).toMatchObject({
      lifecycle: 'suspended',
      captures: index + 1,
      preparations: index + 1,
    });
    expect(
      await page.evaluate(
        () => window.manual.motionFixture!.host.querySelector('canvas')!.style.display,
      ),
    ).toBe('none');
    await page.evaluate(() => document.querySelector('#zero-size')!.remove());
    await expect
      .poll(() => page.evaluate(() => window.manual.motionFixture!.effect.lifecycle))
      .toBe('active');
    await frames(page);
    expect(await page.evaluate(() => window.manual.motionFixture!.snapshot())).toMatchObject({
      captures: index + 2,
      preparations: index + 2,
      releases: index + 2,
      destroys: index + 1,
      raster: 'fresh',
    });
    expect(await page.evaluate(() => window.manual.motionFixture!.effect.time)).toBe(7);
  }
  await page.evaluate(() => window.manual.motionFixture!.dispose());
  expect(await page.evaluate(() => window.manual.motionFixture!.snapshot())).toMatchObject({
    managedBytes: 0,
    reservedBytes: 0,
    serviceDestroys: 1,
    destroys: 4,
  });
});

test('initial zero size waits without capture or frame allocation @smoke', async ({ page }) => {
  await page.evaluate(async () => {
    const fixture = window.manual.createMotionFixture('respect');
    window.manual.motionFixture = fixture;
    fixture.effect.pause();
    fixture.target.style.width = '0';
    await fixture.effect.ready;
  });
  await frames(page);
  expect(await page.evaluate(() => window.manual.motionFixture!.snapshot())).toMatchObject({
    lifecycle: 'suspended',
    raster: 'stale',
    captures: 0,
    preparations: 0,
    managedBytes: 0,
    reservedBytes: 0,
    canvases: 0,
  });
  await page.evaluate(() => {
    window.manual.motionFixture!.target.style.width = '24px';
  });
  await expect
    .poll(() => page.evaluate(() => window.manual.motionFixture!.effect.lifecycle))
    .toBe('active');
  await frames(page);
  expect(await page.evaluate(() => window.manual.motionFixture!.snapshot())).toMatchObject({
    captures: 1,
    preparations: 1,
    raster: 'fresh',
  });
  await page.evaluate(() => window.manual.motionFixture!.dispose());
});

for (const [mode, options] of [
  ['legacy', {}],
  ['relative', { flameReach: 0.1 }],
] as const) {
  test(`target re-entry recovers an initial ${mode} capture invalidated while offscreen`, async ({
    page,
  }) => {
    await page.evaluate(async (options) => {
      document.body.style.minHeight = '2000px';
      const fixture = window.manual.createMotionFixture('respect', 'capture', undefined, options);
      window.manual.motionFixture = fixture;
      fixture.effect.pause();
      await fixture.entered;
      scrollTo(0, 1000);
    }, options);
    await expect
      .poll(() => page.evaluate(() => window.manual.motionFixture!.effect.raster))
      .toBe('stale');

    await page.evaluate(() => {
      scrollTo(0, 0);
      window.manual.motionFixture!.release();
    });
    await expect
      .poll(() => page.evaluate(() => window.manual.motionFixture!.effect.lifecycle))
      .toBe('active');
    expect(await page.evaluate(() => window.manual.motionFixture!.snapshot())).toMatchObject({
      captures: 2,
      raster: 'fresh',
    });
    expect(await page.evaluate(() => window.manual.motionFixture!.effect.paused)).toBe(true);

    await page.evaluate(() => window.manual.motionFixture!.dispose());
    expect(await page.evaluate(() => window.manual.motionFixture!.snapshot())).toMatchObject({
      lifecycle: 'disposed',
      canvases: 0,
    });
  });

  test(`delayed intersection delivery cannot strand an initial ${mode} capture after fast re-entry`, async ({
    page,
  }) => {
    await page.evaluate(async (options) => {
      document.body.style.minHeight = '2000px';
      const NativeObserver = window.IntersectionObserver;
      let deferred = true;
      let deliver = () => {};
      let observed = () => {};
      const observation = new Promise<void>((resolve) => {
        observed = resolve;
      });
      // Native intersection sampling and callback delivery are separate tasks.
      // Deliver a visible sample after scrolling out, then return before the
      // browser can sample the offscreen position.
      window.IntersectionObserver = class extends NativeObserver {
        constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
          super((entries, observer) => {
            if (deferred) {
              deliver = () => callback(entries, observer);
              observed();
            } else {
              callback(entries, observer);
            }
          }, options);
        }
      };
      try {
        const fixture = window.manual.createMotionFixture('respect', 'capture', undefined, options);
        window.manual.motionFixture = fixture;
        fixture.effect.pause();
        await fixture.entered;
        await observation;
        scrollTo(0, 1000);
        deferred = false;
        deliver();
        scrollTo(0, 0);
        fixture.release();
      } finally {
        window.IntersectionObserver = NativeObserver;
      }
    }, options);
    await expect
      .poll(() => page.evaluate(() => window.manual.motionFixture!.effect.lifecycle))
      .toBe('active');
    await frames(page);
    expect(await page.evaluate(() => window.manual.motionFixture!.snapshot())).toMatchObject({
      captures: 2,
      raster: 'fresh',
      paused: true,
      times: [7],
    });
    await page.evaluate(() => window.manual.motionFixture!.dispose());
    expect(await page.evaluate(() => window.manual.motionFixture!.snapshot())).toMatchObject({
      lifecycle: 'disposed',
      canvases: 0,
      managedBytes: 0,
      reservedBytes: 0,
    });
  });
}

for (const stage of ['renderer', 'capture', 'prepare'] as const) {
  for (const transition of ['zero', 'disconnect'] as const) {
    test(`${transition} during initial ${stage} rejects late output`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.evaluate(async (stage) => {
        const fixture = window.manual.createMotionFixture('respect', stage);
        window.manual.motionFixture = fixture;
        fixture.effect.pause();
        await fixture.entered;
      }, stage);
      await page.evaluate((transition) => {
        const fixture = window.manual.motionFixture!;
        if (transition === 'zero') {
          fixture.target.style.height = '0';
        } else {
          fixture.target.remove();
        }
      }, transition);
      await expect
        .poll(() => page.evaluate(() => window.manual.motionFixture!.effect.lifecycle))
        .toBe(transition === 'zero' ? 'suspended' : 'disposed');
      await frames(page);
      if (transition === 'disconnect') {
        await page.evaluate(() => {
          const fixture = window.manual.motionFixture!;
          fixture.host.append(fixture.target);
        });
      }
      await page.evaluate(async () => {
        const fixture = window.manual.motionFixture!;
        fixture.release();
        await fixture.effect.ready;
      });
      const settled = await page.evaluate(() => window.manual.motionFixture!.snapshot());
      expect(settled).toMatchObject({
        raster: 'stale',
        managedBytes: 0,
        reservedBytes: 0,
        canvases: 0,
        times: [],
      });
      expect(settled.releases).toBe(settled.captures);
      expect(settled.destroys).toBe(settled.preparations);
      await page.evaluate((transition) => {
        const fixture = window.manual.motionFixture!;
        if (transition === 'zero') {
          fixture.target.style.height = '24px';
        } else {
          fixture.host.append(fixture.target);
        }
      }, transition);
      if (transition === 'zero') {
        await expect
          .poll(() => page.evaluate(() => window.manual.motionFixture!.effect.lifecycle))
          .toBe('active');
      }
      await frames(page);
      const recovered = await page.evaluate(() => window.manual.motionFixture!.snapshot());
      expect(recovered.captures).toBe(settled.captures + (transition === 'zero' ? 1 : 0));
      expect(recovered.lifecycle).toBe(transition === 'zero' ? 'active' : 'disposed');
      await page.evaluate(() => {
        window.manual.motionFixture!.dispose();
        window.manual.motionFixture!.dispose();
      });
      expect(await page.evaluate(() => window.manual.motionFixture!.snapshot())).toMatchObject({
        managedBytes: 0,
        reservedBytes: 0,
        serviceDestroys: 1,
      });
      expect(errors).toEqual([]);
    });
  }
}

for (const stage of ['capture', 'prepare'] as const) {
  test(`zero/nonzero during refresh ${stage} coalesces recovery before late completion`, async ({
    page,
  }) => {
    await page.evaluate(async (stage) => {
      const fixture = window.manual.createMotionFixture('respect');
      window.manual.motionFixture = fixture;
      fixture.effect.pause();
      await fixture.effect.ready;
      fixture.block(stage);
      void fixture.effect.refresh().catch((error: Error) => {
        document.documentElement.dataset.settlement = error.message;
      });
      await fixture.entered;
      fixture.target.style.width = '0';
    }, stage);
    await expect(page.locator('html')).toHaveAttribute('data-settlement', 'refresh-invalidated');
    await frames(page);
    expect(await page.evaluate(() => window.manual.motionFixture!.snapshot())).toMatchObject({
      captures: 2,
      lifecycle: 'suspended',
      raster: 'stale',
      times: [7],
    });
    await page.evaluate(() => {
      window.manual.motionFixture!.target.style.width = '24px';
    });
    await frames(page);
    expect(await page.evaluate(() => window.manual.motionFixture!.stats.captures)).toBe(2);
    expect(
      await page.evaluate(
        () => window.manual.motionFixture!.host.querySelector('canvas')!.style.display,
      ),
    ).toBe('none');
    await page.evaluate(() => window.manual.motionFixture!.release());
    await expect
      .poll(() => page.evaluate(() => window.manual.motionFixture!.effect.lifecycle))
      .toBe('active');
    await frames(page);
    expect(await page.evaluate(() => window.manual.motionFixture!.snapshot())).toMatchObject({
      captures: 3,
      releases: 3,
      raster: 'fresh',
      times: [7, 7],
    });
    await page.evaluate(() => {
      window.manual.motionFixture!.dispose();
      window.manual.motionFixture!.dispose();
    });
    const disposed = await page.evaluate(() => window.manual.motionFixture!.snapshot());
    expect(disposed).toMatchObject({ managedBytes: 0, reservedBytes: 0, serviceDestroys: 1 });
    expect(disposed.destroys).toBe(disposed.preparations);
  });
}

for (const state of ['active', 'zero', 'hidden', 'motion', 'reinserted', 'host'] as const) {
  test(`disconnect while ${state} disposes once and releases the target claim`, async ({
    page,
  }) => {
    await page.evaluate(async (state) => {
      const fixture = window.manual.createMotionFixture('respect');
      window.manual.motionFixture = fixture;
      fixture.effect.pause();
      await fixture.effect.ready;
      let disposals = 0;
      fixture.effect.onDispose(() => {
        document.documentElement.dataset.disposals = String(++disposals);
      });
      if (state === 'zero') {
        fixture.target.style.width = '0';
      } else if (state === 'hidden') {
        Object.defineProperty(document, 'hidden', { configurable: true, value: true });
        document.dispatchEvent(new Event('visibilitychange'));
      }
    }, state);
    if (state === 'motion') {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await expect
        .poll(() => page.evaluate(() => window.manual.motionFixture!.effect.reason))
        .toBe('reduced-motion');
    }
    await frames(page);
    await page.evaluate((state) => {
      const fixture = window.manual.motionFixture!;
      if (state === 'host') {
        fixture.host.remove();
      } else {
        fixture.target.remove();
      }
      if (state === 'reinserted') {
        fixture.host.append(fixture.target);
        // A synchronous refresh must also drain the removal record.
        void fixture.effect.refresh().catch(() => {});
      }
    }, state);
    await expect
      .poll(() => page.evaluate(() => window.manual.motionFixture!.effect.lifecycle))
      .toBe('disposed');
    await expect(page.locator('html')).toHaveAttribute('data-disposals', '1');
    expect(await page.evaluate(() => window.manual.motionFixture!.snapshot())).toMatchObject({
      canvases: 0,
      managedBytes: 0,
      reservedBytes: 0,
      serviceDestroys: 1,
    });
    if (state === 'motion') {
      await page.emulateMedia({ reducedMotion: 'no-preference' });
    }
    const result = await page.evaluate(async () => {
      const fixture = window.manual.motionFixture!;
      Object.defineProperty(document, 'hidden', { configurable: true, value: false });
      document.dispatchEvent(new Event('visibilitychange'));
      document.body.append(fixture.host);
      fixture.host.append(fixture.target);
      fixture.target.style.width = '24px';
      fixture.effect.time = 9;
      fixture.effect.resume();
      const rejection = await fixture.effect.refresh().catch((error: Error) => error.message);
      const replacement = window.manual.attach(fixture.target, { host: fixture.host });
      await replacement.ready;
      fixture.effect.dispose();
      fixture.effect.dispose();
      const active = replacement.lifecycle;
      replacement.dispose();
      fixture.dispose();
      return { rejection, active };
    });
    expect(result).toEqual({ rejection: 'effect-disposed', active: 'active' });
    await expect(page.locator('html')).toHaveAttribute('data-disposals', '1');
  });
}
