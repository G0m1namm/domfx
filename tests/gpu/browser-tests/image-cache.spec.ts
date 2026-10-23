import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';

import { expect, test } from '@playwright/test';

import type {} from '../src/assets.js';

const body = await readFile(new URL('../public/asset-fixtures/split.png', import.meta.url));

for (const kind of ['image', 'background'] as const) {
  test(`unchanged fresh ${kind} reuses validated image data`, async ({ page }) => {
    let fetches = 0;
    await page.route('**/reusable.png', (route) => {
      if (route.request().resourceType() === 'fetch') {
        fetches += 1;
      }
      return route.fulfill({
        body,
        contentType: 'image/png',
        headers: { 'Cache-Control': 'max-age=60' },
      });
    });
    await page.goto('/assets.html');
    const result = await page.evaluate(async (kind) => {
      window.assets.setup(kind, '/reusable.png');
      const first = await window.assets.capture();
      const pixels = document.querySelector<HTMLCanvasElement>('#frame')!.toDataURL();
      const second = await window.assets.capture();
      return {
        first,
        second,
        same: pixels === document.querySelector<HTMLCanvasElement>('#frame')!.toDataURL(),
      };
    }, kind);
    expect(result.first.code).toBe('ready');
    expect(result.second.code).toBe('ready');
    expect(result.same).toBe(true);
    expect(fetches).toBe(1);
  });
}

for (const cacheControl of ['', 'no-store', 'no-cache, max-age=60', 'max-age=0']) {
  test(`requires validation for Cache-Control ${cacheControl || 'absent'}`, async ({ page }) => {
    let fetches = 0;
    await page.route('**/mutable.png', (route) => {
      if (route.request().resourceType() === 'fetch') {
        fetches += 1;
      }
      return route.fulfill({
        body,
        contentType: 'image/png',
        headers: { 'Cache-Control': cacheControl },
      });
    });
    await page.goto('/assets.html');
    await page.evaluate(async () => {
      window.assets.setup('background', '/mutable.png');
      await window.assets.capture();
      await window.assets.capture();
    });
    expect(fetches).toBe(2);
  });
}

test('same URL image reload and source attributes invalidate fresh data', async ({ page }) => {
  let fetches = 0;
  let imageBody = body;
  await page.route('**/source*.png', (route) => {
    if (route.request().resourceType() === 'fetch') {
      fetches += 1;
    }
    return route.fulfill({
      body: imageBody,
      contentType: 'image/png',
      headers: { 'Cache-Control': 'max-age=60' },
    });
  });
  await page.goto('/assets.html');
  await page.evaluate(async () => {
    window.assets.setup('image', '/source.png');
    await window.assets.capture();
  });
  const first = await page.locator('#frame').screenshot();
  imageBody = Buffer.from(
    await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 40;
      const context = canvas.getContext('2d')!;
      context.fillStyle = 'lime';
      context.fillRect(0, 0, 40, 40);
      return canvas.toDataURL().split(',')[1]!;
    }),
    'base64',
  );
  expect(
    await page.evaluate(async () => {
      const image = document.querySelector('img')!;
      image.setAttribute('src', image.src);
      await image.decode();
      return (await window.assets.capture()).code;
    }),
  ).toBe('ready');
  expect(await page.locator('#frame').screenshot()).not.toEqual(first);
  const codes = await page.evaluate(async () => {
    const image = document.querySelector('img')!;
    image.srcset = '/source2.png 2x';
    image.sizes = '40px';
    await image.decode();
    const codes = [(await window.assets.capture()).code];
    image.removeAttribute('srcset');
    image.src = '/source3.png';
    await image.decode();
    codes.push((await window.assets.capture()).code);
    return codes;
  });
  expect(codes).toEqual(['ready', 'ready']);
  expect(fetches).toBe(4);
});

test('expiry observes changed same URL paint and later HTTP failures', async ({ page }) => {
  await page.clock.install();
  let fetches = 0;
  const replacement: { body?: Buffer } = {};
  let failed = false;
  await page.route('**/expiring.png', (route) => {
    if (route.request().resourceType() === 'fetch') {
      fetches += 1;
    }
    return route.fulfill({
      status: failed ? 503 : 200,
      body: replacement.body ?? body,
      contentType: 'image/png',
      headers: { 'Cache-Control': 'max-age=1' },
    });
  });
  await page.goto('/assets.html');
  await page.evaluate(async () => {
    window.assets.setup('background', '/expiring.png');
    await window.assets.capture();
  });
  const first = await page.locator('#frame').screenshot();
  replacement.body = Buffer.from(
    await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 40;
      const context = canvas.getContext('2d')!;
      context.fillStyle = 'lime';
      context.fillRect(0, 0, 40, 40);
      return canvas.toDataURL().split(',')[1]!;
    }),
    'base64',
  );
  await page.clock.fastForward(1_100);
  expect((await page.evaluate(() => window.assets.capture())).code).toBe('ready');
  expect(await page.locator('#frame').screenshot()).not.toEqual(first);
  failed = true;
  await page.clock.fastForward(1_100);
  expect((await page.evaluate(() => window.assets.capture())).code).toBe('asset-fetch-failed');
  expect(fetches).toBe(3);
});

