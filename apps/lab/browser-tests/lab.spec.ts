import { expect, type Page, test as base } from '@playwright/test';

import type {} from '../src/main.js';

const test = base.extend<{ browserErrors: string[] }>({
  browserErrors: [
    async ({ page, browser }, use, testInfo) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(`page: ${error.message}`));
      page.on('console', (message) => {
        if (message.type() === 'error') {
          errors.push(`console: ${message.text()} (${message.location().url})`);
        }
      });
      await use(errors);
      await testInfo.attach('browser-errors.json', {
        body: JSON.stringify({ browser: browser.version(), errors }, null, 2),
        contentType: 'application/json',
      });
      const report = await page
        .locator('#report')
        .textContent({ timeout: 2000 })
        .catch(() => 'Lab report unavailable; inspect the trace and browser errors.');
      await testInfo.attach('lab-report.txt', { body: report ?? '', contentType: 'text/plain' });
      const images = await page.evaluate(() => window.domfxEvidence?.images ?? {});
      for (const [name, url] of Object.entries(images)) {
        await testInfo.attach(`${name}.png`, {
          body: Buffer.from(url.slice('data:image/png;base64,'.length), 'base64'),
          contentType: 'image/png',
        });
      }
    },
    { auto: true },
  ],
});

async function terminalReport(page: Page): Promise<unknown> {
  // Both PASS and FAIL are terminal: fail immediately on an explicit lab failure.
  await expect(page.locator('#report')).toContainText('"outcome":', { timeout: 150_000 });
  // The raw report lives in a disclosure; read its JSON even while it is closed.
  return JSON.parse((await page.locator('#report').textContent()) ?? '');
}

async function clockTime(page: Page): Promise<number> {
  const clock = await page.locator('#clock').innerText();
  const match = /Manual clock · ([\d.]+)s/.exec(clock);
  expect(match, clock).not.toBeNull();
  return Number(match?.[1]);
}

async function gallerySnapshot(page: Page) {
  return page.evaluate(async () => {
    const gallery = window.domfxGallery;
    if (!gallery) {
      throw new Error('gallery unavailable');
    }
    await gallery.saveLiveEvidence();
    return gallery.entries
      .filter(({ effect }) => effect.lifecycle !== 'disposed')
      .map((entry) => {
        const { id, effect, target, layer } = entry;
        if (!layer) {
          throw new Error(`missing layer: ${id}`);
        }
        const canvas = document.createElement('canvas');
        canvas.width = layer.width;
        canvas.height = layer.height;
        const context = canvas.getContext('2d');
        if (!context) {
          throw new Error('readback unavailable');
        }
        context.drawImage(layer, 0, 0);
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
        const alphaPixels = pixels.filter((value, index) => index % 4 === 3 && value > 0).length;
        let hash = 2166136261;
        for (const byte of pixels) {
          hash = Math.imul(hash ^ byte, 16777619);
        }
        const targetBounds = target.getBoundingClientRect();
        const layerBounds = layer.getBoundingClientRect();
        return {
          id,
          time: effect.time,
          intensity: effect.intensity,
          alphaPixels,
          lifecycle: effect.lifecycle,
          raster: effect.raster,
          paused: effect.paused,
          fire: (hash >>> 0).toString(16),
          target: {
            left: targetBounds.left,
            top: targetBounds.top,
            width: targetBounds.width,
            height: targetBounds.height,
          },
          layer: {
            left: layerBounds.left,
            top: layerBounds.top,
            width: layerBounds.width,
            height: layerBounds.height,
          },
        };
      });
  });
}

