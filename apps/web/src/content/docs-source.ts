import { repositoryUrl } from '@domfx/site/site-links';

const PAGES = 'apps/web/src/pages/docs';
// Pages written in Markdown; every other docs page is an Astro component.
const MARKDOWN_PAGES = new Set([
  'introduction',
  'installation',
  'upgrading',
  'support',
  'troubleshooting',
]);

// Repository path of the file that renders a docs page. Effect references share
// one dynamic route beside the effects index.
export function docsSourcePath(slug: string): string {
  if (slug === 'api/effects') {
    return `${PAGES}/api/effects/index.astro`;
  }
  if (slug.startsWith('api/effects/')) {
    return `${PAGES}/api/effects/[effect].astro`;
  }
  return `${PAGES}/${slug}.${MARKDOWN_PAGES.has(slug) ? 'md' : 'astro'}`;
}

export function docsEditUrl(slug: string): string {
  return `${repositoryUrl}/edit/main/${encodeURI(docsSourcePath(slug))}`;
}

export function docsIssueUrl(slug: string, title: string): string {
  const query = new URLSearchParams({
    title: `Docs: ${title}`,
    body: `Page: /docs/${slug}\n\nWhat is unclear, missing or wrong?\n`,
  });
  return `${repositoryUrl}/issues/new?${query}`;
}
