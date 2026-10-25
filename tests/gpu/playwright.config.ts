import { resolve } from 'node:path';

import { defineConfig } from '@playwright/test';

const artifacts =
  process.env.DOMFX_BROWSER_OUTPUT_DIR ?? resolve(import.meta.dirname, '../../.scratch/browser');
const gpuBackend = process.env.DOMFX_GPU_BACKEND ?? 'native';
if (!['native', 'swiftshader'].includes(gpuBackend)) {
  throw new Error('DOMFX_GPU_BACKEND must be native or swiftshader');
}

export const fixtureProjects = [
  { name: 'development', use: { baseURL: 'http://127.0.0.1:4173' } },
  { name: 'production', use: { baseURL: 'http://127.0.0.1:4174' } },
];

export default defineConfig({
  testDir: './browser-tests',
  outputDir: resolve(artifacts, 'test-results'),
  reporter: [['list'], ['json', { outputFile: resolve(artifacts, 'report.json') }]],
  metadata: { gpuBackend },
  // Serial runs avoid contention between numerical fixtures and capture measurements.
  workers: 1,
  retries: 0,
  forbidOnly: true,
  timeout: 180_000,
  globalTimeout: gpuBackend === 'swiftshader' ? 3_600_000 : 900_000,
  expect: { timeout: 10_000 },
  use: {
    browserName: 'chromium',
    channel: 'chromium',
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 2,
    reducedMotion: 'no-preference',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: {
      args: [
        '--enable-unsafe-webgpu',
        ...(gpuBackend === 'swiftshader'
          ? process.platform === 'linux'
            ? [
                '--enable-features=Vulkan',
                '--use-angle=vulkan',
                '--use-vulkan=swiftshader',
                '--use-webgpu-adapter=swiftshader',
                '--disable-vulkan-surface',
              ]
            : ['--use-angle=swiftshader', '--use-webgpu-adapter=swiftshader']
          : []),
      ],
    },
  },
  projects: fixtureProjects,
  webServer: [
    {
      command: 'pnpm exec vite --host 127.0.0.1 --port 4173 --strictPort',
      url: 'http://127.0.0.1:4173',
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command: 'pnpm exec vite preview --host 127.0.0.1 --port 4174 --strictPort',
      url: 'http://127.0.0.1:4174',
      reuseExistingServer: false,
      timeout: 30_000,
    },
  ],
});
