import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { validateBuiltSite } from './check-site-contract.mjs';

export function composeSite({ web, docs, output }) {
  const { site, indexable, sitemap } = JSON.parse(
    readFileSync(join(docs, 'site-contract.json'), 'utf8'),
  );
  const marketing = JSON.parse(readFileSync(join(web, 'site-contract.json'), 'utf8'));
  if (marketing.site !== site || marketing.indexable !== indexable) {
    throw new Error('Marketing and docs must use the same site origin and indexing policy.');
  }
  if (resolve(output) !== resolve(web)) {
    rmSync(output, { recursive: true, force: true });
    mkdirSync(output, { recursive: true });
    cpSync(web, output, { recursive: true });
  }
  rmSync(join(output, 'docs'), { recursive: true, force: true });
  cpSync(docs, join(output, 'docs'), { recursive: true });
  for (const name of ['llms.txt', 'llms-full.txt']) {
    cpSync(join(docs, name), join(output, name));
    rmSync(join(output, 'docs', name));
  }
  rmSync(join(output, 'site-contract.json'));
  rmSync(join(output, 'docs/site-contract.json'));
  // Cloudflare reads the shared header rules at the composed site's root.
  rmSync(join(output, 'docs/_headers'), { force: true });
  rmSync(join(output, 'docs/sitemap-index.xml'), { force: true });
  rmSync(join(output, 'sitemap-index.xml'), { force: true });
  if (indexable && sitemap) {
    writeFileSync(
      join(output, 'sitemap-index.xml'),
      `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><sitemap><loc>${new URL(`/${marketing.sitemap}`, site).href}</loc></sitemap><sitemap><loc>${new URL(`/docs/${sitemap}`, site).href}</loc></sitemap></sitemapindex>\n`,
    );
  }
  writeFileSync(
    join(output, 'robots.txt'),
    indexable
      ? `User-agent: *\nAllow: /\nSitemap: ${new URL('/sitemap-index.xml', site).href}\n`
      : 'User-agent: *\nDisallow: /\n',
  );
  return { site, indexable };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const output = process.argv.includes('--preview')
    ? join(root, '.scratch/docs-preview')
    : join(root, 'apps/web/dist');
  const policy = composeSite({
    web: join(root, 'apps/web/dist'),
    docs: join(root, 'apps/docs/dist'),
    output,
  });
  await validateBuiltSite({ output, ...policy });
  console.log(
    process.argv.includes('--preview')
      ? 'Composed docs preview: .scratch/docs-preview'
      : 'Composed website: apps/web/dist',
  );
}
