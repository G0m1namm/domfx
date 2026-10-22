import { spawnSync } from 'node:child_process';

// The alpha site stays unindexed, including manually uploaded previews.
const result = spawnSync('pnpm', ['build:web'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    DOMFX_SITE_URL: 'https://domfx.dev',
    DOMFX_SITE_PRODUCTION: 'true',
    DOMFX_INDEXING: 'false',
  },
});
if (result.error) {
  throw result.error;
}
process.exitCode = result.status ?? 1;
