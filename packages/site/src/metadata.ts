export interface PageMetadata {
  title: string;
  description: string;
  path: string;
  type: 'website' | 'article';
  markdownPath?: string;
  structuredData: readonly Record<string, unknown>[];
}

export interface DiscoveryConfig {
  site: string;
  indexable: boolean;
}

export function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
}

export function renderMetadata(page: PageMetadata, config: DiscoveryConfig): string {
  if (!page.title.trim() || !page.description.trim() || !page.path.endsWith('/')) {
    throw new Error(`${page.path}: title, description and trailing-slash path are required.`);
  }
  const title = escapeHtml(`${page.title} — domfx`);
  const description = escapeHtml(page.description);
  const canonical = escapeHtml(new URL(page.path, config.site).href);
  const image = escapeHtml(new URL('/share-card.png', config.site).href);
  const graph = { '@context': 'https://schema.org', '@graph': page.structuredData };
  return (
    `<title>${title}</title>` +
    `<meta name="description" content="${description}">` +
    `<link rel="canonical" href="${canonical}">` +
    (config.indexable
      ? `<link rel="sitemap" href="${escapeHtml(new URL('/sitemap-index.xml', config.site).href)}">`
      : '') +
    `<meta name="robots" content="${config.indexable ? 'index, follow' : 'noindex, nofollow'}">` +
    `<meta property="og:title" content="${title}">` +
    `<meta property="og:description" content="${description}">` +
    `<meta property="og:type" content="${page.type}">` +
    `<meta property="og:url" content="${canonical}">` +
    `<meta property="og:site_name" content="domfx">` +
    `<meta property="og:image" content="${image}">` +
    `<meta property="og:image:width" content="1200">` +
    `<meta property="og:image:height" content="630">` +
    `<meta property="og:image:alt" content="domfx — Effects for your HTML">` +
    `<meta name="twitter:card" content="summary_large_image">` +
    `<meta name="twitter:title" content="${title}">` +
    `<meta name="twitter:description" content="${description}">` +
    `<meta name="twitter:image" content="${image}">` +
    `<meta name="twitter:image:alt" content="domfx — Effects for your HTML">` +
    (page.markdownPath
      ? `<link rel="alternate" type="text/markdown" href="${escapeHtml(new URL(page.markdownPath, config.site).href)}">`
      : '') +
    `<script type="application/ld+json">${JSON.stringify(graph).replaceAll('<', '\\u003c')}</script>`
  );
}
