import { readFile } from 'node:fs/promises';

import { expect, test } from '@playwright/test';

import type {} from '../src/assets.js';

for (const location of ['imported', 'nested', 'unreadable'] as const) {
  test(`${location} same-descriptor faces keep fresh font discovery on repeated captures`, async ({
    page,
  }) => {
    const font = await readFile(new URL('../public/asset-fixtures/block.ttf', import.meta.url));
    // Make a B-only variant: AB needs both same-descriptor faces in the cascade.
    const narrow = Buffer.from(font);
    let head = 0;
    for (let table = 12; table < 12 + narrow.readUInt16BE(4) * 16; table += 16) {
      const tag = narrow.toString('ascii', table, table + 4);
      const offset = narrow.readUInt32BE(table + 8);
      if (tag === 'head') {
        head = offset;
      }
      if (tag === 'hmtx') {
        narrow.writeUInt16BE(500, offset); // block.ttf shares one advance across its glyphs.
      }
      if (tag === 'cmap') {
        const subtable = offset + narrow.readUInt32BE(offset + 8);
        // block.ttf has one shared format-4 subtable: space, A, sentinel.
        narrow.writeUInt16BE(66, subtable + 16);
        narrow.writeUInt16BE(66, subtable + 24);
        narrow.writeInt16BE(2 - 66, subtable + 30);
      }
      if (tag === 'hmtx' || tag === 'cmap') {
        const length = narrow.readUInt32BE(table + 12);
        let checksum = 0;
        for (let word = offset; word < offset + length; word += 4) {
          checksum = (checksum + narrow.readUInt32BE(word)) >>> 0;
        }
        narrow.writeUInt32BE(checksum, table + 4);
      }
    }
    narrow.writeUInt32BE(0, head + 8);
    let checksum = 0;
    for (let word = 0; word < narrow.length; word += 4) {
      checksum = (checksum + narrow.readUInt32BE(word)) >>> 0;
    }
    narrow.writeUInt32BE((0xb1b0afba - checksum) >>> 0, head + 8);
    await page.route('**/cascade-*.ttf', (route) =>
      route.fulfill({
        body: route.request().url().endsWith('primary.ttf') ? font : narrow,
        contentType: 'font/ttf',
        headers: { 'Access-Control-Allow-Origin': '*' },
      }),
    );
    const secondary =
      '@font-face { font-family: "Asset Fixture"; src: url("/cascade-secondary.ttf"); }';
    const stylesheet =
      location === 'unreadable' ? 'http://font-cache.invalid/faces.css' : '/cascade-faces.css';
    await page.route(stylesheet, (route) =>
      route.fulfill({
        body: secondary,
        contentType: 'text/css',
        headers: { 'Access-Control-Allow-Origin': '*' },
      }),
    );
    await page.goto('/assets.html');
    const baseline = await page.evaluate(async () => {
      window.assets.setup('font', '/cascade-primary.ttf');
      document.querySelector('#target')!.textContent = 'AB';
      await window.assets.capture();
      return document.querySelector<HTMLCanvasElement>('#frame')!.toDataURL();
    });
    await page.evaluate(
      async ({ location, secondary, stylesheet }) => {
        if (location === 'unreadable') {
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = stylesheet;
          const loaded = new Promise<void>((resolve) => {
            link.onload = () => resolve();
          });
          document.head.append(link);
          await loaded;
        } else {
          const style = document.createElement('style');
          style.textContent =
            location === 'imported'
              ? `@import url("${stylesheet}");`
              : `@media all { ${secondary} }`;
          const loaded = new Promise<void>((resolve) => {
            style.onload = () => resolve();
          });
          document.head.append(style);
          if (location === 'imported') {
            await loaded;
          }
        }
        await document.fonts.load('40px "Asset Fixture"', 'AB');
      },
      { location, secondary, stylesheet },
    );
    const requests: string[] = [];
    page.on('request', (request) => {
      if (request.url().endsWith('.ttf') && request.resourceType() === 'fetch') {
        requests.push(request.url());
      }
    });
    const frames: string[] = [];
    for (let capture = 0; capture < 2; capture += 1) {
      const before = requests.length;
      const result = await page.evaluate(async () => {
        const result = await window.assets.capture();
        return {
          result,
          frame: document.querySelector<HTMLCanvasElement>('#frame')!.toDataURL(),
          temporary: document.querySelectorAll('#snapdom-sandbox, [data-snapdom-internal]').length,
        };
      });
      expect(result.result).toEqual({ code: 'ready', released: true });
      expect(result.temporary).toBe(0);
      frames.push(result.frame);
      if (location === 'imported') {
        expect(result.frame !== baseline).toBe(true);
      }
      expect(result.frame === frames[0]).toBe(true);
      expect(requests.length).toBeGreaterThan(before);
    }
    expect(frames[0]).toBe(frames[1]);
  });
}