async function verifyGallery(page: Page, dpr: number) {
  const ids = ['target', 'rounded', 'vector', 'transparent', 'card'];
  await expect(page.locator('canvas[data-gallery-target]')).toHaveCount(5);
  await expect(page.locator('#shared-host > canvas')).toHaveCount(2);
  const initial = await gallerySnapshot(page);
  expect(initial.map(({ id }) => id)).toEqual(ids);
  for (const entry of initial) {
    expect(entry).toMatchObject({ lifecycle: 'active', raster: 'fresh', paused: true });
    expect(entry.alphaPixels, `${entry.id} live fire`).toBeGreaterThan(0);
    expect(Math.abs(entry.layer.left + 32 - entry.target.left)).toBeLessThan(1 / dpr);
    expect(Math.abs(entry.layer.top + 32 - entry.target.top)).toBeLessThan(1 / dpr);
    expect(Math.abs(entry.layer.width - 64 - entry.target.width)).toBeLessThan(1 / dpr);
    const layer = page.locator(`canvas[data-gallery-target="${entry.id}"]`);
    await expect(layer).toHaveAttribute('aria-hidden', 'true');
    await expect(layer).toHaveCSS('pointer-events', 'none');
  }
  const evidence = await page.evaluate(() => Object.keys(window.domfxEvidence?.images ?? {}));
  for (const id of ids) {
    for (const stage of ['capture', 'mask', 'sdf', 'fire', 'live-fire']) {
      expect(evidence).toContain(`${stage}-${id}-dpr${dpr}`);
    }
  }
  // Same-host control writes must leave every other target's actual output unchanged.
  const svg = page.locator('fieldset[data-target="vector"]');
  await svg.getByText('Play / pause', { exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => window.domfxGallery?.entries[2].effect.time ?? 0))
    .toBeGreaterThan(1.5);
  await svg.getByText('Play / pause', { exact: true }).click();
  await svg.getByLabel('Time (seconds)').fill('3');
  await svg.getByLabel('Time (seconds)').press('Tab');
  const sought = await gallerySnapshot(page);
  for (let i = 0; i < initial.length; i++) {
    if (initial[i].id === 'vector') {
      expect(sought[i].fire).not.toBe(initial[i].fire);
    } else {
      expect(sought[i].fire).toBe(initial[i].fire);
    }
  }
  await svg.getByLabel('Intensity').fill('0');
  await svg.getByLabel('Intensity').press('Tab');
  expect((await gallerySnapshot(page))[2].alphaPixels).toBe(0);
  await svg.getByLabel('Time (seconds)').fill('1.5');
  await svg.getByLabel('Time (seconds)').press('Tab');
  await svg.getByLabel('Intensity').fill(String(initial[2].intensity));
  await svg.getByLabel('Intensity').press('Tab');
  expect((await gallerySnapshot(page)).map(({ fire }) => fire)).toEqual(
    initial.map(({ fire }) => fire),
  );

  // Public manual and paused ambient attachments track positive scale and scrolling.
  await page
    .locator('fieldset[data-target="target"]')
    .getByText('Move / scale', { exact: true })
    .click();
  await svg.getByText('Move / scale', { exact: true }).click();
  await page.locator('#shared-host').evaluate((host) => {
    host.scrollLeft = 35;
    host.scrollTop = 20;
  });
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  const moved = await gallerySnapshot(page);
  for (let i = 0; i < moved.length; i++) {
    const entry = moved[i];
    const sx = entry.target.width / initial[i].target.width;
    const sy = entry.target.height / initial[i].target.height;
    expect(Math.abs(entry.layer.left + 32 * sx - entry.target.left)).toBeLessThan(1 / dpr);
    expect(Math.abs(entry.layer.top + 32 * sy - entry.target.top)).toBeLessThan(1 / dpr);
    expect(entry.time).toBe(initial[i].time);
    expect(entry.fire).toBe(initial[i].fire);
  }
  expect(moved[2].target.left).not.toBe(initial[2].target.left);
  expect(moved[3].target.left).not.toBe(initial[3].target.left);
  await page
    .locator('fieldset[data-target="target"]')
    .getByText('Move / scale', { exact: true })
    .click();
  await svg.getByText('Move / scale', { exact: true }).click();
  await page.locator('#shared-host').evaluate((host) => {
    host.scrollLeft = 0;
    host.scrollTop = 0;
  });

  const button = page.locator('fieldset[data-target="rounded"]');
  await button.getByText('Change content', { exact: true }).click();
  await expect(button.locator('output')).toContainText('fresh');
  const refreshed = await gallerySnapshot(page);
  expect(refreshed[1].fire).not.toBe(initial[1].fire);
  expect(refreshed[2].fire).toBe(initial[2].fire);
  await button.getByText('Change content', { exact: true }).click();
  await expect.poll(async () => (await gallerySnapshot(page))[1].fire).toBe(initial[1].fire);

  // Cover either shared owner being removed; repeatability proves the survivor still renders.
  const disposedId = dpr === 1 ? 'vector' : 'transparent';
  await page
    .locator(`fieldset[data-target="${disposedId}"]`)
    .getByText('Dispose', { exact: true })
    .click();
  await expect(page.locator('#shared-host > canvas')).toHaveCount(1);
  for (const entry of await gallerySnapshot(page)) {
    expect(entry.fire).toBe(initial.find(({ id }) => id === entry.id)?.fire);
    expect(entry.alphaPixels).toBeGreaterThan(0);
  }
  await page.locator('fieldset[data-target="card"]').getByText('Dispose', { exact: true }).click();
  for (const entry of await gallerySnapshot(page)) {
    expect(entry.fire).toBe(initial.find(({ id }) => id === entry.id)?.fire);
  }
  return { initial, moved, refreshed, disposedId, pass: true };
}

