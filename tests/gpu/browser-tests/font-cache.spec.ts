import { readFile } from 'node:fs/promises';

import { expect, test } from '@playwright/test';

import type {} from '../src/assets.js';

for (const location of ['top-level', 'imported', 'nested', 'unreadable'] as const) {
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
          style.textContent = secondary;
          if (location === 'imported') {
            style.textContent = `@import url("${stylesheet}");`;
          } else if (location === 'nested') {
            style.textContent = `@media all { ${secondary} }`;
          }
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

test('cold and warm captures match font declarations with linear work', async ({ page }) => {
  await page.goto('/assets.html');
  const result = await page.evaluate(async () => {
    const ruleCount = 100;
    const fontCount = 10;
    const style = document.createElement('style');
    style.textContent = Array.from(
      { length: ruleCount },
      (_, index) =>
        `@font-face { font-family: "Indexed ${String.fromCharCode(65 + Math.floor(index / 26), 65 + (index % 26))}"; src: url("/asset-fixtures/block.ttf?font=${index}"); }`,
    ).join('\n');
    document.head.append(style);
    const target = document.querySelector('#target')!;
    for (let index = 0; index < fontCount; index += 1) {
      const span = document.createElement('span');
      span.style.fontFamily = `"Indexed ${String.fromCharCode(65 + Math.floor(index / 26), 65 + (index % 26))}"`;
      span.textContent = 'A';
      target.append(span);
    }
    const declarations = new WeakSet(
      [...style.sheet!.cssRules]
        .filter((rule): rule is CSSFontFaceRule => rule instanceof CSSFontFaceRule)
        .map((rule) => rule.style),
    );
    const original = CSSStyleDeclaration.prototype.getPropertyValue;
    let reads = 0;
    let embeddedReads = 0;
    CSSStyleDeclaration.prototype.getPropertyValue = function (property) {
      if (property === 'font-family') {
        if (declarations.has(this)) {
          reads += 1;
        } else if (
          this.parentRule instanceof CSSFontFaceRule &&
          this.parentRule.parentStyleSheet?.ownerNode === null
        ) {
          embeddedReads += 1;
        }
      }
      return original.call(this, property);
    };
    try {
      const first = await window.assets.capture();
      const cold = { reads, embeddedReads };
      const pixels = document.querySelector<HTMLCanvasElement>('#frame')!.toDataURL();
      reads = 0;
      embeddedReads = 0;
      const started = performance.now();
      const second = await window.assets.capture();
      return {
        first,
        second,
        cold,
        reads,
        ruleCount,
        fontCount,
        milliseconds: performance.now() - started,
        samePixels: pixels === document.querySelector<HTMLCanvasElement>('#frame')!.toDataURL(),
      };
    } finally {
      CSSStyleDeclaration.prototype.getPropertyValue = original;
    }
  });
  await test.info().attach('font-work', {
    body: JSON.stringify(result),
    contentType: 'application/json',
  });
  expect(result.first).toEqual({ code: 'ready', released: true });
  expect(result.second).toEqual({ code: 'ready', released: true });
  expect(result.samePixels).toBe(true);
  // Allow constant overhead, but reject scanning all declarations for every font.
  expect(result.cold.reads).toBeLessThanOrEqual(2 * (result.ruleCount + result.fontCount));
  expect(result.cold.embeddedReads).toBeGreaterThan(0);
  expect(result.cold.embeddedReads).toBeLessThanOrEqual(4 * result.fontCount);
  expect(result.reads).toBeLessThanOrEqual(2 * (result.ruleCount + result.fontCount));
});

test('counter-only text rejects failed embedding of a loaded full-range font and cleans up', async ({
  page,
}) => {
  const font = await readFile(new URL('../public/asset-fixtures/block.ttf', import.meta.url));
  await page.route('**/counter.ttf', (route) =>
    route.fulfill({ body: font, contentType: 'font/ttf' }),
  );
  await page.goto('/assets.html');
  const loaded = await page.evaluate(async () => {
    const style = document.createElement('style');
    style.textContent = `
      @font-face { font-family: "Counter Fixture"; src: url("/counter.ttf"); }
      #target { font-family: "Counter Fixture", sans-serif; counter-reset: step; }
      #target::before { counter-increment: step; content: counter(step, upper-alpha); }
    `;
    document.head.append(style);
    return (await document.fonts.load('40px "Counter Fixture"', 'A')).length;
  });
  expect(loaded).toBe(1);
  let embeddingRequests = 0;
  await page.route('**/counter.ttf', (route) => {
    embeddingRequests += 1;
    return route.fulfill({ status: 404, body: '' });
  });
  const result = await page.evaluate(async () => {
    const result = await window.assets.capture();
    return {
      result,
      temporary: document.querySelectorAll('#snapdom-sandbox, [data-snapdom-internal]').length,
    };
  });
  expect(embeddingRequests).toBeGreaterThan(0);
  expect(result.result.code).toBe('font-embed-failed');
  expect(result.temporary).toBe(0);
});

test('unicode-range counter pseudo content keeps fresh font discovery', async ({ page }) => {
  const font = await readFile(new URL('../public/asset-fixtures/block.ttf', import.meta.url));
  await page.route('**/counter.ttf', (route) =>
    route.fulfill({ body: font, contentType: 'font/ttf' }),
  );
  await page.goto('/assets.html');
  const baseline = await page.evaluate(async () => {
    const style = document.createElement('style');
    style.id = 'counter-font';
    style.textContent = `
      @font-face {
        font-family: "Counter Fixture";
        src: url("/counter.ttf");
        unicode-range: U+0041;
      }
      #target { font-family: "Counter Fixture", sans-serif; counter-reset: step; }
      #target::before { counter-increment: step; content: "A"; }
    `;
    document.head.append(style);
    const result = await window.assets.capture();
    return { result, frame: document.querySelector<HTMLCanvasElement>('#frame')!.toDataURL() };
  });
  expect(baseline.result).toEqual({ code: 'ready', released: true });
  const eligibility = await page.evaluate(async () => {
    const style = document.createElement('style');
    style.textContent = '#target::before { content: counter(step, upper-alpha); }';
    document.head.append(style);
    const content = getComputedStyle(document.querySelector('#target')!, '::before').content;
    return {
      content,
      keywordFaces: (await document.fonts.load('40px "Counter Fixture"', content.slice(1, -1)))
        .length,
      glyphFaces: (await document.fonts.load('40px "Counter Fixture"', 'A')).length,
    };
  });
  expect(eligibility).toEqual({
    content: 'counter(step, upper-alpha)',
    keywordFaces: 0,
    glyphFaces: 1,
  });
  const requests: string[] = [];
  page.on('request', (request) => {
    if (request.url().endsWith('/counter.ttf') && request.resourceType() === 'fetch') {
      requests.push(request.url());
    }
  });
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
    expect(result.frame === baseline.frame).toBe(true);
    expect(requests.length).toBeGreaterThan(before);
  }
});

