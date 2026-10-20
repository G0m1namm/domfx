import { validatePreviewSite } from './check-site-contract.mjs';

const indexable = process.argv.includes('--indexable');
const result = await validatePreviewSite({
  base: process.argv[2] ?? 'http://127.0.0.1:4321',
  site: process.env.DOMFX_SITE_URL ?? 'http://127.0.0.1:4321',
  indexable,
});
console.log(
  `Docs discovery contract passed (${result.pages} site pages; indexing ${indexable ? 'on' : 'off'}).`,
);
