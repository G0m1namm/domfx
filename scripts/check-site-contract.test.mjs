import assert from 'node:assert/strict';
import test from 'node:test';

import { validateSiteOutput } from './check-site-contract.mjs';

test('rejects a content page missing its title in the built HTML', async () => {
  await assert.rejects(
    validateSiteOutput({
      site: 'https://example.com',
      indexable: false,
      paths: ['/'],
      read: async () => Buffer.from('<html lang="en"><head></head><body>domfx</body></html>'),
    }),
    /\/: expected one title/,
  );
});

test('rejects missing canonical metadata in built HTML', async () => {
  const html =
    '<html lang="en"><head><title>domfx</title><meta name="description" content="Effects"></head></html>';
  await assert.rejects(
    validateSiteOutput({
      site: 'https://example.com',
      indexable: false,
      paths: ['/'],
      read: async () => Buffer.from(html),
    }),
    /canonical/,
  );
});

function output(indexable = false) {
  const site = 'https://example.com';
  const files = new Map();
  for (const [path, title, description, types] of [
    ['/', 'domfx', 'GPU effects for HTML', ['WebSite', 'SoftwareSourceCode']],
    ['/effects/', 'Effects — domfx', 'Browse effects', ['CollectionPage', 'ItemList']],
    [
      '/docs/introduction/',
      'Introduction — domfx',
      'Start with domfx.',
      ['TechArticle', 'BreadcrumbList'],
    ],
  ]) {
    const meta = {
      description,
      robots: indexable ? 'index, follow' : 'noindex, nofollow',
      'og:title': title,
      'og:description': description,
      'og:url': `${site}${path}`,
      'og:type': path.startsWith('/docs/') ? 'article' : 'website',
      'og:image': `${site}/share-card.png`,
      'og:image:width': '1200',
      'og:image:height': '630',
      'og:image:alt': 'domfx effect',
      'twitter:card': 'summary_large_image',
      'twitter:title': title,
      'twitter:description': description,
      'twitter:image': `${site}/share-card.png`,
      'twitter:image:alt': 'domfx effect',
    };
    const graph = types.map((type) => ({ '@type': type, description, url: `${site}${path}` }));
    if (path === '/') {
      graph[1].codeRepository = 'https://github.com/G0m1namm/domfx';
    }
    if (path === '/effects/') {
      graph[1].itemListElement = [];
    }
    if (path.startsWith('/docs/')) {
      graph[1].itemListElement = [{ item: `${site}/` }, { item: `${site}${path}` }];
    }
    files.set(
      path,
      `<html lang="en"><head><title>${title}</title>${Object.entries(meta)
        .map(([name, content]) => `<meta name="${name}" content="${content}">`)
        .join(
          '',
        )}<link rel="canonical" href="${site}${path}">${path.startsWith('/docs/') ? `<link rel="alternate" type="text/markdown" href="${site}/docs/introduction.md">` : ''}<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': graph })}</script></head><body><a href="/effects/">Effects</a></body></html>`,
    );
  }
  files.set(
    '/llms.txt',
    '# domfx\n- [Introduction](https://example.com/docs/introduction.md): Start with domfx.\n',
  );
  files.set('/docs/introduction.md', '# Introduction\n\nStart with domfx.\n');
  files.set(
    '/llms-full.txt',
    'Source: https://example.com/docs/introduction.md\n\n# Introduction\n\nStart with domfx.\n',
  );
  files.set(
    '/robots.txt',
    indexable
      ? 'User-agent: *\nAllow: /\nSitemap: https://example.com/sitemap-index.xml\n'
      : 'User-agent: *\nDisallow: /\n',
  );
  files.set(
    '/sitemap-0.xml',
    indexable
      ? '<urlset><url><loc>https://example.com/</loc></url><url><loc>https://example.com/effects/</loc></url></urlset>'
      : '<urlset></urlset>',
  );
  files.set(
    '/docs/sitemap-0.xml',
    indexable
      ? '<urlset><url><loc>https://example.com/docs/introduction/</loc></url></urlset>'
      : '<urlset></urlset>',
  );
  if (indexable) {
    files.set(
      '/sitemap-index.xml',
      '<sitemapindex><sitemap><loc>https://example.com/sitemap-0.xml</loc></sitemap><sitemap><loc>https://example.com/docs/sitemap-0.xml</loc></sitemap></sitemapindex>',
    );
  }
  const image = Buffer.alloc(24);
  Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex').copy(image);
  image.writeUInt32BE(1200, 16);
  image.writeUInt32BE(630, 20);
  files.set('/share-card.png', image);
  return {
    files,
    options: {
      site,
      indexable,
      paths: ['/', '/effects/', '/docs/introduction/'],
      read: async (path) => (files.has(path) ? Buffer.from(files.get(path)) : null),
    },
  };
}

function redirectHtml(target) {
  return `<html><head><meta http-equiv="refresh" content="0;url=${target}"><meta name="robots" content="noindex"><link rel="canonical" href="https://example.com${target}"></head></html>`;
}

