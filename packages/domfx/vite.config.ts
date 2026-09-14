import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import typegpuPlugin from 'unplugin-typegpu/vite';
import { defineConfig } from 'vite';

import packageJson from './package.json' with { type: 'json' };

export default defineConfig({
  plugins: [typegpuPlugin()],
  esbuild: { legalComments: 'inline' },
  build: {
    target: 'es2022',
    minify: false,
    lib: {
      entry: {
        index: resolve(import.meta.dirname, 'src/index.ts'),
        experimental: resolve(import.meta.dirname, 'src/experimental.ts'),
      },
      formats: ['es'],
      fileName: (_format, entry) => `${entry}.js`,
    },
    rollupOptions: {
      // Ship the patched executor to packed consumers, which do not inherit pnpm patches.
      external: (id) =>
        Object.keys(packageJson.dependencies).some(
          (name) => name !== '@typegpu/sdf' && (id === name || id.startsWith(`${name}/`)),
        ),
      output: {
        banner: `/*! Bundled @typegpu/sdf 0.12.0 (executor cleanup and refinement patched)\n${readFileSync(
          resolve(import.meta.dirname, 'node_modules/@typegpu/sdf/LICENSE'),
          'utf8',
        )}*/`,
      },
    },
  },
});