for (const content of ['""', '"A"']) {
  test(`${content} literal pseudo content keeps font work reusable`, async ({ page }) => {
    const font = await readFile(new URL('../public/asset-fixtures/block.ttf', import.meta.url));
    await page.route('**/literal.ttf', (route) =>
      route.fulfill({ body: font, contentType: 'font/ttf' }),
    );
    await page.goto('/assets.html');
    await page.evaluate((content) => {
      const style = document.createElement('style');
      style.textContent = `
        @font-face { font-family: "Literal Fixture"; src: url("/literal.ttf"); }
        #target { font-family: "Literal Fixture", sans-serif; }
        #target::before { content: ${content}; }
      `;
      document.head.append(style);
    }, content);
    const requests: string[] = [];
    page.on('request', (request) => {
      if (request.url().endsWith('/literal.ttf') && request.resourceType() === 'fetch') {
        requests.push(request.url());
      }
    });
    const frames: string[] = [];
    for (let capture = 0; capture < 2; capture += 1) {
      const result = await page.evaluate(async () => {
        const result = await window.assets.capture();
        return { result, frame: document.querySelector<HTMLCanvasElement>('#frame')!.toDataURL() };
      });
      expect(result.result).toEqual({ code: 'ready', released: true });
      frames.push(result.frame);
      expect(requests.length).toBe(content === '""' ? 0 : 1);
    }
    expect(frames[0] === frames[1]).toBe(true);
  });
}
