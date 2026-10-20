import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { select } from 'hast-util-select';
import rehypeParse from 'rehype-parse';
import rehypeRemark from 'rehype-remark';
import remarkGfm from 'remark-gfm';
import remarkStringify from 'remark-stringify';
import { unified } from 'unified';

const markdownPipeline = unified().use(rehypeRemark).use(remarkGfm).use(remarkStringify);

export function docsSiteConfig(env) {
  if (env.DOMFX_SITE_PRODUCTION === 'true' && !env.DOMFX_SITE_URL) {
    throw new Error('DOMFX_SITE_URL is required for a production site build.');
  }
  const site = new URL(env.DOMFX_SITE_URL ?? 'http://127.0.0.1:4321');
  if (
    !['http:', 'https:'].includes(site.protocol) ||
    site.pathname !== '/' ||
    site.search ||
    site.hash
  ) {
    throw new Error('DOMFX_SITE_URL must be an HTTP(S) origin without a path, query or fragment.');
  }
  return { site: site.origin, trailingSlash: 'always' };
}

function text(node) {
  if (node.type === 'text') {
    return node.value;
  }
  return (node.children ?? []).map(text).join('');
}

function escapeHtml(value) {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
}

function cleanContent(node, canonical) {
  if (!node.children) {
    return;
  }
  node.children = node.children.flatMap((child) => {
    if (child.type === 'element') {
      if (Object.hasOwn(child.properties, 'dataDocsLab')) {
        return [
          {
            type: 'element',
            tagName: 'p',
            properties: {},
            children: [
              {
                type: 'element',
                tagName: 'a',
                properties: { href: canonical },
                children: [{ type: 'text', value: 'Interactive effect lab: view the live page' }],
              },
            ],
          },
        ];
      }
      if (
        ['script', 'style', 'button', 'svg', 'canvas'].includes(child.tagName) ||
        child.properties.ariaHidden === 'true'
      ) {
        return [];
      }
      if (child.tagName === 'pre' && child.properties.dataLanguage) {
        const code = select('code', child);
        if (code) {
          code.properties.className = [`language-${child.properties.dataLanguage}`];
        }
      }
    }
    cleanContent(child, canonical);
    return [child];
  });
}

function breadcrumbs(tree, path, canonical, title, site) {
  const entries = [{ name: 'Docs', item: new URL('/docs/introduction/', site).href }];
  if (path.startsWith('/docs/api/')) {
    entries.push({ name: 'API', item: new URL('/docs/api/', site).href });
  }
  const category = select('.docs-effect-facts a', tree);
  if (category) {
    const url = new URL(String(category.properties.href), site);
    url.pathname = `${url.pathname.replace(/\/$/, '')}/`;
    entries.push({ name: text(category), item: url.href });
  }
  entries.push({ name: title, item: canonical });
  return entries.map((entry, index) => ({ '@type': 'ListItem', position: index + 1, ...entry }));
}

export function docsDiscovery() {
  let config;
  return {
    name: 'domfx-docs-discovery',
    hooks: {
      'astro:config:done': ({ config: resolved }) => {
        config = resolved;
      },
      'astro:build:done': async ({ dir }) => {
        const output = fileURLToPath(dir);
        const site = config.site;
        const indexable =
          process.env.DOMFX_INDEXING === 'true' && process.env.DOMFX_SITE_PREVIEW !== 'true';
        const pages = [];
        const files = (await readdir(output, { recursive: true }))
          .filter((file) => file.endsWith('index.html') && file !== 'index.html')
          .sort();
        for (const file of files) {
          const filename = join(output, file);
          const html = await readFile(filename, 'utf8');
          const tree = unified().use(rehypeParse).parse(html);
          const content = select('.sl-markdown-content', tree);
          if (!content) {
            continue;
          }
          const title = text(select('h1', tree)).trim();
          const description = String(
            select('meta[name="description"]', tree)?.properties.content ?? '',
          );
          if (!title || !description) {
            throw new Error(`${file}: docs title and approved description are required.`);
          }
          const path = `/docs/${relative(output, dirname(filename)).split('\\').join('/')}/`;
          const canonical = new URL(path, site).href;
          const markdownPath = `${path.slice(0, -1)}.md`;
          const graph = {
            '@context': 'https://schema.org',
            '@graph': [
              {
                '@type': 'TechArticle',
                headline: title,
                description,
                url: canonical,
                mainEntityOfPage: canonical,
              },
              {
                '@type': 'BreadcrumbList',
                itemListElement: breadcrumbs(tree, path, canonical, title, site),
              },
            ],
          };
          const metadata =
            `<link rel="canonical" href="${escapeHtml(canonical)}">` +
            `<meta name="robots" content="${indexable ? 'index, follow' : 'noindex, nofollow'}">` +
            `<link rel="alternate" type="text/markdown" href="${escapeHtml(new URL(markdownPath, site).href)}">` +
            `<script type="application/ld+json">${JSON.stringify(graph).replaceAll('<', '\\u003c')}</script>`;
          const updated = html.replace(
            /<head\b([^>]*)>([\s\S]*?)<\/head>/i,
            (_match, attributes, head) => {
              const cleaned = head.replace(/<(?:link|meta)\b[^>]*>/gi, (tag) =>
                /(?:rel=["']canonical["']|name=["']robots["']|type=["']text\/markdown["'])/i.test(
                  tag,
                )
                  ? ''
                  : tag,
              );
              return `<head${attributes}>${cleaned}${metadata}</head>`;
            },
          );
          await writeFile(filename, updated);
          cleanContent(content, canonical);
          const markdownTree = await markdownPipeline.run({
            type: 'root',
            children: content.children,
          });
          const markdown = `# ${title}\n\n${markdownPipeline.stringify(markdownTree).trim()}\n`;
          const markdownFile = join(output, `${relative(output, dirname(filename))}.md`);
          await mkdir(dirname(markdownFile), { recursive: true });
          await writeFile(markdownFile, markdown);
          pages.push({ title, description, canonical, markdown });
        }
        const index =
          '# domfx documentation\n\n' +
          pages
            .map((page) => `- [${page.title}](${page.canonical}): ${page.description}`)
            .join('\n') +
          '\n';
        await writeFile(join(output, 'llms.txt'), index);
        await writeFile(
          join(output, 'llms-full.txt'),
          pages.map((page) => `${page.markdown}\nSource: ${page.canonical}`).join('\n\n'),
        );
        const sitemap = 'sitemap-0.xml';
        await writeFile(
          join(output, sitemap),
          '<?xml version="1.0" encoding="UTF-8"?>' +
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
            (indexable
              ? pages.map((page) => `<url><loc>${escapeHtml(page.canonical)}</loc></url>`).join('')
              : '') +
            '</urlset>',
        );
        await writeFile(
          join(output, 'site-contract.json'),
          JSON.stringify({ site, indexable, sitemap }),
        );
      },
    },
  };
}
