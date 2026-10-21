import { resolve } from 'node:path';

import { defineConfig } from '@playwright/test';

const artifacts =
  process.env.DOMFX_BROWSER_OUTPUT_DIR ??
  resolve(import.meta.dirname, '../../.scratch/placement-browser');

export default defineConfig({
  testDir: './tests/browser',
  testMatch: '*.spec.ts',
  outputDir: resolve(artifacts, 'test-results'),
  reporter: [['list'], ['json', { outputFile: resolve(artifacts, 'report.json') }]],
  workers: 1,
  retries: 0,
  forbidOnly: true,
  timeout: 30_000,
  globalTimeout: 600_000,
  use: {
    viewport: { width: 1280, height: 900 },
    reducedMotion: 'no-preference',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: (['chromium', 'firefox', 'webkit'] as const).flatMap((browserName) =>
    ['development', 'production'].flatMap((build) =>
      [1, 2].map((deviceScaleFactor) => ({
        name: `${browserName}-${build}-dpr${deviceScaleFactor}`,
        use: {
          browserName,
          deviceScaleFactor,
          baseURL: `http://127.0.0.1:${build === 'development' ? 4191 : 4192}`,
        },
      })),
    ),
  ),
  webServer: [
    {
      command:
        'pnpm exec vite --config vite.placement.config.ts --host 127.0.0.1 --port 4191 --strictPort',
      url: 'http://127.0.0.1:4191',
      reuseExistingServer: false,
    },
    {
      command:
        'pnpm exec vite preview --config vite.placement.config.ts --host 127.0.0.1 --port 4192 --strictPort',
      url: 'http://127.0.0.1:4192',
      reuseExistingServer: false,
    },
  ],
});