for (const dpr of [1, 2]) {
  test.describe(`capture fidelity at DPR ${dpr}`, () => {
    test.use({ deviceScaleFactor: dpr });
    test('capture, GPU numerics, fire, controls and disposal', async ({
      page,
      browserErrors,
    }, testInfo) => {
      await page.goto('/?automation');
      const report = await terminalReport(page);
      expect(report).toMatchObject({
        outcome: 'PASS: capture, GPU signed distances and deterministic GPU fire',
        environment: {
          build: testInfo.project.name === 'development' ? 'Vite development' : 'Vite production',
          devicePixelRatio: dpr,
          gpu: expect.any(Object),
        },
        numericalFixtures: {
          ring: { pass: true },
          islands: { pass: true },
          diagonal: { pass: true },
          semitransparent: { pass: true },
          'opaque-exterior': { pass: true },
          empty: { pass: true, reason: 'empty-mask' },
          'full-without-exterior': { pass: true, reason: 'missing-exterior' },
        },
        captures: Object.fromEntries(
          ['rounded', 'vector', 'transparent', 'card', 'guard', 'transformed', 'target'].map(
            (id) => [
              id,
              {
                dpr,
                numerical: { pass: true },
                omittedPaintPixels: 0,
                capturedBoundaryMaxAlpha: 0,
                referenceBoundaryMaxAlpha: 0,
              },
            ],
          ),
        ),
        transformCapture: { pass: true },
        preparationResources: {
          pass: true,
          cycles: 1000,
          wrongSigns: 0,
          afterCycles: { managedBytes: 0, bufferBytes: 0 },
          afterServiceDestroy: { managedBytes: 0, bufferBytes: 0 },
        },
        fire: { pass: true, zeroIntensityTransparent: true },
        gsap: { pass: true, contextRevertPreservesSibling: true },
        gpuErrors: [],
      });
      const overlay = page.locator('#host canvas.effect');
      await expect(overlay).toBeVisible();
      await expect(overlay).toHaveAttribute('aria-hidden', 'true');
      await expect(overlay).toHaveCSS('pointer-events', 'none');
      await expect(page.getByRole('heading', { name: 'B8O 2026' })).toBeVisible();
      await testInfo.attach('verified-lab.png', {
        body: await page.screenshot(),
        contentType: 'image/png',
      });

      const galleryChecks = await verifyGallery(page, dpr);
      await testInfo.attach('gallery-checks.json', {
        body: JSON.stringify(galleryChecks, null, 2),
        contentType: 'application/json',
      });
      await page.getByRole('button', { name: 'Play', exact: true }).click();
      await expect.poll(() => clockTime(page)).toBeGreaterThan(1.5);
      await page.getByRole('button', { name: 'Seek 1.5s' }).click();
      await expect.poll(() => clockTime(page)).toBe(1.5);
      await page.getByRole('button', { name: 'Reverse', exact: true }).click();
      await expect.poll(() => clockTime(page)).toBeGreaterThan(1.5);
      const reverseStart = await clockTime(page);
      await expect.poll(() => clockTime(page)).toBeLessThan(reverseStart);
      await page.getByRole('button', { name: 'Seek 1.5s' }).click();
      await expect.poll(() => clockTime(page)).toBe(1.5);

      const rounded = page.getByRole('button', { name: 'Rounded button' });
      await rounded.click();
      await rounded.press('Enter');
      await expect(page.locator('#interaction')).toHaveText('Rounded button clicks: 2');
      await page
        .locator('fieldset[data-target="target"]')
        .getByText('Dispose', { exact: true })
        .click();
      for (const name of ['Play', 'Seek 1.5s', 'Reverse']) {
        await expect(page.getByRole('button', { name, exact: true })).toBeDisabled();
      }
      await page.getByRole('button', { name: 'Dispose all effects' }).click();
      await expect(overlay).toHaveCount(0);
      await expect(page.locator('canvas[data-gallery-target]')).toHaveCount(0);
      for (const name of ['Play', 'Seek 1.5s', 'Reverse', 'Dispose all effects']) {
        await expect(page.getByRole('button', { name, exact: true })).toBeDisabled();
      }
      expect(await terminalReport(page)).toMatchObject({
        disposal: { managedBytes: 0, attachmentReservedBytes: 0, overlayRemoved: true },
        gpuErrors: [],
      });
      await rounded.click();
      await expect(page.locator('#interaction')).toHaveText('Rounded button clicks: 3');
      expect(browserErrors).toEqual([]);
    });
  });
}

