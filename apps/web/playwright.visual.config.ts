import { defineConfig } from '@playwright/test';

import config from './playwright.config.js';

export default defineConfig({
  ...config,
  testIgnore: [],
  testMatch: '**/visual.spec.ts',
  projects: [{ name: 'production', use: { baseURL: 'http://127.0.0.1:4323' } }],
  webServer: {
    command: 'pnpm preview --ignore-lock --port 4323',
    url: 'http://127.0.0.1:4323',
    reuseExistingServer: false,
  },
  snapshotPathTemplate: `{testDir}/visual-baselines/{platform}/${process.env.DOMFX_GPU_BACKEND ?? 'native'}/{arg}{ext}`,
});
