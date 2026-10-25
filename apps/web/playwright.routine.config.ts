import { defineConfig } from '@playwright/test';

import config from './playwright.config';

export default defineConfig({
  ...config,
  testMatch: [
    '**/smoke.spec.ts',
    '**/header.spec.ts',
    '**/locale.spec.ts',
    '**/docs-links.spec.ts',
    '**/docs-routing.spec.ts',
  ],
  // Keep the full smoke suite, plus only the bounded regression cases tagged here.
  grep: /smoke\.spec\.ts|@routine/,
});
