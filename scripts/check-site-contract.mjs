import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

function decode(value) {
  return value.replace(/&(?:amp|quot|apos|lt|gt|#\d+|#x[\da-f]+);/gi, (entity) => {
    const named = { '&amp;': '&', '&quot;': '"', '&apos;': "'", '&lt;': '<', '&gt;': '>' };
    return (
      named[entity] ??
      String.fromCodePoint(
        parseInt(
          entity.slice(entity[2].toLowerCase() === 'x' ? 3 : 2),
          entity[2].toLowerCase() === 'x' ? 16 : 10,
        ),
      )
    );
  });
}

function tags(html, name) {
  return [...html.matchAll(new RegExp(`<${name}\\b([^>]*)>`, 'gi'))].map((match) =>
    Object.fromEntries(
      [...match[1].matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)].map((attribute) => [
        attribute[1].toLowerCase(),
        decode(attribute[2] ?? attribute[3]),
      ]),
    ),
  );
}

function one(values, message) {
  assert(values.length === 1 && values[0]?.trim(), message);
  return values[0];
}

function localeIdentity(path) {
  if (path.startsWith('/docs/es/')) {
    return { locale: 'es', equivalent: path.replace('/docs/es/', '/docs/') };
  }
  if (path.startsWith('/es/')) {
    return { locale: 'es', equivalent: path.replace('/es/', '/') };
  }
  return { locale: 'en', equivalent: path };
}

function uniqueOrEquivalent(seen, value, path, label) {
  const previous = seen.get(value);
  if (previous) {
    const currentIdentity = localeIdentity(path);
    const previousIdentity = localeIdentity(previous);
    assert(
      currentIdentity.locale !== previousIdentity.locale &&
        currentIdentity.equivalent === previousIdentity.equivalent,
      `${path}: duplicate ${label}`,
    );
  }
  seen.set(value, path);
}