test('entry eviction and expiry require fresh validation', async ({ page }) => {
  await page.clock.install();
  let fetches = 0;
  await page.route('**/bounded*.png', (route) => {
    if (route.request().resourceType() === 'fetch') {
      fetches += 1;
    }
    return route.fulfill({
      body,
      contentType: 'image/png',
      headers: { 'Cache-Control': 'max-age=600' },
    });
  });
  await page.goto('/assets.html');
  const codes = await page.evaluate(async () => {
    const target = document.querySelector<HTMLElement>('#target')!;
    const codes = [];
    for (let index = 0; index < 33; index += 1) {
      target.style.backgroundImage = `url("/bounded${index}.png")`;
      codes.push((await window.assets.capture()).code);
    }
    target.style.backgroundImage = 'url("/bounded0.png")';
    codes.push((await window.assets.capture()).code);
    return codes;
  });
  expect(codes.every((code) => code === 'ready')).toBe(true);
  expect(fetches).toBe(34);
  await page.clock.fastForward(600_001);
  expect((await page.evaluate(() => window.assets.capture())).code).toBe('ready');
  expect(fetches).toBe(35);
});

test('failed decode is never reusable after repair', async ({ page }) => {
  let broken = true;
  let fetches = 0;
  await page.route('**/repair.png', (route) => {
    if (route.request().resourceType() === 'fetch') {
      fetches += 1;
    }
    return route.fulfill({
      body: broken ? Buffer.from('broken') : body,
      contentType: 'image/png',
      headers: { 'Cache-Control': 'max-age=60' },
    });
  });
  await page.goto('/assets.html');
  await page.evaluate(() => window.assets.setup('background', '/repair.png'));
  expect((await page.evaluate(() => window.assets.capture())).code).toBe('image-load-failed');
  broken = false;
  expect((await page.evaluate(() => window.assets.capture())).code).toBe('ready');
  expect((await page.evaluate(() => window.assets.capture())).code).toBe('ready');
  expect(fetches).toBe(2);
});

const uncachedHeaders: Record<string, string>[] = [
  { 'Cache-Control': 'max-age=60', Age: '60' },
  { 'Cache-Control': 'max-age=60', Vary: 'Cookie' },
];
for (const headers of uncachedHeaders) {
  test(`does not reuse expired or varying response ${JSON.stringify(headers)}`, async ({
    page,
  }) => {
    let fetches = 0;
    await page.route('**/uncertain.png', (route) => {
      if (route.request().resourceType() === 'fetch') {
        fetches += 1;
      }
      return route.fulfill({ body, contentType: 'image/png', headers });
    });
    await page.goto('/assets.html');
    await page.evaluate(async () => {
      window.assets.setup('background', '/uncertain.png');
      await window.assets.capture();
      await window.assets.capture();
    });
    expect(fetches).toBe(2);
  });
}

test('oversized embedded image is validated but never retained', async ({ page }) => {
  let fetches = 0;
  // PNG decoders permit trailing bytes; the retained data URL exceeds the byte bound.
  const large = Buffer.concat([body, Buffer.alloc(4 * 1024 * 1024)]);
  await page.route('**/oversized.png', (route) => {
    if (route.request().resourceType() === 'fetch') {
      fetches += 1;
    }
    return route.fulfill({
      body: large,
      contentType: 'image/png',
      headers: { 'Cache-Control': 'max-age=60' },
    });
  });
  await page.goto('/assets.html');
  const codes = await page.evaluate(async () => {
    window.assets.setup('background', '/oversized.png');
    return [(await window.assets.capture()).code, (await window.assets.capture()).code];
  });
  expect(codes).toEqual(['ready', 'ready']);
  expect(fetches).toBe(2);
});

for (const cors of [true, false]) {
  test(`fresh cross-origin image preserves CORS ${cors}`, async ({ page }) => {
    const server = createServer((_request, response) => {
      response.setHeader('Content-Type', 'image/png');
      response.setHeader('Cache-Control', 'max-age=60');
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
      const codes = await page.evaluate(async (port) => {
        window.assets.setup('image', `http://127.0.0.1:${port}/image.png`);
        return [(await window.assets.capture()).code, (await window.assets.capture()).code];
      }, address.port);
      expect(codes).toEqual(
        cors ? ['ready', 'ready'] : ['asset-fetch-failed', 'asset-fetch-failed'],
      );
      expect(await page.locator('#target img').count()).toBe(1);
      expect(await page.locator('#snapdom-sandbox').count()).toBe(0);
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });
}
