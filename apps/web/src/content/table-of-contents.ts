export interface TocHeading {
  depth: 2 | 3;
  id: string;
  text: string;
}

const HEADING = /<h([23])\b[^>]*?\bid="([^"]+)"[^>]*>([\s\S]*?)<\/h\1>/g;
const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
};

// Component headings (such as a preview's title) use the docs- id prefix and are
// not page sections.
export function tableOfContents(html: string): TocHeading[] {
  return Array.from(html.matchAll(HEADING), ([, depth, id, inner]): TocHeading => ({
    depth: depth === '2' ? 2 : 3,
    id,
    text: inner
      .replace(/<[^>]*>/g, '')
      .replace(/&(?:amp|lt|gt|quot|#39);/g, (entity) => ENTITIES[entity] ?? entity)
      .trim(),
  })).filter((heading) => !heading.id.startsWith('docs-') && heading.text !== '');
}