export async function validateSiteOutput({ read, paths, site, indexable }) {
  const required = async (path) => {
    const content = await read(path);
    assert(content !== null, `${path}: missing built output`);
    return content.toString();
  };
  const titles = new Map();
  const descriptions = new Map();
  const contentPaths = [];
  const documents = new Map();
  for (const path of paths) {
    const html = await required(path);
    const head = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1] ?? html.split(/<body\b/i)[0];
    if (tags(head, 'meta').some((meta) => meta['http-equiv']?.toLowerCase() === 'refresh')) {
      const target = {
        '/examples/': '/effects/',
        '/docs/': '/docs/introduction/',
        '/docs/es/': '/docs/es/introduction/',
      }[path];
      assert(target, `${path}: unexpected redirect`);
      assert(
        tags(head, 'meta').some((meta) => meta.name === 'robots' && meta.content === 'noindex'),
        `${path}: redirect must be noindex`,
      );
      assert(
        tags(head, 'meta').some(
          (meta) =>
            meta['http-equiv']?.toLowerCase() === 'refresh' &&
            meta.content?.endsWith(`url=${target}`),
        ),
        `${path}: redirect target`,
      );
      assert.equal(
        one(
          tags(head, 'link')
            .filter((link) => link.rel === 'canonical')
            .map((link) => link.href),
          `${path}: redirect canonical`,
        ),
        new URL(target, site).href,
        `${path}: redirect canonical target`,
      );
      continue;
    }
    const { locale } = localeIdentity(path);
    assert.equal(tags(html, 'html')[0]?.lang, locale, `${path}: HTML language`);
    contentPaths.push(path);
    const title = decode(
      one(
        [...head.matchAll(/<title\b[^>]*>([^<]*)<\/title>/gi)].map((match) => match[1]),
        `${path}: expected one title`,
      ),
    );
    const meta = tags(head, 'meta');
    const links = tags(head, 'link');
    const value = (key) =>
      one(
        meta.filter((tag) => (tag.name ?? tag.property) === key).map((tag) => tag.content),
        `${path}: expected one ${key}`,
      );
    const description = value('description');
    uniqueOrEquivalent(titles, title, path, 'title');
    uniqueOrEquivalent(descriptions, description, path, 'description');
    const canonical = new URL(path, site).href;
    assert.equal(
      one(
        links.filter((tag) => tag.rel === 'canonical').map((tag) => tag.href),
        `${path}: canonical`,
      ),
      canonical,
      `${path}: canonical origin/path`,
    );
    assert(path.endsWith('/'), `${path}: canonical trailing slash`);
    assert.equal(
      value('robots'),
      indexable ? 'index, follow' : 'noindex, nofollow',
      `${path}: robots`,
    );
    for (const [key, expected] of Object.entries({
      'og:title': title,
      'og:description': description,
      'og:url': canonical,
      'og:type': path.startsWith('/docs/') ? 'article' : 'website',
      'og:image': new URL('/share-card.png', site).href,
      'og:image:width': '1200',
      'og:image:height': '630',
      'twitter:card': 'summary_large_image',
      'twitter:title': title,
      'twitter:description': description,
      'twitter:image': new URL('/share-card.png', site).href,
    })) {
      assert.equal(value(key), expected, `${path}: ${key}`);
    }
    value('og:image:alt');
    value('twitter:image:alt');
    const scripts = [...head.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].filter(
      (match) => tags(`<script${match[1]}>`, 'script')[0].type === 'application/ld+json',
    );
    assert.equal(scripts.length, 1, `${path}: expected one JSON-LD graph`);
    const schema = JSON.parse(scripts[0][2]);
    assert.equal(schema['@context'], 'https://schema.org', `${path}: schema context`);
    const graph = schema['@graph'];
    assert(Array.isArray(graph), `${path}: JSON-LD graph`);
    const expectedTypes =
      path === '/' || path === '/es/'
        ? ['WebSite', 'SoftwareSourceCode']
        : path === '/effects/' || path === '/es/effects/'
          ? ['CollectionPage', 'ItemList']
          : ['TechArticle', 'BreadcrumbList'];
    for (const type of expectedTypes) {
      assert.equal(graph.filter((entry) => entry['@type'] === type).length, 1, `${path}: ${type}`);
    }
    const inspect = (entry) => {
      if (!entry || typeof entry !== 'object') {
        return;
      }
      for (const [key, child] of Object.entries(entry)) {
        assert(
          ![
            'version',
            'softwareVersion',
            'downloadUrl',
            'downloadURL',
            'offers',
            'price',
            'aggregateRating',
            'ratingValue',
          ].includes(key),
          `${path}: invented release field ${key}`,
        );
        assert(child !== 'FAQPage', `${path}: FAQPage is out of scope`);
        inspect(child);
      }
    };
    inspect(schema);
    documents.set(path, { html, links, graph });
    for (const anchor of tags(html, 'a')) {
      if (!anchor.href || /^(?:mailto:|tel:|javascript:)/i.test(anchor.href)) {
        continue;
      }
      const href = new URL(anchor.href, canonical);
      if (href.origin === new URL(site).origin) {
        assert(
          href.pathname.endsWith('/') || /\.[^/]+$/.test(href.pathname),
          `${path}: noncanonical internal link ${anchor.href}`,
        );
        assert(
          !['/examples/', '/docs/'].includes(href.pathname),
          `${path}: internal redirect link ${anchor.href}`,
        );
      }
    }
  }
  const locations = (xml) =>
    [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => decode(match[1])).sort();
  const absolute = (path) => new URL(path, site).href;
  for (const [sitemap, expected, label] of [
    ['/sitemap-0.xml', contentPaths.filter((path) => !path.startsWith('/docs/')), 'marketing'],
    ['/docs/sitemap-0.xml', contentPaths.filter((path) => path.startsWith('/docs/')), 'docs'],
  ]) {
    const xml = await required(sitemap);
    assert(xml.includes('<urlset'), `${sitemap}: expected urlset`);
    assert.deepEqual(
      locations(xml),
      indexable ? expected.map(absolute).sort() : [],
      `${label} sitemap must contain exactly indexable content pages`,
    );
  }
  const robots = await required('/robots.txt');
  assert.equal(
    robots.trim(),
    indexable
      ? `User-agent: *\nAllow: /\nSitemap: ${absolute('/sitemap-index.xml')}`
      : 'User-agent: *\nDisallow: /',
    'robots.txt must match indexing mode',
  );
  const sitemapIndex = await read('/sitemap-index.xml');
  if (indexable) {
    assert(sitemapIndex !== null, 'missing sitemap index');
    assert(sitemapIndex.toString().includes('<sitemapindex'), 'expected sitemap index');
    assert.deepEqual(
      locations(sitemapIndex.toString()),
      [absolute('/sitemap-0.xml'), absolute('/docs/sitemap-0.xml')].sort(),
      'sitemap index must list exactly both child maps',
    );
  } else {
    assert.equal(sitemapIndex, null, 'disabled indexing must omit sitemap index');
  }
  const index = await required('/llms.txt');
  const home = documents.get('/').graph;
  assert.equal(
    home.find((entry) => entry['@type'] === 'WebSite').url,
    absolute('/'),
    'WebSite URL',
  );
  assert.equal(
    home.find((entry) => entry['@type'] === 'SoftwareSourceCode').codeRepository,
    'https://github.com/G0m1namm/domfx',
    'source repository URL',
  );
  const gallery = documents.get('/effects/').graph;
  assert.equal(
    gallery.find((entry) => entry['@type'] === 'CollectionPage').url,
    absolute('/effects/'),
    'CollectionPage URL',
  );
  const items = gallery.find((entry) => entry['@type'] === 'ItemList').itemListElement;
  assert(Array.isArray(items), 'effect ItemList entries');
  assert.deepEqual(
    items.map((item) => item.url).sort(),
    contentPaths
      .filter((path) => /^\/docs\/api\/effects\/[^/]+\/$/.test(path))
      .map(absolute)
      .sort(),
    'ItemList must list exactly all effect references',
  );
  for (const [position, item] of items.entries()) {
    assert(
      item['@type'] === 'ListItem' && item.position === position + 1 && item.name?.trim(),
      'effect ItemList name/position',
    );
  }
  const full = await required('/llms-full.txt');
  const pages = [...index.matchAll(/^- \[([^\]]+)\]\((https?:\/\/[^)]+\/docs\/[^)]+\.md)\):/gm)];
  assert(pages.length > 0, 'llms.txt must list docs pages');
  assert.deepEqual(
    pages.map((page) => page[2].replace(/\.md$/, '/')).sort(),
    contentPaths
      .filter((path) => path.startsWith('/docs/'))
      .map(absolute)
      .sort(),
    'llms index must list exactly all docs pages',
  );
  for (const [, title, markdownUrl] of pages) {
    const canonical = markdownUrl.replace(/\.md$/, '/');
    const path = new URL(canonical).pathname;
    const { html, links, graph } = documents.get(path);
    const markdownPath = new URL(markdownUrl).pathname;
    const markdown = await required(markdownPath);
    assert.equal(
      one(
        links
          .filter((link) => link.rel === 'alternate' && link.type === 'text/markdown')
          .map((link) => link.href),
        `${path}: Markdown alternate`,
      ),
      markdownUrl,
      `${path}: Markdown alternate matches llms index`,
    );
    assert(markdown.startsWith(`# ${title}\n`), `${path}: Markdown heading`);
    const article = graph.find((entry) => entry['@type'] === 'TechArticle');
    assert.equal(article.url, canonical, `${path}: TechArticle URL`);
    assert.equal(
      markdown.split('\n\n')[1].trim(),
      article.description,
      `${path}: approved summary first`,
    );
    assert(
      full.includes(`Source: ${markdownUrl}`) && full.includes(markdown.trim()),
      `${path}: full Markdown content/source`,
    );
    const prose = markdown.replace(/^(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1[ \t]*(?:\n|$)/gm, '');
    assert(!/<Docs\w+\b|^import .* from /m.test(prose), `${path}: raw component syntax`);
    const breadcrumbs = graph.find((entry) => entry['@type'] === 'BreadcrumbList');
    assert(breadcrumbs.itemListElement?.length >= 2, `${path}: breadcrumbs`);
    for (const breadcrumb of breadcrumbs.itemListElement) {
      const url = new URL(breadcrumb.item);
      assert.equal(url.origin, new URL(site).origin, `${path}: breadcrumb origin`);
      const target = await required(url.pathname);
      if (url.hash) {
        assert(
          target.includes(`id="${url.hash.slice(1)}"`),
          `${path}: breadcrumb anchor ${url.hash}`,
        );
      }
    }
    if (html.includes('data-docs-lab')) {
      assert(
        markdown.includes(`[Interactive effect lab: view the live page](${canonical})`),
        `${path}: live lab link`,
      );
      assert(!markdown.includes('data-docs-lab'), `${path}: interactive lab removed`);
    }
    if (path === '/docs/api/effects/fire/') {
      assert(
        markdown.includes('```') && markdown.includes('attachFire'),
        `${path}: code preserved`,
      );
      assert(
        /\| Property\s*\| Type\s*\| Default\s*\|/.test(markdown),
        `${path}: API table preserved`,
      );
    }
  }
  const image = await read('/share-card.png');
  assert(
    image &&
      image.length >= 24 &&
      image.subarray(0, 16).equals(Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex')),
    '/share-card.png: expected PNG',
  );
  assert(
    image.readUInt32BE(16) === 1200 && image.readUInt32BE(20) === 630,
    '/share-card.png: expected 1200×630',
  );
  return { pages: contentPaths.length };
}

export async function validateBuiltSite({ output, site, indexable }) {
  const files = await readdir(output, { recursive: true });
  const paths = files
    .filter((path) => path === 'index.html' || path.endsWith('/index.html'))
    .map((path) => (path === 'index.html' ? '/' : `/${path.slice(0, -10)}`));
  const read = async (path) => {
    try {
      return await readFile(join(output, path.endsWith('/') ? `${path}index.html` : path));
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  };
  return validateSiteOutput({ read, paths, site, indexable });
}

export async function validatePreviewSite({ base, site, indexable }) {
  const read = async (path) => {
    const response = await fetch(new URL(path, base));
    if (response.status === 404) {
      return null;
    }
    assert(response.ok, `${path}: HTTP ${response.status}`);
    return Buffer.from(await response.arrayBuffer());
  };
  const index = await read('/llms.txt');
  assert(index, 'missing llms.txt');
  const docs = [...index.toString().matchAll(/^- \[[^\]]+\]\((https?:\/\/[^)]+\.md)\):/gm)].map(
    (match) => new URL(match[1]).pathname.replace(/\.md$/, '/'),
  );
  return validateSiteOutput({ read, paths: ['/', '/effects/', ...docs], site, indexable });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const site = process.env.DOMFX_SITE_URL ?? 'http://127.0.0.1:4321';
  const indexable = process.argv.includes('--indexable');
  const target = process.argv[2] ?? 'apps/web/dist';
  const result = target.startsWith('http')
    ? await validatePreviewSite({ base: target, site, indexable })
    : await validateBuiltSite({ output: target, site, indexable });
  console.log(
    `Site discovery contract passed (${result.pages} pages; indexing ${indexable ? 'on' : 'off'}).`,
  );
}
