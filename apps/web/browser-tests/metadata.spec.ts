import { expect, test } from '@playwright/test';

test('marketing publishes consistent discovery metadata', async ({ request }, testInfo) => {
  test.skip(testInfo.project.name !== 'production', 'Discovery is verified in built output.');
  const response = await request.get('/');
  expect(response.ok()).toBe(true);
  const html = await response.text();
  expect(html).toContain('<title>Effects for your HTML — domfx</title>');
  const indexable =
    process.env.DOMFX_INDEXING === 'true' && process.env.DOMFX_SITE_PREVIEW !== 'true';
  expect(html).toContain(
    `name="robots" content="${indexable ? 'index, follow' : 'noindex, nofollow'}"`,
  );
  expect(html).toContain('name="twitter:card" content="summary_large_image"');
  expect(html).toContain('property="og:image:width" content="1200"');
  expect(html).toContain('property="og:image:height" content="630"');
  const origin = process.env.DOMFX_SITE_URL ?? 'http://127.0.0.1:4321';
  expect(html).toContain(new URL('/share-card.png', origin).href);
  const graphs = [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)];
  expect(graphs).toHaveLength(1);
  const graph = JSON.parse(graphs[0][1]);
  expect(graph['@graph'].map((entry: { '@type': string }) => entry['@type'])).toEqual([
    'WebSite',
    'SoftwareSourceCode',
  ]);
  const effects = await request.get('/effects/');
  expect(await effects.text()).toContain('<title>Effects — domfx</title>');
});

test('composed discovery lists both apps when indexing is enabled', async ({
  request,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'production', 'Discovery is verified in built output.');
  test.skip(
    process.env.DOMFX_INDEXING !== 'true' || process.env.DOMFX_SITE_PREVIEW === 'true',
    'Indexing is disabled.',
  );
  const response = await request.get('/sitemap-index.xml');
  expect(response.ok()).toBe(true);
  const sitemap = await response.text();
  const origin = process.env.DOMFX_SITE_URL ?? 'http://127.0.0.1:4321';
  expect(sitemap).toContain(`<loc>${new URL('/sitemap-0.xml', origin).href}</loc>`);
  expect(sitemap).toContain(`<loc>${new URL('/docs/sitemap-0.xml', origin).href}</loc>`);
});
