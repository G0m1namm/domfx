import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function composeSite({ web, docs, output }) {
  const { site, indexable, sitemap } = JSON.parse(
    readFileSync(join(docs, 'site-contract.json'), 'utf8'),
  );
  rmSync(output, { recursive: true, force: true });
  mkdirSync(output, { recursive: true });
  cpSync(web, output, { recursive: true });
  rmSync(join(output, 'docs'), { recursive: true, force: true });
  cpSync(docs, join(output, 'docs'), { recursive: true });
  for (const name of ['llms.txt', 'llms-full.txt']) {
    cpSync(join(docs, name), join(output, name));
    rmSync(join(output, 'docs', name));
  }
  rmSync(join(output, 'docs/site-contract.json'));
  rmSync(join(output, 'sitemap-index.xml'), { force: true });
  if (indexable && sitemap) {
    writeFileSync(
      join(output, 'sitemap-index.xml'),
      `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><sitemap><loc>${new URL(`/docs/${sitemap}`, site).href}</loc></sitemap></sitemapindex>\n`,
    );
  }
  writeFileSync(
    join(output, 'robots.txt'),
    indexable
      ? `User-agent: *\nAllow: /\nSitemap: ${new URL('/sitemap-index.xml', site).href}\n`
      : 'User-agent: *\nDisallow: /\n',
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL('..', import.meta.url));
  composeSite({
    web: join(root, 'apps/web/dist'),
    docs: join(root, 'apps/docs/dist'),
    output: join(root, '.scratch/docs-preview'),
  });
  console.log('Composed docs preview: .scratch/docs-preview');
}
