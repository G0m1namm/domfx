import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { siteConfig } from '@domfx/site/config';
import { marketingPages } from '@domfx/site/marketing-pages';
import { escapeHtml } from '@domfx/site/metadata';

export function marketingDiscovery() {
  return {
    name: 'domfx-marketing-discovery',
    hooks: {
      'astro:build:done': async ({ dir }) => {
        const output = fileURLToPath(dir);
        const { site, indexable } = siteConfig(process.env);
        const sitemap = 'sitemap-0.xml';
        await writeFile(
          join(output, sitemap),
          '<?xml version="1.0" encoding="UTF-8"?>' +
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
            (indexable
              ? marketingPages(site)
                  .map(
                    (page) => `<url><loc>${escapeHtml(new URL(page.path, site).href)}</loc></url>`,
                  )
                  .join('')
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
