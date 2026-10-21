import { defineConfig } from '@playwright/test';

import config, { fixtureProjects } from './playwright.config.js';

export default defineConfig({
  ...config,
  testMatch: 'capture-alignment.spec.ts',
  use: { ...config.use, channel: undefined, launchOptions: {} },
  projects: (['chromium', 'firefox', 'webkit'] as const).flatMap((browserName) =>
    fixtureProjects.map((project) => ({
      ...project,
      name: `${browserName}-${project.name}`,
      use: { ...project.use, browserName },
    })),
  ),
});
