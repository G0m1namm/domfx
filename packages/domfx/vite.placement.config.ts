import { resolve } from 'node:path';

import { defineConfig } from 'vite';

export default defineConfig({
  root: resolve(import.meta.dirname, 'tests/browser'),
  build: {
    target: 'es2022',
    outDir: resolve(import.meta.dirname, '.scratch/placement-fixture'),
    emptyOutDir: true,
  },
});
