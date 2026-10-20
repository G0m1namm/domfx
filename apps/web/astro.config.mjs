import { resolve } from 'node:path';

import { defineConfig } from 'astro/config';

import { sitePublicDir } from '@domfx/site/public-path';

const packages = resolve(import.meta.dirname, '../../packages');

export default defineConfig({
  output: 'static',
  publicDir: sitePublicDir,
  devToolbar: { enabled: false },
  markdown: { syntaxHighlight: false },
  vite: {
    // Consume changing built exports directly, never an optimizer snapshot or source alias.
    optimizeDeps: {
      exclude: ['@domfx/browser', '@domfx/core', '@domfx/gsap'],
      include: [
        '@domfx/browser > @zumer/snapdom',
        '@domfx/browser > typegpu',
        '@domfx/browser > typegpu/data',
        '@domfx/browser > typegpu/std',
      ],
    },
    plugins: [
      {
        name: 'domfx-built-exports',
        configureServer(server) {
          const directories = ['core', 'domfx', 'gsap'].map((name) =>
            resolve(packages, name, 'dist'),
          );
          server.watcher.add(directories);
        },
      },
    ],
  },
});
