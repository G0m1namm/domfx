import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';

import { expect, test } from '@playwright/test';

import type {} from '../src/assets.js';

for (const kind of ['image', 'background', 'font'] as const) {
  test(`delayed ${kind} waits and matches visible target paint`, async ({
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
    const file = kind === 'font' ? 'block.ttf' : 'split.png';
    const body = await readFile(new URL(`../public/asset-fixtures/${file}`, import.meta.url));
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let requested!: () => void;
    const request = new Promise<void>((resolve) => {
      requested = resolve;
    });
    await page.route(`**/delayed-${file}`, async (route) => {
      requested();
      await gate;
      await route.fulfill({ body, contentType: kind === 'font' ? 'font/ttf' : 'image/png' });
    });
    await page.goto('/assets.html');
    await page.evaluate(
      ({ kind, file }) => {
        window.assets.setup(kind, `/delayed-${file}`);
        void window.assets.capture();
      },
      { kind, file },
    );
    await request;
    await page.waitForTimeout(150);
    expect(await page.evaluate(() => window.assets.result)).toBeUndefined();
    release();
    await expect(page.locator('#state')).toContainText('"code":"ready"');
    const target = await page.locator('#target').screenshot();
    const frame = await page.locator('#frame').screenshot();
    await testInfo.attach(`${kind}-target.png`, { body: target, contentType: 'image/png' });
    await testInfo.attach(`${kind}-frame.png`, { body: frame, contentType: 'image/png' });
    // Decode both PNGs in the browser and compare actual visible paint to returned RGBA.
    const comparison = await page.evaluate(
      async ({ target, frame }) => {
        async function pixels(base64: string) {
          const image = new Image();
          image.src = `data:image/png;base64,${base64}`;
          await image.decode();
          const canvas = document.createElement('canvas');
          canvas.width = image.width;
          canvas.height = image.height;
          const context = canvas.getContext('2d')!;
          context.drawImage(image, 0, 0);
          const pixels = context.getImageData(0, 0, image.width, image.height).data;
          canvas.width = canvas.height = 0;
          return pixels;
        }
        const a = await pixels(target);
        const b = await pixels(frame);
        let different = 0;
        let nonWhite = 0;
        for (let i = 0; i < a.length; i += 4) {
          if (
            Math.max(
              Math.abs(a[i]! - b[i]!),
              Math.abs(a[i + 1]! - b[i + 1]!),
              Math.abs(a[i + 2]! - b[i + 2]!),
            ) > 8
          ) {
            different += 1;
          }
          if (Math.min(a[i]!, a[i + 1]!, a[i + 2]!) < 240) {
            nonWhite += 1;
          }
        }
        return {
          sameSize: a.length === b.length,
          different,
          nonWhite,
          released: window.assets.result?.released,
        };
      },
      { target: target.toString('base64'), frame: frame.toString('base64') },
    );
    expect(comparison.sameSize).toBe(true);
    expect(comparison.different).toBeLessThan(100); // Only edge antialiasing tolerance.
    expect(comparison.nonWhite).toBeGreaterThan(2000);
    expect(comparison.released).toBe(true);
    expect(errors).toEqual([]);
    await testInfo.attach('asset-result.json', {
      body: JSON.stringify({ browser: browser.version(), dpr: 2, kind, ...comparison }),
      contentType: 'application/json',
    });
  });
}

for (const [kind, response, code] of [
  ['image', 'broken', 'image-load-failed'],
  ['background', 'broken', 'image-load-failed'],
  ['font', 'broken', 'font-load-failed'],
  ['image', 'svg', 'unsupported-asset'],
] as const) {
  test(`${kind} ${response} fails explicitly and preserves DOM`, async ({ page }, testInfo) => {
    await page.route('**/failed-asset', (route) =>
      route.fulfill({
        body:
          response === 'svg'
            ? '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="red"/></svg>'
            : 'broken bytes',
        contentType:
          response === 'svg' ? 'image/svg+xml' : kind === 'font' ? 'font/ttf' : 'image/png',
      }),
    );
    await page.goto('/assets.html');
    const result = await page.evaluate(async (kind) => {
      window.assets.setup(kind, '/failed-asset');
      const original = document.querySelector('#target')!.outerHTML;
      const result = await window.assets.capture();
      return {
        result,
        preserved: original === document.querySelector('#target')!.outerHTML,
        temporary: document.querySelectorAll('#snapdom-sandbox, [data-snapdom-internal]').length,
      };
    }, kind);
    expect(result).toEqual({
      result: { code, asset: expect.any(String) },
      preserved: true,
      temporary: 0,
    });
    await page.locator('#target').click();
    await page.locator('#target').press('Enter');
    expect(await page.evaluate(() => window.assets.clicks)).toBe(2);
    await testInfo.attach('asset-failure.json', {
      body: JSON.stringify(result),
      contentType: 'application/json',
    });
  });
}

test('a loaded programmatic font without an embeddable source rejects and cleans the sandbox', async ({
  page,
}) => {
  await page.goto('/assets.html');
  const result = await page.evaluate(async () => {
    const bytes = await (await fetch('/asset-fixtures/block.ttf')).arrayBuffer();
    const font = new FontFace('Programmatic Fixture', bytes);
    await font.load();
    document.fonts.add(font);
    const target = document.querySelector<HTMLElement>('#target')!;
    target.textContent = 'AA';
    target.style.fontFamily = '"Programmatic Fixture"';
    const result = await window.assets.capture();
    return {
      result,
      temporary: document.querySelectorAll('#snapdom-sandbox, [data-snapdom-internal]').length,
    };
  });
  expect(result.result.code).toBe('font-embed-failed');
  expect(result.temporary).toBe(0);
});

for (const kind of ['image', 'font'] as const) {
  test(`initial attachment waits for ${kind} readiness; later font and asset signals hide stale output`, async ({
    page,
  }) => {
    const file = kind === 'font' ? 'block.ttf' : 'split.png';
    const body = await readFile(new URL(`../public/asset-fixtures/${file}`, import.meta.url));
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route('**/attachment-image', async (route) => {
      await gate;
      await route.fulfill({ body, contentType: kind === 'font' ? 'font/ttf' : 'image/png' });
    });
    await page.goto('/assets.html');
    await page.evaluate((kind) => {
      window.assets.setup(kind, '/attachment-image');
      void window.assets.attach();
    }, kind);
    await page.waitForTimeout(150);
    expect(await page.evaluate(() => window.assets.effect?.lifecycle)).toBe('suspended');
    release();
    await expect.poll(() => page.evaluate(() => window.assets.effect?.lifecycle)).toBe('active');
    await page.evaluate(() => document.fonts.dispatchEvent(new Event('loadingdone')));
    expect(await page.evaluate(() => window.assets.effect?.raster)).toBe('stale');
    await expect(page.locator('#host canvas')).toBeHidden();
    await page.evaluate(() => window.assets.effect?.refresh());
    await page.evaluate(() => document.querySelector('#target')!.dispatchEvent(new Event('error')));
    expect(await page.evaluate(() => window.assets.effect?.raster)).toBe('stale');
    await page.evaluate(() => window.assets.effect?.dispose());
    await expect(page.locator('#host canvas')).toHaveCount(0);
  });
}

for (const cors of [false, true]) {
  test(`cross-origin image with CORS ${cors ? 'enabled captures' : 'denied rejects'}`, async ({
    page,
  }, testInfo) => {
    const body = await readFile(new URL('../public/asset-fixtures/split.png', import.meta.url));
    const cookies: string[] = [];
    const server = createServer((request, response) => {
      if (request.headers['sec-fetch-mode'] === 'cors') {
        cookies.push(request.headers.cookie ?? '');
      }
      response.setHeader('Content-Type', 'image/png');
      if (cors) {
        response.setHeader('Access-Control-Allow-Origin', '*');
      }
      response.end(body);
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    try {
      const address = server.address();
      if (!address || typeof address === 'string') {
        throw new Error('fixture server');
      }
      await page.goto('/assets.html');
      const result = await page.evaluate(async (port) => {
        document.cookie = 'asset-fixture=ordinary-page-cookie; SameSite=Lax';
        window.assets.setup('image', `http://127.0.0.1:${port}/image.png`);
        const image = document.querySelector('img')!;
        await image.decode();
        const result = await window.assets.capture();
        return {
          result,
          sourceLoaded: image.naturalWidth === 40,
          temporary: document.querySelectorAll('#snapdom-sandbox, [data-snapdom-internal]').length,
        };
      }, address.port);
      expect(result.result.code).toBe(cors ? 'ready' : 'asset-fetch-failed');
      expect(result.sourceLoaded).toBe(true);
      expect(result.temporary).toBe(0);
      expect(cookies).toEqual(['']);
      await page.locator('#target').click();
      await page.locator('#target').press('Enter');
      expect(await page.evaluate(() => window.assets.clicks)).toBe(2);
      await testInfo.attach('cross-origin.json', {
        body: JSON.stringify({ cors, ...result }),
        contentType: 'application/json',
      });
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });
}

for (const stage of ['decode', 'readback'] as const) {
  test(`snapshot ${stage} failure releases temporary canvas storage`, async ({ page }) => {
    await page.goto('/assets.html');
    const result = await page.evaluate(async (stage) => {
      const canvases: HTMLCanvasElement[] = [];
      const create = document.createElement.bind(document);
      document.createElement = function (...args: Parameters<typeof create>) {
        const element = create(...args);
        if (element instanceof HTMLCanvasElement) {
          canvases.push(element);
        }
        return element;
      };
      const decode = HTMLImageElement.prototype.decode;
      const read = CanvasRenderingContext2D.prototype.getImageData;
      if (stage === 'decode') {
        HTMLImageElement.prototype.decode = async () => {
          throw new Error('injected decode');
        };
      } else {
        CanvasRenderingContext2D.prototype.getImageData = () => {
          throw new DOMException('injected taint', 'SecurityError');
        };
      }
      try {
        const result = await window.assets.capture();
        return {
          code: result.code,
          created: canvases.length,
          cleared: canvases.every((canvas) => canvas.width === 0 && canvas.height === 0),
        };
      } finally {
        document.createElement = create;
        HTMLImageElement.prototype.decode = decode;
        CanvasRenderingContext2D.prototype.getImageData = read;
      }
    }, stage);
    expect(result).toEqual({
      code: stage === 'decode' ? 'capture-decode-failed' : 'capture-readback-failed',
      created: 1,
      cleared: true,
    });
  });
}

test('font signals after readiness invalidate pending capture without late output', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const decode = HTMLImageElement.prototype.decode;
    HTMLImageElement.prototype.decode = async function () {
      await decode.call(this);
      if (this.src.startsWith('data:image/svg+xml')) {
        document.documentElement.dataset.waitingSnapshot = 'true';
        await new Promise<void>((resolve) =>
          document.addEventListener('release-snapshot', () => resolve(), { once: true }),
        );
      }
    };
  });
  await page.goto('/assets.html');
  await page.evaluate(() => {
    void window.assets.attach();
  });
  await expect(page.locator('html')).toHaveAttribute('data-waiting-snapshot', 'true');
  await page.evaluate(() => document.fonts.dispatchEvent(new Event('loadingdone')));
  expect(await page.evaluate(() => window.assets.effect?.raster)).toBe('stale');
  await page.evaluate(async () => {
    document.dispatchEvent(new Event('release-snapshot'));
    await window.assets.effect?.ready;
  });
  expect(await page.evaluate(() => window.assets.effect?.lifecycle)).toBe('suspended');
  await expect(page.locator('#host canvas')).toHaveCount(0);
  await page.evaluate(() => window.assets.effect?.dispose());
});

test('failed attachment releases its claim and a repaired image can explicitly reattach', async ({
  page,
}) => {
  await page.route('**/broken-image', (route) =>
    route.fulfill({ body: 'broken', contentType: 'image/png' }),
  );
  await page.goto('/assets.html');
  const failure = await page.evaluate(async () => {
    window.assets.setup('image', '/broken-image');
    await window.assets.attach();
    return {
      lifecycle: window.assets.effect?.lifecycle,
      reason: window.assets.effect?.reason,
      detail: window.assets.effect?.reasonDetail,
    };
  });
  expect(failure.lifecycle).toBe('unavailable');
  expect(failure.reason).toBe('capture-failed');
  expect(failure.detail).toContain('image-load-failed');
  await expect(page.locator('#host canvas')).toHaveCount(0);
  await page.locator('#target').click();
  await page.locator('#target').press('Enter');
  expect(await page.evaluate(() => window.assets.clicks)).toBe(2);
  const lifecycle = await page.evaluate(async () => {
    const failed = window.assets.effect;
    const image = document.querySelector('img')!;
    image.src = '/asset-fixtures/split.png';
    await image.decode();
    document.querySelector<HTMLElement>('#target')!.blur();
    await window.assets.attach();
    failed?.dispose();
    const lifecycle = window.assets.effect?.lifecycle;
    window.assets.effect?.dispose();
    return lifecycle;
  });
  expect(lifecycle).toBe('active');
  await expect(page.locator('#host canvas')).toHaveCount(0);
});

test('a stalled image times out without changing the target', async ({ page }) => {
  await page.clock.install();
  await page.route('**/stalled-image', () => {});
  await page.goto('/assets.html');
  await page.evaluate(() => {
    window.assets.setup('image', '/stalled-image');
    void window.assets.capture();
  });
  await page.clock.fastForward(10_001);
  await expect(page.locator('#state')).toContainText('asset-timeout');
  await expect(page.locator('#target img')).toHaveAttribute('src', '/stalled-image');
  await expect(page.locator('#snapdom-sandbox')).toHaveCount(0);
});

test('image inputs and SVG filter images reject instead of omitting their external paint', async ({
  page,
}) => {
  await page.goto('/assets.html');
  const result = await page.evaluate(async () => {
    const target = document.querySelector('#target')!;
    const input = document.createElement('input');
    input.type = 'image';
    input.src = '/asset-fixtures/split.png';
    target.append(input);
    const imageInput = await window.assets.capture();
    target.innerHTML =
      '<svg width="40" height="40"><defs><filter id="asset-filter"><feImage href="/asset-fixtures/split.png" /></filter></defs><rect width="40" height="40" filter="url(#asset-filter)" /></svg>';
    const filterImage = await window.assets.capture();
    return { imageInput: imageInput.code, filterImage: filterImage.code };
  });
  expect(result).toEqual({ imageInput: 'unsupported-asset', filterImage: 'unsupported-asset' });
});
