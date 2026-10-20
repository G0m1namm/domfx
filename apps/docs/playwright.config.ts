import { resolve } from 'node:path';

import { defineConfig } from '@playwright/test';

const gpuBackend = process.env.DOMFX_GPU_BACKEND ?? 'native';
if (!['native', 'swiftshader'].includes(gpuBackend)) {
  throw new Error('DOMFX_GPU_BACKEND must be native or swiftshader');
}
const artifacts =
  process.env.DOMFX_DOCS_OUTPUT_DIR ?? resolve(import.meta.dirname, '../../.scratch/docs');
export default defineConfig({
  testDir: './browser-tests',
  outputDir: resolve(artifacts, 'test-results'),
  reporter: [['list'], ['json', { outputFile: resolve(artifacts, 'report.json') }]],
  workers: 1,
  retries: 0,
  forbidOnly: true,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  metadata: { gpuBackend },
  use: {
    channel: 'chromium',
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'no-preference',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    launchOptions: {
      args: [
        '--enable-unsafe-webgpu',
        ...(gpuBackend === 'swiftshader'
          ? ['--use-angle=swiftshader', '--use-webgpu-adapter=swiftshader']
          : []),
      ],
    },
    baseURL: 'http://127.0.0.1:4347',
  },
  projects: [{ name: 'production' }],
  webServer: {
    command: 'pnpm --dir ../.. preview:docs --ignore-lock',
    url: 'http://127.0.0.1:4347/docs/introduction/',
    reuseExistingServer: false,
  },
});
