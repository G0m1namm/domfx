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
const pages = [...index.matchAll(/^- \[([^\]]+)\]\((https?:\/\/[^)]+\/docs\/[^)]+\/)\):/gm)];
assert(pages.length > 0, 'llms.txt must list docs pages');
const titles = new Set();
for (const [, title, canonical] of pages) {
  const path = new URL(canonical).pathname;
  const html = await read(path);
  assert(html.includes(`rel="canonical" href="${canonical}"`), `${path}: canonical`);
  assert(
    html.includes(`name="robots" content="${indexable ? 'index, follow' : 'noindex, nofollow'}"`),
    `${path}: robots`,
  );
  assert(!titles.has(title), `${path}: duplicate title`);
  titles.add(title);
  const alternate = html.match(/<link rel="alternate" type="text\/markdown" href="([^"]+)"/);
  assert(alternate, `${path}: Markdown alternate`);
  const markdown = await read(new URL(alternate[1]).pathname);
  assert(markdown.startsWith(`# ${title}\n`), `${path}: Markdown heading`);
  assert(!/<(?:Docs\w+|script)\b|import .* from /.test(markdown), `${path}: raw component syntax`);
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
