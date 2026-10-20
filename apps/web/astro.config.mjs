import { resolve } from 'node:path';

import { defineConfig } from 'astro/config';

import { siteConfig } from '@domfx/site/config';
import { sitePublicDir } from '@domfx/site/public-path';

import { marketingDiscovery } from './src/integrations/discovery.mjs';

const { site } = siteConfig(process.env);
const packages = resolve(import.meta.dirname, '../../packages');

export default defineConfig({
  site,
  trailingSlash: 'always',
  integrations: [marketingDiscovery()],
  output: 'static',
  publicDir: sitePublicDir,
  devToolbar: { enabled: false },
  markdown: { syntaxHighlight: false },
  vite: {
    server: {
      proxy: process.env.DOMFX_DOCS_DEV_URL
        ? { '/docs': { target: process.env.DOMFX_DOCS_DEV_URL, ws: true } }
        : {},
    },
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
          server.middlewares.use((request, response, next) => {
            const url = new URL(request.url ?? '/', 'http://localhost');
            if (process.env.DOMFX_DOCS_DEV_URL && /^\/docs(?:\/[a-z0-9-]+)*$/.test(url.pathname)) {
              response.writeHead(308, { Location: `${url.pathname}/${url.search}` });
              response.end();
              return;
            }
            next();
          });
          const directories = ['core', 'domfx', 'gsap'].map((name) =>
            resolve(packages, name, 'dist'),
          );
          server.watcher.add(directories);
        },
      },
    ],
  },
});
