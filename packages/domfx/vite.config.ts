import { resolve } from 'node:path';

import typegpuPlugin from 'unplugin-typegpu/vite';
import { defineConfig } from 'vite';

import packageJson from './package.json' with { type: 'json' };

export default defineConfig({
  plugins: [typegpuPlugin()],
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
      external: (id) =>
        Object.keys(packageJson.dependencies).some(
          (name) => id === name || id.startsWith(`${name}/`),
        ),
    },
  },
});
