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
        ? {
            '/docs': { target: process.env.DOMFX_DOCS_DEV_URL, ws: true },
            '/__domfx_docs/': {
              target: process.env.DOMFX_DOCS_DEV_URL,
              rewrite: (path) => path.replace(/^\/__domfx_docs/, ''),
            },
          }
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
            // Astro's dev modules use root URLs even with a /docs base. Redirect
            // them into an internal namespace (outside page trailing-slash rules),
            // so subsequent imports retain the docs server as their referrer.
            const referrerPath = URL.parse(request.headers.referer ?? '')?.pathname;
            if (
              process.env.DOMFX_DOCS_DEV_URL &&
              referrerPath &&
              /^\/(?:docs|__domfx_docs)\//.test(referrerPath) &&
              /^\/(?:@(?:fs|id|vite)\/|src\/|node_modules\/)/.test(url.pathname)
            ) {
              response.writeHead(307, {
                Location: `/__domfx_docs${url.pathname}${url.search}`,
                'Cache-Control': 'no-store',
                Vary: 'Referer',
              });
              response.end();
              return;
            }
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
