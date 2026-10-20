import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';

import { composeSite } from './compose-site.mjs';

for (const inPlace of [false, true]) {
  test(`composes marketing and docs ${inPlace ? 'into the marketing output' : 'into a separate preview'}`, (t) => {
    const directory = mkdtempSync(join(tmpdir(), 'domfx-site-'));
    t.after(() => rmSync(directory, { recursive: true, force: true }));
    const web = join(directory, 'web');
    const docs = join(directory, 'docs');
    const output = inPlace ? web : join(directory, 'preview');
    const put = (root, path, content) => {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      writeFileSync(join(root, path), content);
    };
    put(
      web,
      'site-contract.json',
      JSON.stringify({ site: 'https://example.com', indexable: false, sitemap: 'sitemap-0.xml' }),
    );
    put(web, 'index.html', '<h1>Marketing</h1>');
    put(web, 'docs/old/index.html', 'Old docs');
    put(web, '_astro/marketing.js', 'marketing');
    put(docs, 'introduction/index.html', '<h1>New docs</h1>');
    put(docs, '_astro/docs.js', 'docs');
    put(docs, 'pagefind/pagefind.js', 'search');
    put(docs, 'llms.txt', '# Documentation');
    put(docs, 'llms-full.txt', '# Full documentation');
    put(
      docs,
      'site-contract.json',
      JSON.stringify({ site: 'https://example.com', indexable: false, sitemap: null }),
    );
    composeSite({ web, docs, output });
    assert.equal(readFileSync(join(output, 'index.html'), 'utf8'), '<h1>Marketing</h1>');
    assert.equal(
      readFileSync(join(output, 'docs/introduction/index.html'), 'utf8'),
      '<h1>New docs</h1>',
    );
    assert.equal(readFileSync(join(output, 'docs/_astro/docs.js'), 'utf8'), 'docs');
    assert.equal(readFileSync(join(output, 'docs/pagefind/pagefind.js'), 'utf8'), 'search');
    assert.equal(readFileSync(join(output, 'llms.txt'), 'utf8'), '# Documentation');
    assert.equal(readFileSync(join(output, 'llms-full.txt'), 'utf8'), '# Full documentation');
    assert.equal(readFileSync(join(output, 'robots.txt'), 'utf8'), 'User-agent: *\nDisallow: /\n');
    assert.equal(existsSync(join(output, 'docs/old')), false);
    assert.equal(existsSync(join(output, 'docs/site-contract.json')), false);
    assert.equal(existsSync(join(output, 'sitemap-index.xml')), false);
    if (!inPlace) {
      assert.equal(readFileSync(join(web, 'docs/old/index.html'), 'utf8'), 'Old docs');
    }
    assert.equal(existsSync(join(docs, 'llms.txt')), true);

    put(
      docs,
      'sitemap-0.xml',
      '<urlset><url><loc>https://example.com/docs/introduction/</loc></url></urlset>',
    );
    put(
      docs,
      'site-contract.json',
      JSON.stringify({ site: 'https://example.com', indexable: true, sitemap: 'sitemap-0.xml' }),
    );
    put(
      web,
      'site-contract.json',
      JSON.stringify({ site: 'https://example.com', indexable: true, sitemap: 'sitemap-0.xml' }),
    );
    composeSite({ web, docs, output });
    assert.match(
      readFileSync(join(output, 'sitemap-index.xml'), 'utf8'),
      /<loc>https:\/\/example.com\/docs\/sitemap-0.xml<\/loc>/,
    );
    assert.equal(
      readFileSync(join(output, 'robots.txt'), 'utf8'),
      'User-agent: *\nAllow: /\nSitemap: https://example.com/sitemap-index.xml\n',
    );
    assert.equal(
      readFileSync(join(output, 'docs/sitemap-0.xml'), 'utf8'),
      '<urlset><url><loc>https://example.com/docs/introduction/</loc></url></urlset>',
    );
  });
}
