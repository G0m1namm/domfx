import { expect, test } from '@playwright/test';

// These route and layout regressions must also pass when WebGPU is unavailable.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
});

for (const locale of ['', 'es/']) {
  test(`@routine docs ${locale || 'en/'} navigation retains query strings and fragments`, async ({
    page,
  }) => {
    await page.goto(`/docs/${locale}troubleshooting/`);
    const target = `/docs/${locale}support`;
    await page.locator(`a[href^="${target}"][href$="#capture-and-composition-limits"]`).click();
    await expect(page).toHaveURL(new RegExp(`${target}/#capture-and-composition-limits$`));
    await expect(page.locator('#capture-and-composition-limits')).toBeAttached();

    await page.goto(`${target}?from=docs&value=a%2Fb#capture-and-composition-limits`);
    await expect(page).toHaveURL(
      new RegExp(`${target}/?\\?from=docs&value=a%2Fb#capture-and-composition-limits$`),
    );
    await expect(page.locator('#capture-and-composition-limits')).toBeAttached();
  });

  test(`@routine docs ${locale || 'en/'} slashless links preserve queries and legacy anchors`, async ({
    request,
  }, testInfo) => {
    for (const [page, fragment] of [
      ['support', 'capture-and-composition-limits'],
      ['standalone', 'control-time'],
      ['gsap', 'context-cleanup'],
      ['gsap', 'optional-bindings'],
      ['gsap', 'unavailable-and-retry'],
    ]) {
      const path = `/docs/${locale}${page}?from=docs&value=a%2Fb`;
      const redirect = await request.get(path, { maxRedirects: 0 });
      if (testInfo.project.name === 'development') {
        expect(redirect.status(), path).toBe(308);
        expect(redirect.headers().location).toBe(`/docs/${locale}${page}/?from=docs&value=a%2Fb`);
      } else {
        expect(redirect.status(), path).toBe(200);
      }
      const response = await request.get(`${path}#${fragment}`);
      expect(response.ok(), path).toBe(true);
      expect(await response.text(), `${path}#${fragment}`).toContain(`id="${fragment}"`);
    }
    const missing = await request.get(`/docs/${locale}missing-docs-regression`);
    expect(missing.status()).toBe(404);
  });
}

test('@routine slashless marketing routes retain slashed canonicals and missing routes return 404', async ({
  request,
}) => {
  for (const path of ['/effects', '/es/effects']) {
    const response = await request.get(path);
    expect(response.ok(), path).toBe(true);
    expect(await response.text()).toMatch(
      new RegExp(`<link rel="canonical" href="https?://[^"/]+${path}/"`),
    );
  }
  expect((await request.get('/missing-routing-regression')).status()).toBe(404);
});

test('all emitted EN/ES docs links resolve with their fragments and slashless routes', async ({
  request,
  baseURL,
}, testInfo) => {
  test.setTimeout(120_000);
  const origin = new URL(baseURL ?? '').origin;
  const links = new Set([`${origin}/docs/introduction/`, `${origin}/docs/es/introduction/`]);
  const documents = new Map<string, string>();
  const routes = new Set<string>();
  let fragments = 0;

  // Follow emitted hrefs unchanged: build-time canonicalization must not hide dev failures.
  for (const href of links) {
    const url = new URL(href);
    const path = `${url.pathname}${url.search}`;
    let html = documents.get(path);
    if (html === undefined) {
      const response = await request.get(path);
      expect(response.ok(), href).toBe(true);
      html = await response.text();
      documents.set(path, html);
      routes.add(new URL(response.url()).pathname);
      for (const match of html.matchAll(/<a\b[^>]*\bhref="([^"]*)"/g)) {
        const target = new URL(match[1].replaceAll('&amp;', '&'), response.url());
        if (
          target.origin === origin &&
          target.pathname.startsWith('/docs/') &&
          !/\.[^/]+$/.test(target.pathname)
        ) {
          links.add(target.href);
        }
      }
    }
    if (url.hash) {
      const fragment = decodeURIComponent(url.hash.slice(1));
      expect(html, href).toContain(`id="${fragment}"`);
      fragments++;
    }
  }

  for (const route of routes) {
    const slashless = route.replace(/\/$/, '');
    const response = await request.get(slashless);
    expect(response.ok(), slashless).toBe(true);
    expect(await response.text(), slashless).toMatch(
      new RegExp(`<link rel="canonical" href="https?://[^"/]+${route}"`),
    );
  }
  const spanish = [...routes].filter((route) => route.startsWith('/docs/es/')).length;
  expect(spanish).toBeGreaterThan(0);
  expect(routes.size).toBe(spanish * 2);
  await testInfo.attach('docs-link-audit', {
    body: JSON.stringify({ routes: routes.size, spanish, links: links.size, fragments }),
    contentType: 'application/json',
  });
});
