import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';

import { sitePublicDir } from '@domfx/site/public-path';

import { effectsByCategory } from './src/content/documentation';
import { docsDiscovery, docsSiteConfig } from './src/integrations/discovery.mjs';

export default defineConfig({
  ...docsSiteConfig(process.env),
  base: '/docs',
  trailingSlash: 'always',
  output: 'static',
  publicDir: sitePublicDir,
  devToolbar: { enabled: false },
  redirects: { '/': '/docs/introduction/' },
  integrations: [
    starlight({
      title: 'domfx docs',
      defaultLocale: 'root',
      locales: { root: { label: 'English', lang: 'en' } },
      disable404Route: true,
      editLink: { baseUrl: 'https://github.com/G0m1namm/domfx/edit/main/apps/docs/' },
      pagination: true,
      tableOfContents: { minHeadingLevel: 2, maxHeadingLevel: 3 },
      components: {
        Header: './src/components/Header.astro',
        MobileMenuToggle: './src/components/MobileMenuToggle.astro',
        MarkdownContent: './src/components/MarkdownContent.astro',
        Footer: './src/components/Footer.astro',
      },
      customCss: [
        '@domfx/site/styles/shared.css',
        '@domfx/site/styles/brand.css',
        './src/styles/docs-components.css',
        './src/styles/starlight.css',
      ],
      sidebar: [
        {
          label: 'Getting started',
          items: [
            { label: 'Introduction', slug: 'introduction' },
            { label: 'Installation', slug: 'installation' },
          ],
        },
        {
          label: 'Guides',
          items: [
            { label: 'Standalone', slug: 'standalone' },
            { label: 'GSAP', slug: 'gsap' },
          ],
        },
        {
          label: 'Effects',
          items: [
            { label: 'All effects', slug: 'api/effects' },
            ...effectsByCategory.map(({ category, effects }) => ({
              label: category,
              collapsed: true,
              items: effects.map((effect) => ({
                label: effect.name,
                link: `/docs/api/effects/${effect.id}/`,
              })),
            })),
          ],
        },
        {
          label: 'Reference',
          items: [
            { label: 'API reference', slug: 'api' },
            { label: 'Shared options and controls', slug: 'api/shared' },
            { label: 'Effect instance', slug: 'api/effect-handle' },
            { label: 'GSAP API', slug: 'api/gsap' },
          ],
        },
        {
          label: 'Help',
          items: [
            { label: 'Upgrading', slug: 'upgrading' },
            { label: 'Browser support', slug: 'support' },
            { label: 'Troubleshooting', slug: 'troubleshooting' },
          ],
        },
      ],
    }),
    docsDiscovery(),
  ],
  vite: { optimizeDeps: { exclude: ['@domfx/browser', '@domfx/core', '@domfx/gsap'] } },
});