test('reduced motion avoids GPU allocation and preserves interaction', async ({
  page,
  browserErrors,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'gpu', {
      get() {
        throw new Error('GPU accessed with reduced motion enabled');
      },
    });
  });
  await page.goto('/');
  expect(await terminalReport(page)).toMatchObject({
    outcome: 'UNAVAILABLE: reduced-motion before capture/GPU allocation',
  });
  await expect(page.locator('#host canvas.effect')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Rounded button' }).click();
  await expect(page.locator('#interaction')).toHaveText('Rounded button clicks: 1');
  expect(browserErrors).toEqual([]);
});

test('missing WebGPU is explicitly unavailable with usable original DOM', async ({
  page,
  browserErrors,
}) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
  await page.goto('/');
  expect(await terminalReport(page)).toMatchObject({
    outcome: 'UNAVAILABLE: no GPU',
    error: expect.stringContaining('no-webgpu'),
  });
  await expect(page.locator('#host canvas.effect')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Rounded button' }).click();
  await expect(page.locator('#interaction')).toHaveText('Rounded button clicks: 1');
  expect(browserErrors).toEqual([expect.stringContaining('no-webgpu')]);
});

test('injected assertion fails after completing GPU fixtures', async ({ page, browserErrors }) => {
  await page.goto('/?automation&inject-failure');
  expect(await terminalReport(page)).toMatchObject({
    outcome: 'FAIL',
    error: expect.stringContaining('injected assertion failure'),
    fire: { pass: true },
    gsap: { pass: true },
    gpuErrors: [],
  });
  await expect(page.locator('#host canvas.effect')).toHaveCount(0);
  expect(browserErrors).toEqual([expect.stringContaining('injected assertion failure')]);
});

test('missing overflow paint fails even when padded capture and reference agree', async ({
  page,
  browserErrors,
}) => {
  await page.addInitScript(() => {
    const read = CanvasRenderingContext2D.prototype.getImageData;
    CanvasRenderingContext2D.prototype.getImageData = function (...args: Parameters<typeof read>) {
      const result = read.apply(this, args);
      // Simulate a capture backend dropping the required cyan overflow from both
      // rasters. Transparent padding and agreement alone must never pass the gate.
      for (let i = 0; i < result.data.length; i += 4) {
        if (result.data[i] === 0 && result.data[i + 1] === 255 && result.data[i + 2] === 255) {
          result.data.fill(0, i, i + 4);
        }
      }
      return result;
    };
  });
  await page.goto('/?automation');
  expect(await terminalReport(page)).toMatchObject({
    outcome: 'FAIL',
    error: expect.stringContaining('overflow sentinel missing'),
  });
  await expect(page.locator('#host canvas.effect')).toHaveCount(0);
  expect(browserErrors).toEqual([expect.stringContaining('overflow sentinel missing')]);
});

test('paint outside requested padding holds the capture gate', async ({ page, browserErrors }) => {
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const marker = document.querySelector<HTMLElement>('#guard .overflow-mark');
      if (marker) {
        marker.style.left = '-60px';
      }
    });
  });
  await page.goto('/?automation');
  expect(await terminalReport(page)).toMatchObject({
    outcome: 'FAIL',
    error: expect.stringContaining('capture exterior failed for guard'),
  });
  await expect(page.locator('#host canvas.effect')).toHaveCount(0);
  expect(browserErrors).toEqual([expect.stringContaining('capture exterior failed for guard')]);
});

test('a required live SVG failure holds the gate and retains its capture evidence', async ({
  page,
  browserErrors,
}) => {
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (...args) {
      if (
        args[0] === 'webgpu' &&
        this.width === 164 * devicePixelRatio &&
        this.height === 134 * devicePixelRatio
      ) {
        return null;
      }
      return Reflect.apply(getContext, this, args);
    };
  });
  await page.goto('/?automation');
  expect(await terminalReport(page)).toMatchObject({
    outcome: 'FAIL',
    error: expect.stringContaining('required live fixture vector'),
    captures: { vector: { numerical: { pass: true } } },
  });
  await expect(page.locator('canvas[data-gallery-target], #shared-host canvas')).toHaveCount(0);
  await expect(page.locator('#vector')).toBeVisible();
  const images = await page.evaluate(() => Object.keys(window.domfxEvidence?.images ?? {}));
  for (const stage of ['capture', 'mask', 'sdf', 'fire']) {
    expect(images).toContain(`${stage}-vector-dpr2`);
  }
  expect(browserErrors).toEqual([expect.stringContaining('required live fixture vector')]);
});