for (const [path, target] of [
  ['/examples/', '/effects/'],
  ['/docs/', '/docs/introduction/'],
  ['/docs/es/', '/docs/es/introduction/'],
]) {
  test(`accepts ${path} redirect to ${target}`, async () => {
    const { files, options } = output();
    files.set(path, redirectHtml(target));
    options.paths.push(path);
    assert.deepEqual(await validateSiteOutput(options), { pages: 3 });
  });

  for (const [name, before, after, expected] of [
    ['target', `url=${target}`, 'url=/wrong/', /redirect target/],
    ['noindex', 'content="noindex"', 'content="index, follow"', /redirect must be noindex/],
    [
      'canonical',
      `href="https://example.com${target}"`,
      'href="https://example.com/wrong/"',
      /redirect canonical target/,
    ],
  ]) {
    test(`rejects ${path} redirect with wrong ${name}`, async () => {
      const { files, options } = output();
      files.set(path, redirectHtml(target).replace(before, after));
      options.paths.push(path);
      await assert.rejects(validateSiteOutput(options), expected);
    });
  }
}

test('rejects an unexpected redirect path', async () => {
  const { files, options } = output();
  files.set('/unexpected/', redirectHtml('/effects/'));
  options.paths.push('/unexpected/');
  await assert.rejects(validateSiteOutput(options), /unexpected redirect/);
});

test('rejects an indexable page omitted from its child sitemap', async () => {
  const { files, options } = output(true);
  files.set('/sitemap-0.xml', '<urlset></urlset>');
  await assert.rejects(validateSiteOutput(options), /marketing sitemap/);
});

test('allows fallback metadata only on the equivalent page in another locale', async () => {
  const { files, options } = output();
  const spanish = files
    .get('/')
    .replace('<html lang="en">', '<html lang="es">')
    .replace('href="https://example.com/"', 'href="https://example.com/es/"')
    .replaceAll('content="https://example.com/"', 'content="https://example.com/es/"');
  files.set('/es/', spanish);
  options.paths.push('/es/');
  await validateSiteOutput(options);

  files.set('/es/effects/', spanish);
  options.paths.push('/es/effects/');
  await assert.rejects(validateSiteOutput(options), /duplicate title/);
});

test('rejects a missing Markdown copy linked by the docs HTML and llms index', async () => {
  const { files, options } = output();
  files.delete('/docs/introduction.md');
  await assert.rejects(validateSiteOutput(options), /introduction.md: missing/);
});

test('rejects an incorrectly sized share card', async () => {
  const { files, options } = output();
  files.get('/share-card.png').writeUInt32BE(600, 16);
  await assert.rejects(validateSiteOutput(options), /share-card.png: expected 1200/);
});

for (const indexable of [false, true]) {
  test(`accepts complete built output with indexing ${indexable ? 'on' : 'off'}`, async () => {
    assert.deepEqual(await validateSiteOutput(output(indexable).options), { pages: 3 });
  });
}

for (const [name, path, before, after, expected] of [
  [
    'duplicate description',
    '/effects/',
    'content="Browse effects"',
    'content="GPU effects for HTML"',
    /duplicate description/,
  ],
  [
    'duplicate canonical',
    '/',
    '</head>',
    '<link rel="canonical" href="https://example.com/"></head>',
    /canonical/,
  ],
  [
    'wrong canonical origin',
    '/',
    'rel="canonical" href="https://example.com/"',
    'rel="canonical" href="https://other.test/"',
    /canonical origin/,
  ],
  ['wrong indexing directive', '/', 'noindex, nofollow', 'index, follow', /robots/],
  [
    'relative share URL',
    '/',
    'name="og:image" content="https://example.com/share-card.png"',
    'name="og:image" content="/share-card.png"',
    /og:image/,
  ],
  [
    'missing Twitter card',
    '/',
    '<meta name="twitter:card" content="summary_large_image">',
    '',
    /twitter:card/,
  ],
  ['wrong structured type', '/', 'SoftwareSourceCode', 'SoftwareApplication', /SoftwareSourceCode/],
  [
    'invented release price',
    '/',
    '"@type":"SoftwareSourceCode"',
    '"@type":"SoftwareSourceCode","price":0',
    /invented release field price/,
  ],
  [
    'noncanonical internal link',
    '/',
    'href="/effects/"',
    'href="/effects"',
    /noncanonical internal link/,
  ],
  [
    'redirect in sitemap',
    '/sitemap-0.xml',
    '</urlset>',
    '<url><loc>https://example.com/examples/</loc></url></urlset>',
    /marketing sitemap/,
  ],
]) {
  test(`rejects ${name} in emitted output`, async () => {
    const { files, options } = output();
    assert(files.get(path).includes(before), 'mutation must change the fixture');
    files.set(path, files.get(path).replace(before, after));
    await assert.rejects(validateSiteOutput(options), expected);
  });
}
