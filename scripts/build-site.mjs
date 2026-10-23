import { spawnSync } from 'node:child_process';

// Only this production entry point opts in; DOMFX_SITE_PREVIEW still takes precedence.
const result = spawnSync('pnpm', ['build:web'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    DOMFX_SITE_URL: 'https://domfx.dev',
    DOMFX_SITE_PRODUCTION: 'true',
    DOMFX_INDEXING: 'true',
  },
});
if (result.error) {
  throw result.error;
}
process.exitCode = result.status ?? 1;
