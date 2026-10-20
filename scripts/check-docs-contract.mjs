const base = new URL(process.argv[2] ?? 'http://127.0.0.1:4321');
const indexable = process.argv.includes('--indexable');

async function read(path) {
  const response = await fetch(new URL(path, base));
  if (!response.ok) {
    throw new Error(`${path}: HTTP ${response.status}`);
  }
  return response.text();
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const index = await read('/llms.txt');
const full = await read('/llms-full.txt');
const pages = [...index.matchAll(/^- \[([^\]]+)\]\((https?:\/\/[^)]+\/docs\/[^)]+\.md)\):/gm)];
assert(pages.length > 0, 'llms.txt must list docs pages');
const robots = await read('/robots.txt');
const sitemap = await read('/docs/sitemap-0.xml');
const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
if (indexable) {
  assert(
    robots.includes('Allow: /') && !robots.includes('Disallow: /'),
    'robots.txt must allow indexing',
  );
  const sitemapIndex = await read('/sitemap-index.xml');
  const docsSitemap = new URL('/docs/sitemap-0.xml', pages[0][2]).href;
  assert(sitemapIndex.includes(`<loc>${docsSitemap}</loc>`), 'sitemap index must include docs');
  assert(
    robots.includes(new URL('/sitemap-index.xml', docsSitemap).href),
    'robots.txt sitemap index',
  );
  const expected = pages.map((page) => page[2].replace(/\.md$/, '/')).sort();
  assert(
    JSON.stringify(sitemapUrls.sort()) === JSON.stringify(expected),
    'docs sitemap must contain exactly the canonical docs pages',
  );
} else {
  assert(
    robots.includes('Disallow: /') && !robots.includes('Sitemap:'),
    'robots.txt must disallow crawling',
  );
  assert(sitemapUrls.length === 0, 'disabled indexing must omit sitemap pages');
  const sitemapIndex = await fetch(new URL('/sitemap-index.xml', base));
  assert(sitemapIndex.status === 404, 'disabled indexing must omit the sitemap index');
}
const titles = new Set();
for (const [, title, markdownUrl] of pages) {
  const canonical = markdownUrl.replace(/\.md$/, '/');
  const path = new URL(canonical).pathname;
  const html = await read(path);
  for (const [, href] of html.matchAll(/<a\b[^>]*href="(\/docs(?:\/[^"#?]*)?)(?:[#?][^"]*)?"/g)) {
    assert(
      href.endsWith('/') || /\.[^/]+$/.test(href),
      `${path}: noncanonical internal link ${href}`,
    );
  }
  assert(html.includes(`rel="canonical" href="${canonical}"`), `${path}: canonical`);
  assert(
    html.includes(`name="robots" content="${indexable ? 'index, follow' : 'noindex, nofollow'}"`),
    `${path}: robots`,
  );
  assert(!titles.has(title), `${path}: duplicate title`);
  titles.add(title);
  const alternate = html.match(/<link rel="alternate" type="text\/markdown" href="([^"]+)"/);
  assert(alternate, `${path}: Markdown alternate`);
  assert(alternate[1] === markdownUrl, `${path}: llms link must match Markdown alternate`);
  assert(full.includes(`Source: ${markdownUrl}`), `${path}: full Markdown source link`);
  const markdown = await read(new URL(alternate[1]).pathname);
  assert(markdown.startsWith(`# ${title}\n`), `${path}: Markdown heading`);
  const prose = markdown.replace(/^(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1[ \t]*(?:\n|$)/gm, '');
  assert(!/<Docs\w+\b|^import .* from /m.test(prose), `${path}: raw component syntax`);
  assert(full.includes(markdown.trim()), `${path}: missing full Markdown`);
  const schema = html.match(/<script type="application\/ld\+json">([^<]+)<\/script>/);
  assert(schema, `${path}: JSON-LD`);
  const graph = JSON.parse(schema[1])['@graph'];
  const article = graph.find((entry) => entry['@type'] === 'TechArticle');
  assert(markdown.split('\n\n')[1] === article.description, `${path}: approved summary first`);
  assert(
    graph.some((entry) => entry['@type'] === 'TechArticle' && entry.url === canonical),
    `${path}: TechArticle`,
  );
  const breadcrumbs = graph.find((entry) => entry['@type'] === 'BreadcrumbList');
  assert(breadcrumbs?.itemListElement.length >= 2, `${path}: breadcrumbs`);
  for (const breadcrumb of breadcrumbs.itemListElement) {
    const url = new URL(breadcrumb.item);
    const breadcrumbHtml = await read(url.pathname);
    if (url.hash) {
      assert(
        breadcrumbHtml.includes(`id="${url.hash.slice(1)}"`),
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
    assert(markdown.includes('```') && markdown.includes('attachFire'), `${path}: code preserved`);
    assert(
      /\| Property\s*\| Type\s*\| Default\s*\|/.test(markdown),
      `${path}: API table preserved`,
    );
  }
}
console.log(
  `Docs discovery contract passed (${pages.length} pages; indexing ${indexable ? 'on' : 'off'}).`,
);
